import stringSimilarity from 'string-similarity';
import { prisma } from '../lib/prisma';
import { IngestedArticle } from './ingestion';
import { getEffectiveParam } from '../lib/config-resolver';

export interface MergedTopic {
    clusterTitle: string;
    articles: IngestedArticle[];
    aggregatedBias: string[];
    date: Date;
}

/**
 * Nœud 2 : Deduplicator (Tamisage & Dédoublonnage Algorithmique)
 * 
 * Regroupe les articles par similarité sémantique de titre (Dice's Coefficient).
 * Compare les clusters formés avec l'historique de la base de données (48h par défaut)
 * pour ne laisser passer que les nouveaux sujets d'investigation originaux.
 */
export async function runDeduplicatorNode(articles: IngestedArticle[]) {
    console.log(`[Node 2: Deduplicator] 🧩 Démarrage du tamisage sur ${articles.length} articles bruts.`);
    
    if (!articles || articles.length === 0) return;

    // Récupération dynamique du seuil autorisé (Cascade)
    const threshold = await getEffectiveParam('dedup', 'similarityThreshold', 0.45);

    const clusters: MergedTopic[] = [];

    // 1. Groupement algorithmique (Clustering/Deduplication)
    for (const article of articles) {
        let foundCluster = false;

        for (const cluster of clusters) {
            const similarity = stringSimilarity.compareTwoStrings(
                (article.title || '').toLowerCase(),
                (cluster.clusterTitle || '').toLowerCase()
            );

            if (similarity >= threshold) {
                cluster.articles.push(article);
                
                if (article.source_bias && !cluster.aggregatedBias.includes(article.source_bias)) {
                    cluster.aggregatedBias.push(article.source_bias);
                }
                
                foundCluster = true;
                break;
            }
        }

        if (!foundCluster) {
            clusters.push({
                clusterTitle: article.title,
                articles: [article],
                aggregatedBias: article.source_bias ? [article.source_bias] : ['Indépendant'],
                date: article.pubDate || new Date()
            });
        }
    }

    console.log(`[Node 2: Deduplicator] 📉 Réduction intrajournalière : ${articles.length} articles compilés en ${clusters.length} sujets synthétiques.`);
    
    // 2. Dé-duplication HISTORIQUE absolue (Vérification en DB)
    console.log(`[Node 2: Deduplicator] 🕵️‍♂️ Vérification de l'historique en base de données...`);
    
    const lookbackHours = await getEffectiveParam('dedup', 'dedupLookbackHours', 48);
    const historyCutoffDate = new Date(Date.now() - (lookbackHours * 60 * 60 * 1000));

    const historicalTopics = await prisma.newsTopic.findMany({
        where: {
            createdAt: { gte: historyCutoffDate }
        },
        select: { raw_data: true }
    });

    const historicalTitles: string[] = [];
    for (const h of historicalTopics) {
        try {
            const parsed = JSON.parse(h.raw_data);
            if (parsed && parsed.clusterTitle) {
                historicalTitles.push(parsed.clusterTitle.toLowerCase());
            }
        } catch (e) { }
    }

    let savedCount = 0;
    let ignoredCount = 0;

    // 3. Persistance dans la base de données (NewsTopic)
    const topicsToCreate = [];

    for (const cluster of clusters) {
        try {
            const currentTitleLower = cluster.clusterTitle.toLowerCase();
            let isDuplicateHistory = false;

            for (const hTitle of historicalTitles) {
                const histSim = stringSimilarity.compareTwoStrings(currentTitleLower, hTitle);
                if (histSim >= (threshold * 0.8)) {
                    isDuplicateHistory = true;
                    break;
                }
            }

            if (isDuplicateHistory) {
                ignoredCount++;
                continue;
            }

            topicsToCreate.push({
                raw_data: JSON.stringify(cluster),
                status: 'INGESTED',
                tags: "[]"
            });
            savedCount++;
        } catch (error) {
            console.error(`[Node 2] ❌ Erreur lors de la préparation pour le topic "${cluster.clusterTitle}":`, error);
        }
    }

    if (topicsToCreate.length > 0) {
        try {
            await prisma.newsTopic.createMany({
                data: topicsToCreate
            });
        } catch (error) {
            console.error(`[Node 2] ❌ Erreur lors de l'insertion DB en masse :`, error);
        }
    }

    console.log(`[Node 2: Deduplicator] ✅ Fin du tamis. ${savedCount} nouveaux NewsTopics injectés. (${ignoredCount} doublons historiques rejetés).`);
}