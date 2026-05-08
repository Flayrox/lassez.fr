import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Récupération des paramètres globaux
        const settings = await prisma.globalSettings.findFirst();
        if (!settings) {
            return NextResponse.json({ success: false, error: 'Settings not found' });
        }

        // 2. Comptage des articles (Topics) par statut
        const topics = await prisma.newsTopic.findMany({
            select: { status: true }
        });
        
        const postCounts: Record<string, number> = {};
        topics.forEach(t => {
            const s = t.status || 'unknown';
            postCounts[s] = (postCounts[s] || 0) + 1;
        });

        // 3. Comptage des publications (Jobs)
        const publications = await prisma.publication.findMany({
            select: { status: true }
        });
        
        const jobCounts: Record<string, number> = {};
        publications.forEach(p => {
            const s = p.status || 'unknown';
            jobCounts[s] = (jobCounts[s] || 0) + 1;
        });

        // 4. Calcul de la santé du Daemon
        // On se base sur le scrapingInterval pour savoir si c'est "normal"
        const intervalMs = (settings.scrapingInterval || 60) * 60 * 1000;
        const lastUpdate = new Date(settings.updatedAt).getTime();
        const now = Date.now();
        
        let daemonStatus = 'Stable';
        let healthColor = 'ok';

        if (now > lastUpdate + (intervalMs * 2)) {
            daemonStatus = 'Inactif / Retard';
            healthColor = 'late';
        } else if (!settings.enableAutoPublish) {
            daemonStatus = 'Autopilote Off';
            healthColor = 'paused';
        }

        return NextResponse.json({
            success: true,
            status: {
                daemonHealth: { status: healthColor, message: daemonStatus },
                nextScanAt: new Date(lastUpdate + intervalMs).toISOString(),
                lastScanAt: settings.updatedAt,
                postCounts,
                jobCounts,
                settings: {
                    autoPilot: settings.enableAutoPublish,
                    aiModel: settings.aiModelFlash,
                    concurrency: settings.maxConcurrentTasks
                }
            }
        });
    } catch (error: any) {
        console.error("Erreur API Daemon Status:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
