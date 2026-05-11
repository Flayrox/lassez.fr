import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    let db;
    try {
        const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
        db = new Database(dbPath);
        
        const health = db.prepare('SELECT * FROM radar_source_health ORDER BY last_check_at DESC').all();
        
        return NextResponse.json({ success: true, health });
    } catch (error: any) {
        console.error("Erreur API Radar Source Health (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (db) db.close();
    }
}

/**
 * POST /api/radar/sources/health
 * Permet de réinitialiser la santé d'une source (sortir de quarantaine)
 */
export async function POST(request: Request) {
    let db;
    try {
        const { url } = await request.json();
        if (!url) return NextResponse.json({ success: false, error: 'URL requise' }, { status: 400 });

        const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
        db = new Database(dbPath);
        
        db.prepare(`
            UPDATE radar_source_health 
            SET status = 'HEALTHY', consecutive_failures = 0, last_error = NULL 
            WHERE url = ?
        `).run(url);
        
        return NextResponse.json({ success: true, message: 'Santé réinitialisée' });
    } catch (error: any) {
        console.error("Erreur API Radar Source Health (POST):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (db) db.close();
    }
}
