import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const db = getDb();
        const rows = db.prepare(`
            SELECT key, value FROM radar_settings 
            WHERE key IN (
                'maintenance_mode', 'maintenance_message',
                'popup_enabled', 'popup_title', 'popup_text', 'popup_link_url', 'popup_link_label'
            )
        `).all();

        const config: Record<string, string> = {};
        for (const row of rows) {
            config[row.key] = row.value;
        }

        db.close();

        return NextResponse.json({ 
            success: true, 
            config: {
                maintenance_mode: config.maintenance_mode === 'true',
                maintenance_message: config.maintenance_message || '',
                popup_enabled: config.popup_enabled === 'true',
                popup_title: config.popup_title || '',
                popup_text: config.popup_text || '',
                popup_link_url: config.popup_link_url || '',
                popup_link_label: config.popup_link_label || ''
            }
        }, {
            headers: {
                'Cache-Control': 's-maxage=30, stale-while-revalidate=10', // Cache court pour réactivité
                'Access-Control-Allow-Origin': '*', // Autoriser l'accès cross-origin
            }
        });
    } catch (error: any) {
        console.error("Erreur API Config publique:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
