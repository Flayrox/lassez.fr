import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { formatElectionLabel, parseJsonArray } from '@/lib/elections';

export const dynamic = 'force-dynamic';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

export async function GET() {
    let db: any = null;
    try {
        db = getDb();
        const rows = db.prepare('SELECT key, value FROM radar_settings WHERE key IN (?, ?)').all(
            'election_front_display_slugs_json',
            'election_analysis_target_slug'
        ) as { key: string; value: string }[];

        const map = Object.fromEntries(rows.map((r) => [String(r.key), String(r.value || '')]));
        const displaySlugs = parseJsonArray(map.election_front_display_slugs_json, ['municipales-2026']);
        const targetSlug = String(map.election_analysis_target_slug || 'municipales-2026');

        const elections = displaySlugs.map((slug) => {
            const counts = db.prepare(`
                SELECT
                    COUNT(DISTINCT code_insee) AS communes,
                    COUNT(DISTINCT code_departement) AS departments
                FROM elections_officiel_cache
                WHERE election_slug = ?
            `).get(slug) as { communes?: number; departments?: number } | undefined;

            return {
                slug,
                label: formatElectionLabel(slug),
                isTarget: slug === targetSlug,
                counts: {
                    communes: Number(counts?.communes || 0),
                    departments: Number(counts?.departments || 0),
                },
            };
        });

        return NextResponse.json({ success: true, elections, targetSlug });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: true,
                elections: [{ slug: 'municipales-2026', label: formatElectionLabel('municipales-2026'), isTarget: true }],
                targetSlug: 'municipales-2026',
                error: error?.message || 'fallback',
            },
            { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } }
        );
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}
