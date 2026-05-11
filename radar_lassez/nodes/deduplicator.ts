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

    console.log(`[Node 2: Deduplicator] 📉 Réduction drastique : ${articles.length} articles compilés en ${clusters.length} sujets synthétiques.`);
    console.log(`[Node 2: Deduplicator] 💾 Synchronisation asynchrone SQLite en cours...`);

    let savedCount = 0;

    // 2. Persistance dans la base de données (NewsTopic)
    // Ici, un Promise.all permet d'enregistrer massivement sans attendre la SQLite de block en block
    await Promise.all(clusters.map(async (cluster) => {
        try {
            await prisma.newsTopic.create({
                data: {
                    // Les contraintes SQLite nous obligent à stringifier les flux complexes (raw_data)
                    raw_data: JSON.stringify(cluster),
                    status: 'INGESTED',
                    tags: "[]"
                }
            });
            savedCount++;
        } catch (error) {
            console.error(`[Node 2] ❌ Erreur lors de l'insertion DB pour le topic "${cluster.clusterTitle}":`, error);
        }
    }));

    console.log(`[Node 2: Deduplicator] ✅ Fin du tamis. ${savedCount} NewsTopics (statut: INGESTED) mis en base.`);
}