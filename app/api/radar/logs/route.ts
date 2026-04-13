import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LogCategory = 'daemon' | 'schedule' | 'manual' | 'publisher' | 'elections' | 'error' | 'other';

function getDb() {
    return new Database(path.join(process.cwd(), 'radar_lassez', 'radar.db'));
}

function detectCategory(message: string, level?: string): LogCategory {
    const text = String(message || '').toLowerCase();
    const lvl = String(level || '').toLowerCase();

    if (lvl === 'error' || text.includes('❌') || text.includes('erreur') || text.includes('échec') || text.includes('fail')) {
        return 'error';
    }
    if (text.includes('manual-scan') || text.includes('manuel') || text.includes('déclenchement') || text.includes('declenchement')) {
        return 'manual';
    }
    if (text.includes('heures fixes') || text.includes('prochain scan') || text.includes('programmé') || text.includes('programme') || text.includes('schedule')) {
        return 'schedule';
    }
    if (text.includes('pilote auto') || text.includes('publication') || text.includes('publishpost') || text.includes('planifié') || text.includes('planifie')) {
        return 'publisher';
    }
    if (text.includes('élections') || text.includes('elections') || text.includes('sync_elections')) {
        return 'elections';
    }
    if (text.includes('daemon') || text.includes('boucle') || text.includes('heartbeat') || text.includes('job processor')) {
        return 'daemon';
    }
    return 'other';
}

function parseLineFallback(line: string) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return null;

    const tsMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
    const timestamp = tsMatch ? tsMatch[1] : new Date().toISOString();
    const message = tsMatch ? tsMatch[2] : trimmed;
    const level = message.toLowerCase().includes('error') || message.includes('❌') ? 'ERROR' : 'INFO';

    return {
        timestamp,
        level,
        category: detectCategory(message, level),
        message
    };
}

export async function GET() {
    let db: Database.Database | null = null;
    try {
        db = getDb();
        const rows = db.prepare(`
            SELECT level, message, created_at
            FROM radar_logs
            ORDER BY id DESC
            LIMIT 500
        `).all() as Array<{ level: string; message: string; created_at: string }>;

        const logs = rows.reverse().map((row) => ({
            timestamp: row.created_at,
            level: row.level,
            category: detectCategory(row.message, row.level),
            message: row.message
        }));

        const legacy = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`);
        return NextResponse.json({ success: true, logs: legacy, logsStructured: logs });
    } catch (_) {
        try {
            const logPath = path.join(process.cwd(), 'radar_lassez', 'daemon.log');

            if (!fs.existsSync(logPath)) {
                return NextResponse.json({ success: true, logs: ["Aucun fichier de logs trouvé."], logsStructured: [] });
            }

            const content = fs.readFileSync(logPath, 'utf8');
            const lines = content.split('\n');
            const lastLines = lines.slice(-500).filter(Boolean);

            const logsStructured = lastLines
                .map(parseLineFallback)
                .filter((x): x is { timestamp: string; level: string; category: LogCategory; message: string } => Boolean(x));

            return NextResponse.json({ success: true, logs: lastLines, logsStructured });
        } catch (error: any) {
            console.error("Erreur API Radar Logs (GET):", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}
