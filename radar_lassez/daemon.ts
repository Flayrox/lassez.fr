import { prisma } from './lib/prisma';
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
        console.log("[Daemon] ⚠️ Aucune configuration GlobalSettings trouvée.");
        console.log("[Daemon] ⚙️ Initialisation avec les valeurs par défaut de L'Assez...");
        await prisma.globalSettings.create({
            data: {} // Les valeurs @default de schema.prisma prendront le relais
        });
        console.log("[Daemon] ✅ GlobalSettings initialisées.");
    } else {
        console.log("[Daemon] ⚙️ GlobalSettings chargées.");
    }
}

async function runPipeline() {
    console.log(`\n[Daemon] 🚀 [${new Date().toISOString()}] Démarrage d'un cycle du pipeline V3...`);
    try {
        const settings = await prisma.globalSettings.findFirst();
        if (!settings) throw new Error("Les paramètres globaux sont introuvables.");

        console.log(`[Daemon] 🧠 Modèles AI ciblés : ${settings.aiModelFlash} (Rapide) / ${settings.aiModelPro} (Édito)`);
        console.log(`[Daemon] ⚙️  Tâches concurrentes max : ${settings.maxConcurrentTasks}`);
        
        // ==========================================
        // ORCHESTRATION DES NODES (PHASE 1 & 2)
        // ==========================================
        
        console.log(`\n[Daemon] 📡 Lancement du Node 1: Ingestion...`);
        const rawArticles = await runIngestionNode(12);

        if (rawArticles.length > 0) {
            console.log(`[Daemon] 📊 [Ingestion] ${rawArticles.length} articles bruts aspirés avec succès.`);
            
            console.log(`\n[Daemon] 🗑️ Lancement du Node 2: Deduplicator...`);
            await runDeduplicatorNode(rawArticles);
            console.log(`[Daemon] 💾 [Deduplicator] Opération terminée. Les "Topics" uniques ont été ajoutés à la base de données.`);

            // ==========================================
            // ORCHESTRATION DES NODES (PHASE 3 & 4 : IA)
            // ==========================================
            console.log(`\n[Daemon] 🤖 Lancement du Node 3: Researcher (IA Flash)...`);
            await runResearcherNode();
            console.log(`[Daemon] 🧠 [Researcher] L'Intelligence Artificielle a terminé son arbitrage.`);
            
            console.log(`\n[Daemon] ✍️ Lancement du Node 4: Editorialist (IA Pro)...`);
            await runEditorialistNode();
            console.log(`[Daemon] 📰 [Editorialist] La rédaction finale est achevée.`);

            console.log(`\n[Daemon] 📸 Lancement du Node 5: Media Enrichment...`);
            await runMediaNode();
            console.log(`[Daemon] 🖼️ [Media] Les images ont été assignées et les articles sont PENDING.`);

            // Note: Le Node 6 (Publisher) s'exécute désormais de manière asynchrone et indépendante
            // dans sa propre routine (Tour de Contrôle) pour gérer les files d'attente (Scheduling).

        } else {
            console.log(`[Daemon] 🤷‍♂️ [Ingestion] Aucun nouvel article dans la fenêtre temporelle. Saut des étapes suivantes.`);
        }

        console.log(`\n[Daemon] ✅ Cycle terminé avec succès.`);

    } catch (error) {
        console.error("[Daemon] ❌ Erreur critique lors du cycle:", error);
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