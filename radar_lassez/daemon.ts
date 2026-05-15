import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { runIngestionNode } from './nodes/ingestion';
import { runDeduplicatorNode } from './nodes/deduplicator';
import { runResearcherNode } from './nodes/researcher';
import { runEditorialistNode } from './nodes/editorialist';
import { runValidatorNode } from './nodes/validator';
import { runMediaNode } from './nodes/media';
import { runPublisherNode } from './nodes/publisher';
// import { Queue } from 'bullmq'; // Dé-commenter lors de l'intégration de BullMQ

async function ensureGlobalSettings() {
    const settingsCount = await prisma.globalSettings.count();
    
    if (settingsCount === 0) {
        logger.warn("Daemon", "Aucune configuration GlobalSettings trouvée. Initialisation...");
        await prisma.globalSettings.create({
            data: {} // Les valeurs @default de schema.prisma prendront le relais
        });
        logger.success("Daemon", "GlobalSettings initialisées.");
    } else {
        logger.info("Daemon", "GlobalSettings chargées.");
    }
}

export async function runPipeline() {
    logger.info("Daemon", "🚀 Démarrage d'un cycle du pipeline V3...");
    try {
        const settings = await prisma.globalSettings.findFirst();
        if (!settings) throw new Error("Les paramètres globaux sont introuvables.");

        // Charger le graphe pour piloter l'exécution
        let activeNodes = new Set(['ingestion', 'dedup', 'research', 'editor', 'media', 'publisher']); // Fallback legacy
        if (settings.pipelineGraphJson) {
            try {
                const graph = JSON.parse(settings.pipelineGraphJson);
                activeNodes = new Set(graph.nodes.map((n: any) => n.type));
                logger.info("Daemon", `📊 Graphe chargé : ${graph.nodes.length} nodes configurés.`);
            } catch (e) {
                logger.warn("Daemon", "Impossible de parser le graphe, exécution en mode standard.");
            }
        }

        logger.info("Daemon", `🧠 Modèles AI : ${settings.aiModelFlash} (Rapide) / ${settings.aiModelPro} (Édito)`);
        
        let rawArticles: any[] = [];
        if (activeNodes.has('ingestion')) {
            logger.info("Node 1", "📡 Lancement de l'Ingestion...");
            rawArticles = await runIngestionNode(12); // Fallback hardcodé au lieu de settings.rss_lookback_hours manquant
        } else {
            logger.info("Daemon", "⏭️ Node Ingestion absent du graphe. Skip.");
        }

        if (rawArticles.length > 0) {
            logger.success("Node 1", `${rawArticles.length} articles aspirés.`);
            
            if (activeNodes.has('dedup')) {
                logger.info("Node 2", "🗑️ Lancement du Deduplicator...");
                await runDeduplicatorNode(rawArticles);
                logger.success("Node 2", "Opération terminée.");
            }

            if (activeNodes.has('research')) {
                logger.info("Node 3", "🤖 Lancement du Researcher (IA Flash)...");
                await runResearcherNode();
                logger.success("Node 3", "Arbitrage IA terminé.");
            }
            
            if (activeNodes.has('editor')) {
                logger.info("Node 4", "✍️ Lancement de l'Editorialist (IA Pro)...");
                await runEditorialistNode();
                logger.success("Node 4", "Rédaction achevée.");
            }

            if (activeNodes.has('validator')) {
                logger.info("Node 5", "⚖️ Lancement du Validator...");
                await runValidatorNode();
                logger.success("Node 5", "Validation terminée.");
            }

            if (activeNodes.has('media')) {
                logger.info("Node 6", "📸 Lancement du Media Enrichment...");
                await runMediaNode();
                logger.success("Node 6", "Images assignées, articles PENDING.");
            }

        } else if (activeNodes.has('ingestion')) {
            logger.info("Node 1", "🤷‍♂️ Aucun nouvel article. Cycle suivant.");
        }

        logger.success("Daemon", "✅ Cycle terminé.");

    } catch (error: any) {
        logger.error("Daemon", `❌ Erreur critique : ${error.message}`);
    }
}

async function main() {
    logger.overrideConsole();
    
    console.log("==========================================");
    console.log("   L'ASSEZ V3 - INVESTIGATION DAEMON      ");
    console.log("==========================================");

    await ensureGlobalSettings();

    // Calcul du prochain délai selon le mode choisi et la matrice
    const getDelayToNextScan = (settings: any) => {
        const fallbackMs = (settings?.scrapingInterval ?? 60) * 60 * 1000;
        const mode = settings?.schedulingMode || 'hybrid';
        
        // Mode "Fréquence Continue" pur
        if (mode === 'pulse') {
            return { ms: fallbackMs, type: 'interval', label: `${settings?.scrapingInterval ?? 60} minutes` };
        }

        const hasNoSchedule = (!settings?.daemonSchedule || settings.daemonSchedule.trim() === '[]' || settings.daemonSchedule.trim() === '{}');

        // Mode Hybride sans calendrier = fallback
        // Mode Calendrier sans calendrier = on force à attendre 1h pour ne pas boucler à l'infini (sécurité)
        if (hasNoSchedule) {
            return { ms: fallbackMs, type: 'interval', label: `${settings?.scrapingInterval ?? 60} minutes` };
        }

        const lines = settings.daemonSchedule.split(/[\n;]+/).map((l: string) => l.trim()).filter(Boolean);
        if (lines.length === 0) return { ms: fallbackMs, type: 'interval', label: `${settings?.scrapingInterval ?? 60} minutes` };

        const dayMap: Record<string, number> = { 'DIM': 0, 'LUN': 1, 'MAR': 2, 'MER': 3, 'JEU': 4, 'VEN': 5, 'SAM': 6 };
        
        const now = new Date();
        const currentDay = now.getDay();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let bestDelayMs = Infinity;
        let bestTargetLabel = '';

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
                        // C'est aujourd'hui et dans le futur
                        const delayMs = minutesDiff * 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());
                        if (delayMs < bestDelayMs) {
                            bestDelayMs = delayMs;
                            bestTargetLabel = `Aujourd'hui à ${time}`;
                        }
                    } else if (daysDiff > 0) {
                        // C'est un autre jour
                        const delayMs = (daysDiff * 24 * 60 + minutesDiff) * 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());
                        if (delayMs < bestDelayMs) {
                            bestDelayMs = delayMs;
                            bestTargetLabel = `${cleanD} à ${time}`;
                        }
                    }
                }
            }
        }

        if (bestDelayMs !== Infinity) {
            return { ms: bestDelayMs, type: 'schedule', label: bestTargetLabel };
        }

        return { ms: fallbackMs, type: 'interval', label: `${settings?.scrapingInterval ?? 60} minutes` };
    };

    // 1. Boucle du Pipeline Principal (Scraping & IA)
    const runMainCycle = async () => {
        try {
            await runPipeline();
        } catch (err) {
            logger.error("Daemon", `Crash dans le cycle principal : ${err}`);
        }

        // Planification du prochain cycle
        const settings = await prisma.globalSettings.findFirst();
        const nextScan = getDelayToNextScan(settings);

        logger.info("Daemon", `⏳ Prochain scan programmé : ${nextScan.label} (${Math.round(nextScan.ms / 60000)} min).`);
        setTimeout(runMainCycle, nextScan.ms);
    };

    // 2. Boucle Indépendante de la Tour de Contrôle (Node 7: Publisher)
    const runPublisherCycle = async () => {
        try {
            await runPublisherNode();
        } catch (err) {
            logger.error("Daemon", `Erreur dans la boucle Publisher : ${err}`);
        }

        // On tourne toutes les 2 minutes pour la réactivité du scheduling
        setTimeout(runPublisherCycle, 2 * 60 * 1000);
    };

    // Lancement des boucles
    runMainCycle();
    runPublisherCycle();
}

// Interception propre pour PM2 (arrêt propre du daemon)
process.on('SIGTERM', async () => {
    console.log("[Daemon] 🛑 Signal SIGTERM reçu, fermeture propre...");
    await prisma.$disconnect();
    process.exit(0);
});

main().catch(async (e) => {
    console.error("[Daemon] 💥 Crash fatal :", e);
    await prisma.$disconnect();
    process.exit(1);
});