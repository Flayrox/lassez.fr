import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { RadarDashboardClient } from './DashboardClient';

const SIGNAL_STATUSES = ['INGESTED', 'RESEARCHED', 'DRAFTED', 'VALIDATED', 'PENDING', 'QUEUED', 'PUBLISHED', 'REJECTED', 'REJECTED_ERROR', 'FAILED'] as const;

/**
 * Dashboard Radar — vue racine qui remplace le dashboard Payload par défaut.
 *
 * Côté serveur : lit les compteurs par statut, le dernier log (heartbeat du
 * daemon) et les réglages radar-settings via le local API Payload, puis rend
 * le composant client interactif.
 */
export default function RadarDashboard({ initPageResult, params, searchParams }: AdminViewServerProps) {
    const { req } = initPageResult;

    if (!req.user) {
        return <p>You must be logged in to view this page.</p>;
    }

    return (
        <DefaultTemplate
            i18n={req.i18n}
            locale={initPageResult.locale}
            params={params}
            payload={req.payload}
            permissions={initPageResult.permissions}
            searchParams={searchParams}
            user={req.user}
            visibleEntities={initPageResult.visibleEntities}
        >
            <RadarDashboardServer req={req} />
        </DefaultTemplate>
    );
}

/**
 * Composant serveur interne : récupère les données du pipeline avant de
 * déléguer au composant client. Séparé pour rester un server component pur.
 */
async function RadarDashboardServer({ req }: { req: any }) {
    const { payload } = req;

    // 1. Compteurs par statut
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

    // 3. Réglages globaux
    let settings: any = null;
    try {
        settings = await payload.findGlobal({ slug: 'radar-settings' });
    } catch (e) {
        settings = null;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // 4. Santé du daemon : dernier log vs intervalle de scan
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

    return (
        <RadarDashboardClient
            counts={counts}
            total={total}
            lastLogAt={lastLog?.timestamp || null}
            lastLogMessage={lastLog?.message || null}
            daemonHealth={daemonHealth}
            autoPublish={settings?.enableAutoPublish ?? true}
            aiModel={settings?.aiModelFlash || settings?.aiModelPro || '—'}
        />
    );
}
