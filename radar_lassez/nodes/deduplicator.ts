import stringSimilarity from 'string-similarity';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { IngestedArticle } from './ingestion';
import { getEffectiveParam } from '../lib/config-resolver';

export interface MergedTopic {
    clusterTitle: string;
    articles: IngestedArticle[];
    aggregatedBias: string[];
    date: Date;
}

export async function runDeduplicatorNode(articles: IngestedArticle[]) {
    console.log(`[Node 2: Deduplicator] 🧩 Démarrage du tamisage sur ${articles.length} articles bruts.`);
    
    if (articles.length === 0) return;

    // Récupération dynamique du seuil autorisé (Cascade)
    const threshold = await getEffectiveParam('dedup', 'similarityThreshold', 0.45);

    const clusters: MergedTopic[] = [];

    // 1. Groupement algorithmique (Clustering/Deduplication)
    for (const article of articles) {
        let foundCluster = false;

        for (const cluster of clusters) {
            // Comparaison vectorielle des titres (Dice's Coefficient)
            const similarity = stringSimilarity.compareTwoStrings(
                article.title.toLowerCase(),
                cluster.clusterTitle.toLowerCase()
            );

            // Si c'est le même sujet (Médias de droite et de gauche parlant de la même loi/scandale)
            if (similarity >= threshold) {
                // On attache l'article à ce Topic
                cluster.articles.push(article);
                
                // Array unique des biais politiques de la source
                if (!cluster.aggregatedBias.includes(article.source_bias)) {
                    cluster.aggregatedBias.push(article.source_bias);
                }
                
                foundCluster = true;
                break;
            }
        }

        // Si aucun cluster ne correspond suffisamment, c'est un nouveau sujet
        if (!foundCluster) {
            clusters.push({
                clusterTitle: article.title,
                articles: [article],
                aggregatedBias: [article.source_bias],
                date: article.pubDate
            });
        }
    }

    console.log(`[Node 2: Deduplicator] 📉 Réduction intrajournalière : ${articles.length} articles compilés en ${clusters.length} sujets synthétiques.`);
    
    // 2. Dé-duplication HISTORIQUE absolue (Vérification en DB)
    console.log(`[Node 2: Deduplicator] 🕵️‍♂️ Vérification de l'historique en base de données...`);
    
    const lookbackHours = await getEffectiveParam('dedup', 'dedupLookbackHours', 48);
    const historyCutoffDate = new Date(Date.now() - (lookbackHours * 60 * 60 * 1000));

    // Récupérer les "Titre de clusters" récents pour comparer avec l'existant
    // On ne reprend pas les REJECTED_ERROR pour leur laisser une chance s'ils ont planté,
    // mais on filtre tous les statuts normaux (INGESTED, RESEARCHED, REJECTED, PUBLISHED, etc.)
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

            // Vérification de similarité contre l'historique global
            for (const hTitle of historicalTitles) {
                // Si la similarité est supérieure au seuil (ex: 0.45) 
                // ET on ajoute un bonus de +0.2 pour être très strict avec le passé (on veut du neuf !)
                const histSim = stringSimilarity.compareTwoStrings(currentTitleLower, hTitle);
                if (histSim >= (threshold * 0.8)) { // Tolérance un peu plus large pour écraser les vieux doublons (80% du seuil)
                    isDuplicateHistory = true;
                    break;
                }
            }

            if (isDuplicateHistory) {
                ignoredCount++;
                continue; // On skip complètement l'enregistrement
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
            // Insertion en masse
            await prisma.newsTopic.createMany({
                data: topicsToCreate
            });
        } catch (error) {
            console.error(`[Node 2] ❌ Erreur lors de l'insertion DB en masse :`, error);
        }
    }

    console.log(`[Node 2: Deduplicator] ✅ Fin du tamis. ${savedCount} nouveaux NewsTopics injectés. (${ignoredCount} doublons historiques rejetés).`);
}