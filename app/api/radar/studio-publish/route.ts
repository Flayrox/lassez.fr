import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/radar_lassez/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Crée récursivement un dossier s'il n'existe pas
 */
function ensureDir(p: string) {
    try { fs.mkdirSync(p, { recursive: true }); } catch (e) { }
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/**
 * Route POST /api/radar/studio-publish
 *
 * Le Studio publie un brouillon d'investigation : on met à jour le topic
 * (newsTopic — la source de vérité du Studio) avec le contenu édité et une
 * éventuelle image personnalisée (Base64 décodée), puis on bascule en PUBLISHED.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, titre, content, imageBase64 } = body;

        if (!id) return NextResponse.json({ success: false, error: 'Identifiant d\'article requis' }, { status: 400 });

        const topic = await prisma.newsTopic.findUnique({ where: { id: String(id) } });
        if (!topic) return NextResponse.json({ success: false, error: 'Topic introuvable' }, { status: 404 });

        let imagePath: string | null = null;
        if (imageBase64 && typeof imageBase64 === 'string') {
            const m = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (m) {
                const ext = m[1].split('/')[1] || 'png';
                const b64 = m[2];
                const filename = `studio-${Date.now()}.${ext}`;
                const tmpDir = path.join(process.cwd(), 'radar_lassez', 'tmp');
                ensureDir(tmpDir);
                const outPath = path.join(tmpDir, filename);
                fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
                imagePath = outPath;
            }
        }

        // Préserve le draft existant et fusionne les modifications éditoriales
        const draftData: any = safeJson(topic.final_draft, {});
        if (titre) draftData.headline = String(titre);
        if (content) draftData.body = String(content);

        await prisma.newsTopic.update({
            where: { id: String(id) },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
                final_draft: JSON.stringify(draftData),
                ...(imagePath ? { image_url: imagePath } : {}),
            },
        });

        logger.success('Studio', `Topic ${id} publié manuellement depuis le Studio.`);

        return NextResponse.json({ success: true, message: 'Article publié', id });
    } catch (err: any) {
        console.error('Erreur Studio Publish:', err);
        return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
    }
}
