import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasRadarSession } from '@/lib/radar-session';
import { getPayloadClient } from '@/lib/payload';
import RadarCockpitClient from '@/components/RadarCockpitClient';

export const metadata: Metadata = {
    title: "Cockpit Radar | L'Assez",
    robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const SIGNAL_STATUSES = ['INGESTED', 'RESEARCHED', 'DRAFTED', 'VALIDATED', 'PENDING', 'QUEUED', 'PUBLISHED', 'REJECTED', 'REJECTED_ERROR', 'FAILED'] as const;

/**
 * Cockpit Radar autonome — la vue d'ensemble du pipeline vit ici, en dehors
 * de l'admin Payload. Protégé par le même jeton `radar_session` que le
 * Studio (voir /api/radar/login et proxy.ts).
 */
export default async function RadarCockpitPage() {
    const cookieStore = await cookies();
    if (!hasRadarSession(cookieStore.get('radar_session')?.value)) {
        redirect('/radar-login');
    }

    const payload = await getPayloadClient();

    // 1. Compteurs par statut (chaque étape du pipeline)
    const counts: Record<string, number> = {};
    for (const status of SIGNAL_STATUSES) {
        const { totalDocs } = await payload.count({
            collection: 'signals',
            where: { status: { equals: status } },
        });
        counts[status] = totalDocs;
    }

    // 2. Dernier log (heartbeat du daemon)
    const latestLogs = await payload.find({
        collection: 'logs',
        limit: 1,
        depth: 0,
        sort: '-timestamp',
    });
    const lastLog = latestLogs.docs?.[0] || null;

    // 3. Les 15 derniers logs (niveau, nœud, message, horodatage)
    const recentLogs = await payload.find({
        collection: 'logs',
        limit: 15,
        depth: 0,
        sort: '-timestamp',
    });

    // 4. Les 6 derniers signals, quel que soit leur statut
    const recentSignals = await payload.find({
        collection: 'signals',
        limit: 6,
        depth: 0,
        sort: '-createdAt',
    });

    // 5. Publications dues (PENDING et échues)
    const duePubs = await payload.count({
        collection: 'publications',
        where: {
            and: [
                { status: { equals: 'PENDING' } },
                { scheduled_at: { less_than: new Date().toISOString() } },
            ],
        },
    });

    // 6. Réglages globaux
    let settings: any = null;
    try {
        settings = await payload.findGlobal({ slug: 'radar-settings' });
    } catch {
        settings = null;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // 7. Santé du daemon : dernier log vs intervalle de scan
    let daemonHealth: 'ok' | 'late' | 'paused' = 'ok';
    if (settings && settings.enableAutoPublish === false) {
        daemonHealth = 'paused';
    } else if (lastLog) {
        const intervalMs = (settings?.scrapingInterval ?? 60) * 60 * 1000;
        const lastLogMs = new Date(lastLog.timestamp).getTime();
        if (Date.now() - lastLogMs > intervalMs * 3) {
            daemonHealth = 'late';
        }
    }

    const logLevel = settings?.logLevel || 'INFO';
    const logRetentionDays = settings?.logRetentionDays ?? 14;

    // Nœuds suivis (radar-settings > Logs > logMirrorNodes) : liste de noms de
    // nœuds à mettre en avant dans le fil des logs du cockpit.
    let focusNodes: string[] = [];
    try {
        const raw = settings?.logMirrorNodes;
        if (typeof raw === 'string' && raw.trim()) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) focusNodes = parsed.map(String).filter(Boolean);
        }
    } catch {
        focusNodes = [];
    }

    return (
        <RadarCockpitClient
            counts={counts}
            total={total}
            lastLogAt={lastLog?.timestamp || null}
            lastLogMessage={lastLog?.message || null}
            daemonHealth={daemonHealth}
            autoPublish={settings?.enableAutoPublish ?? true}
            aiModel={settings?.aiModelFlash || settings?.aiModelPro || '—'}
            recentSignals={(recentSignals.docs || []).map((s: any) => ({
                id: String(s.id),
                title: s.source_title || String(s.id),
                status: s.status || '—',
                updatedAt: s.updatedAt || null,
            }))}
            recentLogs={(recentLogs.docs || []).map((l: any) => ({
                id: String(l.id),
                level: l.level || 'INFO',
                node: l.node_id || 'SYSTEM',
                message: l.message || '',
                timestamp: l.timestamp || null,
            }))}
            duePubs={duePubs.totalDocs || 0}
            errors={(counts['REJECTED_ERROR'] || 0) + (counts['FAILED'] || 0)}
            logLevel={logLevel}
            logRetentionDays={logRetentionDays}
            focusNodes={focusNodes}
        />
    );
}
