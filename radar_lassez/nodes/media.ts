import { prisma } from '../lib/prisma';
import pLimit from 'p-limit';
import * as google from 'googlethis';
import { getEffectiveParam } from '../lib/config-resolver';

/**
 * Nœud 6 : Media Enrichment (Enrichissement Visuel OSINT / Image Search)
 * 
 * Recherche et assigne une illustration libre de droits et pertinente pour chaque article validé.
 * Élimine les répertoriations de réseaux sociaux ou domaines bannis avant de faire passer l'article en PENDING.
 */
export async function runMediaNode() {
    console.log(`\n📸 [Node 6: Media] Démarrage de la recherche d'images (OSINT / Google Images)`);

    const validatedTopics = await prisma.newsTopic.findMany({
        where: { status: 'VALIDATED' },
    });

    if (validatedTopics.length === 0) {
        console.log(`📸 [Node 6: Media] ℹ️ Aucun topic en statut VALIDATED à traiter.`);
        return;
    }

    const allowGlobalImages = await getEffectiveParam('media', 'allowSourceImages', true);
    console.log(`📸 [Node 6: Media] ${validatedTopics.length} sujets prêts pour l'enrichissement média.`);

    const limit = pLimit(2);

    const tasks = validatedTopics.map(topic => limit(async () => {
        try {
            if (!topic.final_draft) {
                console.log(`📸 [Node 6: Media] ⚠️ Le sujet ${topic.id} n'a pas de final_draft. Ignoré.`);
                return;
            }

            if (!allowGlobalImages) {
                console.log(`📸 [Node 6: Media] ⚠️ allowSourceImages désactivé. Passage direct en PENDING.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
                return;
            }

            let rawData: any = {};
            try { rawData = JSON.parse(topic.raw_data || '{}'); } catch (e) { }
            const primaryArticle = rawData.articles?.[0];
            
            if (primaryArticle && primaryArticle.allowSourceImages === false) {
                console.log(`📸 [Node 6: Media] 🚫 Source "${primaryArticle.source_name}" interdit les images. Passage en PENDING.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
                return;
            }

            const draftData = typeof topic.final_draft === 'string' 
                ? JSON.parse(topic.final_draft) 
                : topic.final_draft;

            const queries = draftData.image_search_queries || [topic.image_url, topic.taxonomy, 'investigation'];
            
            let selectedImageUrl: string | null = null;
            let usedQuery = "";

            const bannedKeywords = [
                'instagram.com', 'facebook.com', 'pinterest.com', 'tiktok.com', 'twitter.com', 'x.com',
            ];

            for (const requete of queries) {
                if (!requete || typeof requete !== 'string') continue;
                console.log(`📸 [Node 6: Media] 🎯 Recherche d'illustration pour [${topic.id}] avec la requête : "${requete}"`);
                
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
                } catch(err: any) {
                    console.log(`📸 [Node 6: Media] ⚠️ Recherche Google indisponible sur "${requete}" :`, err?.message || err);
                }
            }

            if (selectedImageUrl) {
                console.log(`📸 [Node 6: Media] ✅ Image assignée (Requête: "${usedQuery}") pour [${topic.id}]`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: {
                        image_url: selectedImageUrl,
                        status: 'PENDING'
                    }
                });
            } else {
                console.log(`📸 [Node 6: Media] ℹ️ Aucune image trouvée. Passage en PENDING avec visuel par défaut.`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'PENDING' }
                });
            }

        } catch (error: any) {
            console.error(`📸 [Node 6: Media] ❌ Erreur sur le topic ${topic.id}:`, error.message);
        }
    }));

    await Promise.all(tasks);
    console.log(`📸 [Node 6: Media] Traitement des médias terminé.`);
}
