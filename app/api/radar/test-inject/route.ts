import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

export async function POST(request: Request) {
    try {
        const db = getDb();
        const testContent = "Ceci est un article de test généré manuellement depuis le Dashboard. Il sert à vérifier le bon fonctionnement de la publication, du cache visuel algorithmique et de l'intégration avec Payload.";

        const timestamp = Date.now();
        const info = db.prepare(`
            INSERT INTO radar_posts 
            (source_url, source_title, flash_content, image_keyword, status, geo, tags, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            `https://example.com/test/${timestamp}`,
            `[TEST] Publication Dashboard L'Assez (${timestamp})`,
            testContent,
            'test_visual_identity',
            'PENDING',
            'france',
            'test,radar',
            new Date().toISOString()
        );

        db.close();

        return NextResponse.json({ success: true, message: 'Article de test injecté avec succès.' });
    } catch (error: any) {
        console.error("Erreur API Radar (POST Test):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
