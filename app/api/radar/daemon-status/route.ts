import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
    return new Database(path.join(process.cwd(), 'radar_lassez', 'radar.db'));
}

function settingsToMap(rows: any[]) {
    const out: Record<string, string> = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
}

export async function GET() {
    let db: Database.Database | null = null;
    try {
        db = getDb();

        const settingsRows = db.prepare('SELECT key, value FROM radar_settings').all() as any[];
        const settings = settingsToMap(settingsRows);

        const postRows = db.prepare(`
            SELECT status, COUNT(*) as c
            FROM radar_posts
            GROUP BY status
        `).all() as any[];

        const postCounts: Record<string, number> = {};
        for (const row of postRows) postCounts[String(row.status || 'unknown')] = Number(row.c || 0);

        let jobCounts: Record<string, number> = {};
        try {
            const jobRows = db.prepare(`
                SELECT status, COUNT(*) as c
                FROM radar_jobs
                GROUP BY status
            `).all() as any[];
            for (const row of jobRows) jobCounts[String(row.status || 'unknown')] = Number(row.c || 0);
        } catch (_) {
            jobCounts = {};
        }

        const nextScanAt = settings.next_scan_at || null;
        const lastScanAt = settings.last_scan_at || null;

        const nowMs = Date.now();
        const nextMs = nextScanAt ? new Date(nextScanAt).getTime() : NaN;

        const daemonHealth = (() => {
            if (settings.daemon_rss_enabled === 'false') {
                return { status: 'paused', message: 'Daemon RSS desactive' };
            }
            if (!Number.isFinite(nextMs)) {
                return { status: 'unknown', message: 'Aucun prochain scan programme' };
            }
            if (nowMs > nextMs + (15 * 60 * 1000)) {
                return { status: 'late', message: 'Scan en retard (>15 min)' };
            }
            if (nowMs >= nextMs - (2 * 60 * 1000) && nowMs <= nextMs + (5 * 60 * 1000)) {
                return { status: 'running', message: 'Execution imminente/en cours' };
            }
            return { status: 'ok', message: 'Daemon actif' };
        })();

        const scheduleTimes = String(settings.daemon_rss_schedule_times || '')
            .split(/[\n,;|\s]+/)
            .map(x => x.trim())
            .filter(Boolean);

        return NextResponse.json({
            success: true,
            status: {
                daemonHealth,
                nextScanAt,
                lastScanAt,
                schedule: {
                    mode: settings.daemon_rss_schedule_enabled === 'true' ? 'fixed-hours' : 'interval',
                    times: scheduleTimes,
                    intervalHours: Number(settings.scan_interval_hours || '2')
                },
                postCounts,
                jobCounts,
                runtime: {
                    rssEnabled: settings.daemon_rss_enabled !== 'false',
                    electionsEnabled: settings.daemon_elections_enabled === 'true',
                    autoPilotEnabled: settings.auto_pilot_enabled === 'true',
                    autoApproveEnabled: settings.auto_approve_enabled === 'true'
                }
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}
