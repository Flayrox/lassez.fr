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
            rawArticles = await runIngestionNode(settings.rss_lookback_hours || 12);
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
    console.log("==========================================");
    console.log("   L'ASSEZ V3 - INVESTIGATION DAEMON      ");
    console.log("==========================================");

    await ensureGlobalSettings();

    // 1. Boucle du Pipeline Principal (Scraping & IA)
    const runMainCycle = async () => {
        try {
            await runPipeline();
        } catch (err) {
            logger.error("Daemon", `Crash dans le cycle principal : ${err}`);
        }

        // Planification du prochain cycle
        const settings = await prisma.globalSettings.findFirst();
        const intervalMinutes = settings?.scrapingInterval ?? 60;
        const intervalMs = intervalMinutes * 60 * 1000;

        logger.info("Daemon", `⏳ Prochain scan complet programmé dans ${intervalMinutes} minutes.`);
        setTimeout(runMainCycle, intervalMs);
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