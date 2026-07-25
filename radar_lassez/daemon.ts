import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { runIngestionNode } from './nodes/ingestion';
import { runDeduplicatorNode } from './nodes/deduplicator';
import { runResearcherNode } from './nodes/researcher';
import { runEditorialistNode } from './nodes/editorialist';
import { runValidatorNode } from './nodes/validator';
import { runMediaNode } from './nodes/media';
import { runPublisherNode } from './nodes/publisher';

/**
 * Initialise et s'assure de la présence de la configuration globale (GlobalSettings)
 * dans la base de données PostgreSQL de Radar.
 */
async function ensureGlobalSettings() {
    const settingsCount = await prisma.globalSettings.count();
    
    if (settingsCount === 0) {
        logger.warn("Daemon", "Aucune configuration GlobalSettings trouvée. Initialisation des paramètres par défaut...");
        await prisma.globalSettings.create({
            data: {} // Utilise les valeurs par défaut définies dans le schéma Prisma
        });
        logger.success("Daemon", "GlobalSettings initialisées avec succès.");
    } else {
        logger.info("Daemon", "GlobalSettings chargées.");
    }
}

/**
 * Exécute un cycle complet du pipeline d'investigation V3
 * 
 * Le pipeline orchestre 6 étapes séquentielles :
 * 1. Ingestion : Aspiration des flux RSS, Google News et Telegram
 * 2. Deduplicator : Détection et élimination des doublons
 * 3. Researcher : Analyse de pertinence et scoring de viralité via IA Flash (Gemini Flash)
 * 4. Editorialist : Rédaction d'articles d'investigation via IA Pro (Gemini Pro)
 * 5. Validator : Contrôle de conformité et vérification des faits
 * 6. Media : Enrichissement visuel (génération d'images / Unsplash)
 */
export async function runPipeline() {
    logger.info("Daemon", "🚀 Démarrage d'un nouveau cycle du pipeline V3...");
    try {
        const settings = await prisma.globalSettings.findFirst();
        if (!settings) throw new Error("Les paramètres globaux sont introuvables.");

        // Charger et vérifier les nœuds actifs dans le graphe de traitement
        let activeNodes = new Set(['ingestion', 'dedup', 'research', 'editor', 'media', 'publisher']);
        if (settings.pipelineGraphJson && settings.pipelineGraphJson.trim() !== '' && settings.pipelineGraphJson !== '{}' && settings.pipelineGraphJson !== '[]') {
            try {
                const graph = JSON.parse(settings.pipelineGraphJson);
                if (!graph || !Array.isArray(graph.nodes)) {
                    throw new Error(`Format inattendu : "nodes" est absent ou invalide`);
                }
                activeNodes = new Set(graph.nodes.map((n: any) => n.type).filter(Boolean));
                logger.info("Daemon", `📊 Graphe dynamiquement chargé : ${graph.nodes.length} nœuds actifs.`);
            } catch (e: any) {
                logger.warn("Daemon", `⚠️ Erreur de lecture du graphe, bascule en mode standard : ${e.message}`);
            }
        }

        logger.info("Daemon", `🧠 Modèles IA : ${settings.aiModelFlash} (Analyse Rapide) / ${settings.aiModelPro} (Rédaction Éditologique)`);
        
        let rawArticles: any[] = [];
        if (activeNodes.has('ingestion')) {
            logger.info("Node 1", "📡 Lancement du nœud d'Ingestion multi-sources...");
            rawArticles = await runIngestionNode(settings.scrapingInterval ? Math.max(1, Math.round(settings.scrapingInterval / 60)) : 12);
        } else {
            logger.info("Daemon", "⏭️ Nœud Ingestion désactivé dans le graphe. Étape ignorée.");
        }

        if (rawArticles.length > 0) {
            logger.success("Node 1", `${rawArticles.length} nouveaux articles aspirés.`);
            
            if (activeNodes.has('dedup')) {
                logger.info("Node 2", "🗑️ Lancement du Deduplicator (Élimination des doublons)...");
                await runDeduplicatorNode(rawArticles);
                logger.success("Node 2", "Dédoublonnage achevé.");
            }

            if (activeNodes.has('research')) {
                logger.info("Node 3", "🤖 Lancement du Researcher (IA Flash / Scoring & Filtrage)...");
                await runResearcherNode();
                logger.success("Node 3", "Scoring IA achevé.");
            }
            
            if (activeNodes.has('editor')) {
                logger.info("Node 4", "✍️ Lancement de l'Editorialist (IA Pro / Rédaction d'investigation)...");
                await runEditorialistNode();
                logger.success("Node 4", "Rédaction d'articles terminée.");
            }

            if (activeNodes.has('validator')) {
                logger.info("Node 5", "⚖️ Lancement du Validator (Vérification et sécurité)...");
                await runValidatorNode();
                logger.success("Node 5", "Validation terminée.");
            }

            if (activeNodes.has('media')) {
                logger.info("Node 6", "📸 Lancement du Media Enrichment (Création et assignation visuelle)...");
                await runMediaNode();
                logger.success("Node 6", "Enrichissement médias terminé.");
            }

        } else if (activeNodes.has('ingestion')) {
            logger.info("Node 1", "ℹ️ Aucun nouvel article détecté. Passage au cycle suivant.");
        }

        logger.success("Daemon", "✅ Cycle du pipeline terminé avec succès.");

    } catch (error: any) {
        logger.error("Daemon", `❌ Erreur critique dans le pipeline : ${error.message}`);
    }
}

/**
 * Point d'entrée principal du démon d'automatisation Radar
 */
async function main() {
    logger.overrideConsole();
    
    console.log("==========================================");
    console.log("   L'ASSEZ V3 - DEMON AUTOMATE RADAR     ");
    console.log("==========================================");

    await ensureGlobalSettings();

    /**
     * Calcule le délai exact avant le prochain scan selon le mode (Pulse ou Calendrier)
     */
    const getDelayToNextScan = (settings: any) => {
        const fallbackMs = (settings?.scrapingInterval ?? 60) * 60 * 1000;
        const mode = settings?.schedulingMode || 'hybrid';
        
        if (mode === 'pulse') {
            return { ms: fallbackMs, type: 'interval', label: `${settings?.scrapingInterval ?? 60} minutes` };
        }

        const hasNoSchedule = (!settings?.daemonSchedule || settings.daemonSchedule.trim() === '[]' || settings.daemonSchedule.trim() === '{}');

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
                        const delayMs = minutesDiff * 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());
                        if (delayMs < bestDelayMs) {
                            bestDelayMs = delayMs;
                            bestTargetLabel = `Aujourd'hui à ${time}`;
                        }
                    } else if (daysDiff > 0) {
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

    // 1. Boucle principale d'ingestion et de rédaction
    const runMainCycle = async () => {
        try {
            await runPipeline();
        } catch (err) {
            logger.error("Daemon", `Crash dans le cycle principal : ${err}`);
        }

        const settings = await prisma.globalSettings.findFirst();
        const nextScan = getDelayToNextScan(settings);

        logger.info("Daemon", `⏳ Prochain scan programmé : ${nextScan.label} (${Math.round(nextScan.ms / 60000)} min).`);
        setTimeout(runMainCycle, nextScan.ms);
    };

    // 2. Boucle indépendante de la tour de contrôle (Publisher / Publication Réseaux & CMS)
    const runPublisherCycle = async () => {
        try {
            await runPublisherNode();

            // Heartbeat : Mise à jour du battement de cœur pour l'interface de contrôle Studio Radar
            const settings = await prisma.globalSettings.findFirst();
            if (settings) {
                await prisma.globalSettings.update({
                    where: { id: settings.id },
                    data: {
                        updatedAt: new Date()
                    }
                });
            }
        } catch (err) {
            logger.error("Daemon", `Erreur dans la boucle Publisher : ${err}`);
        }

        // Vérification toutes les 2 minutes pour la réactivité du calendrier de publication
        setTimeout(runPublisherCycle, 2 * 60 * 1000);
    };

    // Lancement simultané des deux boucles autonomes
    runMainCycle();
    runPublisherCycle();
}

// Gestion des signaux système PM2 pour un arrêt sans perte de données
process.on('SIGTERM', async () => {
    console.log("[Daemon] 🛑 Signal SIGTERM reçu, déconnexion propre de la base de données...");
    await prisma.$disconnect();
    process.exit(0);
});

main().catch(async (e) => {
    console.error("[Daemon] 💥 Crash fatal du démon :", e);
    await prisma.$disconnect();
    process.exit(1);
});