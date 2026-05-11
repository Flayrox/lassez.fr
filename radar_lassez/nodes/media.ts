import { prisma } from '../lib/prisma';
import pLimit from 'p-limit';
import * as google from 'googlethis';
import { getEffectiveParam } from '../lib/config-resolver';

export async function runMediaNode() {
    console.log(`\n📸 [Node 5: Media] Démarrage de la recherche d'images (OSINT)`);

    // 1. Récupérer les NewsTopic au statut VALIDATED (approuvés par le Node 5)
    const validatedTopics = await prisma.newsTopic.findMany({
        where: { status: 'VALIDATED' },
    });

    if (validatedTopics.length === 0) {
        console.log(`📸 [Node 6: Media] Aucun topic en statut VALIDATED à traiter.`);
        return;
    }

    const allowGlobalImages = await getEffectiveParam('media', 'allowSourceImages', true);
    console.log(`📸 [Node 6: Media] ${validatedTopics.length} topics prêts pour l'enrichissement média.`);

    // 2. Limiteur de concurrence restrictif
    const limit = pLimit(2);

    const tasks = validatedTopics.map(topic => limit(async () => {
        try {
            if (!topic.final_draft) {
                console.log(`📸 [Node 5: Media] ⚠️ Le topic ${topic.id} n'a pas de final_draft. Ignoré.`);
                return;
            }

            // 3. Vérification de la configuration Globale/Node
            if (!allowGlobalImages) {
                console.log(`📸 [Node 6: Media] ⚠️ allowSourceImages désactivé. Passage en PENDING.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
                return;
            }

            // 4. Vérification de la configuration par SOURCE (Granulaire)
            // On regarde l'article principal dans raw_data
            const rawData = JSON.parse(topic.raw_data);
            const primaryArticle = rawData.articles?.[0];
            
            if (primaryArticle && primaryArticle.allowSourceImages === false) {
                console.log(`📸 [Node 5: Media] 🚫 Source "${primaryArticle.source_name}" interdit les images. Passage en PENDING.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
                return;
            }

            // 5. Parser le final_draft pour extraire image_search_queries
            const draftData = typeof topic.final_draft === 'string' 
                ? JSON.parse(topic.final_draft) 
                : topic.final_draft;

            const queries = draftData.image_search_queries;
            if (!queries || !Array.isArray(queries) || queries.length === 0) {
                console.log(`📸 [Node 5: Media] ⚠️ Aucune image_search_queries trouvée pour le topic ${topic.id}. Topic passé en PENDING sans image.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
                return;
            }

            let selectedImageUrl: string | null = null;
            let usedQuery = "";

            // Domaines bannis
            const bannedKeywords = [
                'instagram.com', 'facebook.com', 'pinterest.com', 'tiktok.com', 'twitter.com', 'x.com',
            ];

            // Itération sur les "Tirs" fournis par l'IA
            for (const requete of queries) {
                if (!requete || typeof requete !== 'string') continue;
                console.log(`📸 [Node 5: Media] 🎯 Tir pour le topic [${topic.id}] avec la requête : "${requete}"`);
                
                try {
                    const images = await google.image(requete, { safe: false });
                    for (const img of images) {
                        if (img.url && typeof img.url === 'string') {
                            const smallUrl = img.url.toLowerCase();
                            const originUrl = (img as any).origin?.url ? (img as any).origin.url.toLowerCase() : '';
                            const isBanned = bannedKeywords.some(banned => 
                                smallUrl.includes(banned) || originUrl.includes(banned)
                            );
                            
                            if (!isBanned) {
                                selectedImageUrl = img.url;
                                usedQuery = requete;
                                break;
                            }
                        }
                    }
                    if (selectedImageUrl) break;
                } catch(err) {
                    console.log(`📸 [Node 5: Media] ⚠️ Erreur Google sur "${requete}" :`, err instanceof Error ? err.message : err);
                }
            }

            if (selectedImageUrl) {
                console.log(`📸 [Node 5: Media] ✅ Image trouvée (Tir: "${usedQuery}") pour [${topic.id}]`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: {
                        image_url: selectedImageUrl,
                        status: 'PENDING'
                    }
                });
            } else {
                console.log(`📸 [Node 5: Media] ❌ Aucune image trouvée. Passage en PENDING.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
            }

        } catch (error) {
            console.error(`📸 [Node 5: Media] ❌ Erreur fatale sur topic ${topic.id}:`, error);
        }
    }));

    await Promise.all(tasks);
    console.log(`📸 [Node 5: Media] Fin du traitement.`);
}
