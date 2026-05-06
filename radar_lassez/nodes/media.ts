import { prisma } from '../lib/prisma';
import pLimit from 'p-limit';
import * as google from 'googlethis';

export async function runMediaNode() {
    console.log(`\n📸 [Node 5: Media] Démarrage de la recherche d'images (OSINT)`);

    // 1. Récupérer les NewsTopic au statut DRAFTED
    const draftedTopics = await prisma.newsTopic.findMany({
        where: { status: 'DRAFTED' },
    });

    if (draftedTopics.length === 0) {
        console.log(`📸 [Node 5: Media] Aucun topic en statut DRAFTED à traiter.`);
        return;
    }

    console.log(`📸 [Node 5: Media] ${draftedTopics.length} topics prêts pour l'enrichissement média.`);

    // 2. Limiteur de concurrence très restrictif pour éviter les bans IP de Google (2 ou 3)
    const limit = pLimit(2);

    const tasks = draftedTopics.map(topic => limit(async () => {
        try {
            if (!topic.final_draft) {
                console.log(`📸 [Node 5: Media] ⚠️ Le topic ${topic.id} n'a pas de final_draft. Ignoré.`);
                return;
            }

            // 3. Parser le final_draft pour extraire image_search_queries
            const draftData = typeof topic.final_draft === 'string' 
                ? JSON.parse(topic.final_draft) 
                : topic.final_draft;

            const queries = draftData.image_search_queries;
            if (!queries || !Array.isArray(queries) || queries.length === 0) {
                console.log(`📸 [Node 5: Media] ⚠️ Aucune image_search_queries trouvée pour le topic ${topic.id}. Topic passé en PENDING sans image.`);
                // Mise à jour quand même pour ne pas bloquer le pipeline
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
                return;
            }

            let selectedImageUrl: string | null = null;
            let usedQuery = "";

            // Domaines et mots-clés bannis (Réseaux sociaux, Banques d'images à watermark)
            const bannedKeywords = [
                'instagram.com', 'facebook.com', 'pinterest.com', 'tiktok.com', 'twitter.com', 'x.com',
                'gettyimages', 'shutterstock', 'istockphoto', 'alamy', 'freepik', '123rf', 'dreamstime',
                'depositphotos', 'unsplash', 'pexels', 'pixabay', 'logo', 'icon', 'favicon'
            ];

            // Itération sur les "Tirs" fournis par l'IA
            for (const requete of queries) {
                if (!requete || typeof requete !== 'string') continue;
                
                console.log(`📸 [Node 5: Media] 🎯 Tir pour le topic [${topic.id}] avec la requête : "${requete}"`);
                
                try {
                    // 4. Utilisation de googlethis pour récupérer l'image
                    const images = await google.image(requete, { safe: false });

                    // 5. Filtrer pour trouver la première URL d'image valide
                    for (const img of images) {
                        if (img.url && typeof img.url === 'string') {
                            const smallUrl = img.url.toLowerCase();
                            
                            // On vérifie aussi l'URL du site source si disponible
                            const originUrl = img.origin?.url ? img.origin.url.toLowerCase() : '';
                            
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

                    if (selectedImageUrl) {
                        break; // On a trouvé une super image, on arrête l'entonnoir !
                    } else {
                        console.log(`📸 [Node 5: Media] ❌ Le Tir "${requete}" n'a rien donné de valide (images bannies ou introuvables). Passage au tir suivant...`);
                    }
                } catch(err) {
                    console.log(`📸 [Node 5: Media] ⚠️ Erreur Google sur la requête "${requete}" :`, err instanceof Error ? err.message : err);
                }
            }

            if (selectedImageUrl) {
                console.log(`📸 [Node 5: Media] ✅ Image trouvée (grâce au Tir: "${usedQuery}") pour le topic [${topic.id}] : ${selectedImageUrl}`);

                // 6. Mise à jour dans la base de données
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: {
                        image_url: selectedImageUrl,
                        status: 'PENDING'
                    }
                });
            } else {
                console.log(`📸 [Node 5: Media] ❌ AUCUNE image trouvée ou valide après ${queries.length} tirs. Topic passé en PENDING sans image.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
            }

        } catch (error) {
            console.error(`📸 [Node 5: Media] ❌ Erreur lors du scraping pour le topic ${topic.id}:`, error);
        }
    }));

    await Promise.all(tasks);
    console.log(`📸 [Node 5: Media] Fin du traitement. Les topics ont été passés en statut PENDING.`);
}
