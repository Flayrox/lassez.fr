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

function readLogFileSafe(logPath: string): string[] {
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, 'utf8');
    return content.split('\n').filter(Boolean);
}

function getPm2LogCandidates() {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) return [];

    const names = fs.readdirSync(logsDir);
    const preferred = names.filter((n) => /^daemon-rss(-\d+)?\.log$/i.test(n));
    const secondary = names.filter((n) => /^daemon(-\d+)?\.log$/i.test(n));
    return [...preferred, ...secondary].map((n) => path.join(logsDir, n));
}

export async function GET() {
    let db: Database.Database | null = null;
    let dbLogs: any[] = [];
    let pm2Logs: any[] = [];

    // 1. Lire les logs PM2
    try {
        const pm2Candidates = getPm2LogCandidates();
        let pm2Lines: string[] = [];
        const logsDir = path.join(process.cwd(), 'logs');
        if (fs.existsSync(logsDir)) {
             const names = fs.readdirSync(logsDir);
             const preferred = names.filter((n) => /^daemon-rss(-\d+)?\.log$/i.test(n));
             const secondary = names.filter((n) => /^daemon(-\d+)?\.log$/i.test(n));
             const allCands = [...preferred, ...secondary].map(n => path.join(logsDir, n));

             for (const cand of allCands) {
                 if (fs.existsSync(cand)) {
                     const cnt = fs.readFileSync(cand, 'utf8');
                     pm2Lines = cnt.split('\n').filter(Boolean).slice(-500); // Prendre les 500 dernières lignes max
                     if (pm2Lines.length > 0) break;
                 }
             }
        }

        pm2Logs = pm2Lines.map(line => {
             const tsMatch = line.match(/^\[?([^\]]+)\]?\s*(.*)$/);
             const ts = tsMatch ? tsMatch[1] : new Date().toISOString();
             const msg = tsMatch ? tsMatch[2] : line;
             const lvl = msg.toLowerCase().includes('error') || msg.includes('❌') ? 'ERROR' : 'INFO';
             return {
                 timestamp: ts,
                 level: lvl,
                 category: detectCategory(msg, lvl),
                 message: msg
             };
        });
    } catch(err) {
        console.error("Erreur lecture logs PM2:", err);
    }

    // 2. Lire la DB
    try {
        db = getDb();
        const rows = db.prepare(`
            SELECT level, message, created_at
            FROM radar_logs
            ORDER BY id DESC
            LIMIT 500
        `).all() as Array<{ level: string; message: string; created_at: string }>;

        dbLogs = rows.reverse().map((row) => ({
            timestamp: row.created_at,
            level: row.level,
            category: detectCategory(row.message, row.level),
            message: row.message
        }));
    } catch (_) {
        // Table doesn't exist or error
    }

    const merged = [...dbLogs, ...pm2Logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(-500);
    const legacy = merged.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`);

    if (db) {
        try { db.close(); } catch (_) {}
    }

    return NextResponse.json({ success: true, logs: legacy, logsStructured: merged });
}
