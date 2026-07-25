import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Calcule le délai exact avant le prochain scan selon le mode (Pulse ou Calendrier)
 */
const getDelayToNextScan = (settings: any) => {
    const fallbackMs = (settings?.scrapingInterval ?? 60) * 60 * 1000;
    const mode = settings?.schedulingMode || 'hybrid';
    
    if (mode === 'pulse') return fallbackMs;

    const hasNoSchedule = (!settings?.daemonSchedule || settings.daemonSchedule.trim() === '[]' || settings.daemonSchedule.trim() === '{}');
    if (hasNoSchedule) return fallbackMs;

    const lines = settings.daemonSchedule.split(/[\n;]+/).map((l: string) => l.trim()).filter(Boolean);
    if (lines.length === 0) return fallbackMs;

    const dayMap: Record<string, number> = { 'DIM': 0, 'LUN': 1, 'MAR': 2, 'MER': 3, 'JEU': 4, 'VEN': 5, 'SAM': 6 };
    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let bestDelayMs = Infinity;

    for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
            const days = parts[0].toUpperCase().split(',');
            const time = parts[1];
            const [targetHour, targetMin] = time.split(':').map(Number);
            const targetTotalMinutes = targetHour * 60 + targetMin;

            for (const d of days) {
                const cleanD = d.trim();
                const targetDay = dayMap[cleanD];
                if (targetDay === undefined) continue;

                let daysDiff = targetDay - currentDay;
                let minutesDiff = targetTotalMinutes - currentMinutes;

                if (daysDiff < 0 || (daysDiff === 0 && minutesDiff <= 0)) {
                    daysDiff += 7;
                }

                if (daysDiff === 0 && minutesDiff > 0) {
                    const delayMs = minutesDiff * 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());
                    if (delayMs < bestDelayMs) bestDelayMs = delayMs;
                } else if (daysDiff > 0) {
                    const delayMs = (daysDiff * 24 * 60 + minutesDiff) * 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());
                    if (delayMs < bestDelayMs) bestDelayMs = delayMs;
                }
            }
        }
    }

    if (bestDelayMs !== Infinity) return bestDelayMs;
    return fallbackMs;
};

/**
 * Route GET /api/radar/daemon-status
 * 
 * Interroge l'état de santé du démon d'automatisation Radar, compte les articles
 * par statut ('PENDING', 'PUBLISHED', 'QUEUED', etc.), et renvoie la date du prochain scan.
 */
export async function GET() {
    try {
        // 1. Récupération des paramètres globaux de configuration Radar
        const settings = await prisma.globalSettings.findFirst();
        if (!settings) {
            return NextResponse.json({ success: false, error: 'Settings not found' }, { status: 404 });
        }

        // 2. Décompte des articles (Topics) par statut dans la base
        const topics = await prisma.newsTopic.findMany({
            select: { status: true }
        });
        
        const postCounts: Record<string, number> = {};
        topics.forEach(t => {
            const s = t.status || 'unknown';
            postCounts[s] = (postCounts[s] || 0) + 1;
        });

        // 3. Décompte des tâches de publication (Publications)
        const publications = await prisma.publication.findMany({
            select: { status: true }
        });
        
        const jobCounts: Record<string, number> = {};
        publications.forEach(p => {
            const s = p.status || 'unknown';
            jobCounts[s] = (jobCounts[s] || 0) + 1;
        });

        // 4. Évaluation de l'état de santé du démon Radar
        const intervalMs = (settings.scrapingInterval || 60) * 60 * 1000;
        const lastUpdate = new Date(settings.updatedAt).getTime();
        const now = Date.now();
        
        let daemonStatus = 'Stable';
        let healthColor = 'ok';

        const recentLog = await prisma.log.findFirst({
            where: { timestamp: { gte: new Date(now - intervalMs * 3) } },
            orderBy: { timestamp: 'desc' }
        });

        if (!recentLog && now > lastUpdate + (intervalMs * 3)) {
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
                nextScanAt: new Date(Date.now() + getDelayToNextScan(settings)).toISOString(),
                lastScanAt: recentLog ? recentLog.timestamp : settings.updatedAt,
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
