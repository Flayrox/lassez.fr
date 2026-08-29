import { NextResponse } from 'next/server';
import { formatElectionLabel } from '@/lib/elections';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { getElectionDbPath, readElectionsRegistry } from '@/lib/elections-db';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

function getStudioBaseUrl() {
    const remoteUrl = process.env.STUDIO_API_URL;
    if (!remoteUrl) return null;
    try {
        const u = new URL(remoteUrl);
        return `${u.protocol}//${u.host}`;
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const isProxied = request.headers.get('x-studio-proxy') === '1';
    let db: any = null;
    try {
        const studioBase = getStudioBaseUrl();
        if (studioBase && !process.env.IS_STUDIO && !isProxied) {
            const res = await fetchWithTimeout(
                `${studioBase}/api/elections/meta?t=${Date.now()}`,
                {
                    cache: 'no-store',
                    headers: { 'x-studio-proxy': '1' }
                },
                1800
            );
            if (res.ok) {
                const data = await res.json();
                return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } });
            }
        }

        const registry = readElectionsRegistry();
        const displaySlugs = registry.displaySlugs;
        const targetSlug = registry.targetSlug;

        const elections = displaySlugs.map((slug) => {
            try {
                db = new Database(getElectionDbPath(slug), { readonly: true });
                const counts = db.prepare(`
                    SELECT
                        COUNT(DISTINCT code_insee) AS communes,
                        COUNT(DISTINCT code_departement) AS departments
                    FROM elections_officiel_cache
                `).get() as { communes?: number; departments?: number } | undefined;
                db.close();
                db = null;
                return {
                    slug,
                    label: formatElectionLabel(slug),
                    isTarget: slug === targetSlug,
                    counts: {
                        communes: Number(counts?.communes || 0),
                        departments: Number(counts?.departments || 0),
                    },
                };
            } catch {
                if (db) { try { db.close(); } catch (_) {} db = null; }
                return {
                    slug,
                    label: formatElectionLabel(slug),
                    isTarget: slug === targetSlug,
                    counts: { communes: 0, departments: 0 },
                };
            }
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
