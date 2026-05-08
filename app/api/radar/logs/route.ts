import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LogCategory = 'daemon' | 'schedule' | 'manual' | 'publisher' | 'elections' | 'error' | 'other';

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
    if (text.includes('daemon') || text.includes('boucle') || text.includes('heartbeat') || text.includes('job processor')) {
        return 'daemon';
    }
    return 'other';
}

export async function GET() {
    let pm2Logs: any[] = [];

    // Lire les logs PM2 ou les fichiers de log du daemon
    try {
        const logsDir = path.join(process.cwd(), 'logs');
        const radarLassezLogsDir = path.join(process.cwd(), 'radar_lassez');
        
        let logFiles = [];
        if (fs.existsSync(logsDir)) {
            logFiles.push(...fs.readdirSync(logsDir).map(n => path.join(logsDir, n)));
        }
        if (fs.existsSync(radarLassezLogsDir)) {
            const files = fs.readdirSync(radarLassezLogsDir).filter(n => n.endsWith('.log'));
            logFiles.push(...files.map(n => path.join(radarLassezLogsDir, n)));
        }

        // Sort by modification time to get newest logs
        logFiles.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

        let pm2Lines: string[] = [];
        for (const logPath of logFiles) {
            if (fs.existsSync(logPath) && fs.statSync(logPath).isFile()) {
                const content = fs.readFileSync(logPath, 'utf8');
                const lines = content.split('\n').filter(Boolean).slice(-500);
                if (lines.length > 0) {
                    pm2Lines = lines;
                    break;
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
        console.error("Erreur lecture logs:", err);
    }

    const merged = pm2Logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(-500);
    const legacy = merged.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`);

    return NextResponse.json({ success: true, logs: legacy, logsStructured: merged });
}
