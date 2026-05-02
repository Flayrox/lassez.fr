import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ensureDir(p: string) {
    try { fs.mkdirSync(p, { recursive: true }); } catch (e) { }
}

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, titre, content, imageBase64 } = body;

        if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 });

        let imagePath: string | null = null;
        if (imageBase64 && typeof imageBase64 === 'string') {
            // imageBase64 is expected to be a data URL like data:image/png;base64,....
            const m = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (m) {
                const ext = m[1].split('/')[1] || 'png';
                const b64 = m[2];
                const filename = `studio-${Date.now()}.${ext}`;
                const tmpDir = path.join(process.cwd(), 'radar_lassez', 'tmp');
                ensureDir(tmpDir);
                const outPath = path.join(tmpDir, filename);
                fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
                imagePath = outPath; // local path stored in DB as image_keyword (publishPost.js handles local path or URL)
            }
        }

        const db = getDb();
        try {
            const stmt = db.prepare('UPDATE radar_posts SET flash_content = ?, image_keyword = ?, source_title = ? WHERE id = ?');
            stmt.run(content || null, imagePath || null, titre || null, id);
        } finally {
            try { db.close(); } catch (e) {}
        }

        // Use existing Radar API PATCH to update status -> that route will spawn publishPost.js
        try {
            const origin = new URL(request.url).origin;
            await fetch(`${origin}/api/radar`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: 'PUBLISHED', flash_content: content, image_keyword: imagePath, source_title: titre })
            });
        } catch (e) {
            console.warn('Failed to call internal /api/radar PATCH:', e);
        }

        return NextResponse.json({ success: true, message: 'Publish requested', id });
    } catch (err: any) {
        console.error('Erreur studio-publish:', err);
        return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
    }
}
