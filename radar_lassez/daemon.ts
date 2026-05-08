import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { runIngestionNode } from './nodes/ingestion';
import { runDeduplicatorNode } from './nodes/deduplicator';
import { runResearcherNode } from './nodes/researcher';
import { runEditorialistNode } from './nodes/editorialist';
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

        logger.info("Daemon", `🧠 Modèles AI : ${settings.aiModelFlash} (Rapide) / ${settings.aiModelPro} (Édito)`);
        
        logger.info("Node 1", "📡 Lancement de l'Ingestion...");
        const rawArticles = await runIngestionNode(12);

        if (rawArticles.length > 0) {
            logger.success("Node 1", `${rawArticles.length} articles aspirés.`);
            
            logger.info("Node 2", "🗑️ Lancement du Deduplicator...");
            await runDeduplicatorNode(rawArticles);
            logger.success("Node 2", "Opération terminée.");

            logger.info("Node 3", "🤖 Lancement du Researcher (IA Flash)...");
            await runResearcherNode();
            logger.success("Node 3", "Arbitrage IA terminé.");
            
            logger.info("Node 4", "✍️ Lancement de l'Editorialist (IA Pro)...");
            await runEditorialistNode();
            logger.success("Node 4", "Rédaction achevée.");

            logger.info("Node 5", "📸 Lancement du Media Enrichment...");
            await runMediaNode();
            logger.success("Node 5", "Images assignées, articles PENDING.");

        } else {
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

    // 1. Exécution initiale au démarrage
    await runPipeline();

    // 2. Boucle du Pipeline Principal (Scraping & IA)
    const scheduleNextCycle = async () => {
        const settings = await prisma.globalSettings.findFirst();
        const intervalMinutes = settings?.scrapingInterval ?? 60;
        const intervalMs = intervalMinutes * 60 * 1000;

        console.log(`[Daemon] ⏳ Prochain scan complet (IA) programmé dans ${intervalMinutes} minutes.`);

        setTimeout(async () => {
            await runPipeline();
            scheduleNextCycle();
        }, intervalMs);
    };

    // 3. Boucle Indépendante de la Tour de Contrôle (Node 6: Publisher)
    // Elle tourne toutes les 2 minutes pour dépiler les publications atteignant leur scheduledAt
    const schedulePublisherCycle = async () => {
        const PUBLISHER_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

        setTimeout(async () => {
            try {
                await runPublisherNode();
            } catch (err) {
                console.error(`[Daemon] ❌ Erreur dans la boucle Publisher :`, err);
            } finally {
                schedulePublisherCycle(); 
            }
        }, PUBLISHER_INTERVAL_MS);
    };

    scheduleNextCycle();
    
    // On lance aussi immédiatement le publisher au démarrage pour purger la file d'attente
    await runPublisherNode();
    schedulePublisherCycle();
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