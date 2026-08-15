import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { syncDatabase } from '@/lib/radar-schema';

export const dynamic = 'force-dynamic';

/** Ouvre la base et garantit la présence du schéma (tables créées à la demande). */
function openDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    const db = new Database(dbPath);
    syncDatabase(db);
    return db;
}

export async function GET() {
    let db;
    try {
        db = openDb();
        
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

        db = openDb();
        
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
