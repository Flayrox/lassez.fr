import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Crée récursivement un dossier s'il n'existe pas
 */
function ensureDir(p: string) {
    try { fs.mkdirSync(p, { recursive: true }); } catch (e) { }
}

/**
 * Initialise la connexion à la base SQLite locale Radar
 */
function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

/**
 * Route POST /api/radar/studio-publish
 * 
 * Permet au Studio de soumettre la publication directe d'un brouillon d'investigation
 * avec décodage de l'image Base64 si une illustration personnalisée a été déposée.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, titre, content, imageBase64 } = body;

        if (!id) return NextResponse.json({ success: false, error: 'Identifiant d\'article requis' }, { status: 400 });

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

        const db = getDb();
        try {
            const stmt = db.prepare('UPDATE radar_posts SET flash_content = ?, image_keyword = ?, source_title = ? WHERE id = ?');
            stmt.run(content || null, imagePath || null, titre || null, id);
        } finally {
            try { db.close(); } catch (e) {}
        }

        // Appel de l'API PATCH interne pour basculer le statut en PUBLISHED
        try {
            const origin = new URL(request.url).origin;
            await fetch(`${origin}/api/radar`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: 'PUBLISHED', flash_content: content, image_keyword: imagePath, source_title: titre })
            });
        } catch (e) {
            console.warn('Avertissement : Échec de l\'appel PATCH interne vers /api/radar :', e);
        }

        return NextResponse.json({ success: true, message: 'Demande de publication enregistrée', id });
    } catch (err: any) {
        console.error('Erreur Studio Publish:', err);
        return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
    }
}
