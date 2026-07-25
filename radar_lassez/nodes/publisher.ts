import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';
import { TwitterApi } from 'twitter-api-v2';
import { BskyAgent } from '@atproto/api';

// Cache mémoire pour le jeton JWT Payload CMS
let cachedPayloadToken: string | null = null;
let payloadTokenExpiresAt: number = 0;

/**
 * Convertit une couleur au format Hexadécimal (#DC2626) en valeur entière pour Discord
 */
function hexToDecimal(hex: string): number {
    const cleanedHex = hex.replace('#', '');
    return parseInt(cleanedHex, 16);
}

/**
 * Génère un entier aléatoire dans une plage [min, max] pour espacer les publications
 */
function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Nœud 6 : Tour de Contrôle (Publisher / Diffusion & Réseaux Sociaux)
 * 
 * Orchestre en 2 phases distinctes :
 * Phase A (L'Enfileur) : Récupère les articles qualifiés (PENDING) et programme des missions
 *                         pour chaque réseau social (Discord, X/Twitter, Bluesky, Mastodon, Payload CMS).
 * Phase B (Le Diffuseur) : Déclenche les envois réels prévus à l'heure courante via les APIs tierces.
 */
export async function runPublisherNode() {
    console.log(`\n🚀 [Node 6: Publisher] Lancement de la Tour de Contrôle (Scheduling & Diffusion)`);

    // Chargement des paramètres de diffusion
    const enableDiscord = await getEffectiveParam('publisher', 'enableDiscord', true);
    const enableX = await getEffectiveParam('publisher', 'enableX', false);
    const enableMastodon = await getEffectiveParam('publisher', 'enableMastodon', false);
    const enableBluesky = await getEffectiveParam('publisher', 'enableBluesky', false);
    const enablePayloadCMS = await getEffectiveParam('publisher', 'enablePayloadCMS', true);
    
    const minDelay = await getEffectiveParam('publisher', 'minPublishDelay', 60);
    const maxDelay = await getEffectiveParam('publisher', 'maxPublishDelay', 120);
    const enableAutoPublish = await getEffectiveParam('publisher', 'enableAutoPublish', true);

    // ========================================================
    // PHASE A : CRÉATION DES MISSIONS DE PUBLICATION
    // ========================================================
    console.log(`🚀 [Node 6: Phase A] Recherche de nouveaux articles à planifier...`);

    const pendingTopics = await prisma.$transaction(async (tx) => {
        const topics = await tx.newsTopic.findMany({
            where: { 
                status: 'PENDING',
                publications: { none: {} }
            }
        });

        if (topics.length > 0) {
            await tx.newsTopic.updateMany({
                where: { id: { in: topics.map(t => t.id) } },
                data: { status: 'QUEUED' }
            });
        }

        return topics;
    });

    if (pendingTopics.length > 0) {
        console.log(`🚀 [Node 6: Phase A] 📤 ${pendingTopics.length} nouveaux articles à programmer.`);

        const platforms = [];
        if (enableDiscord) platforms.push({ name: 'DISCORD', mode: await getEffectiveParam('publisher', 'discordPublishMode', 'DIRECT') });
        if (enableX) platforms.push({ name: 'X', mode: await getEffectiveParam('publisher', 'xPublishMode', 'SCHEDULED') });
        if (enableBluesky) platforms.push({ name: 'BLUESKY', mode: await getEffectiveParam('publisher', 'blueskyPublishMode', 'SCHEDULED') });
        if (enableMastodon) platforms.push({ name: 'MASTODON', mode: await getEffectiveParam('publisher', 'mastodonPublishMode', 'SCHEDULED') });
        if (enablePayloadCMS) platforms.push({ name: 'PAYLOAD', mode: await getEffectiveParam('publisher', 'payloadPublishMode', 'DIRECT') });

        const lastScheduledDates: Record<string, Date> = {};
        for (const p of platforms) {
            if (p.mode === 'SCHEDULED') {
                const lastPub = await prisma.publication.findFirst({
                    where: { platform: p.name },
                    orderBy: { scheduledAt: 'desc' }
                });
                lastScheduledDates[p.name] = lastPub?.scheduledAt && lastPub.scheduledAt > new Date() ? lastPub.scheduledAt : new Date();
            } else {
                lastScheduledDates[p.name] = new Date();
            }
        }

        const publicationsToCreate = [];

        for (const topic of pendingTopics) {
            for (const platform of platforms) {
                let finalScheduledAt = new Date();

                if (platform.mode === "SCHEDULED") {
                    let baseDate = lastScheduledDates[platform.name];
                    const delayMinutes = getRandomInt(Number(minDelay), Number(maxDelay));
                    finalScheduledAt = new Date(baseDate.getTime() + delayMinutes * 60000);
                    lastScheduledDates[platform.name] = finalScheduledAt;
                }

                publicationsToCreate.push({
                    topicId: topic.id,
                    platform: platform.name,
                    status: 'PENDING',
                    scheduledAt: finalScheduledAt
                });
            }
        }

        if (publicationsToCreate.length > 0) {
            await prisma.publication.createMany({
                data: publicationsToCreate
            });
            console.log(`🚀 [Node 6: Phase A] ✅ ${publicationsToCreate.length} missions créées en base.`);
        }
    }

    // ========================================================
    // PHASE B : EXÉCUTION DES MISSIONS PRÊTES A PARTIR
    // ========================================================
    console.log(`🚀 [Node 6: Phase B] Vérification des publications programmées prêtes...`);

    if (!enableAutoPublish) {
        console.log(`🚀 [Node 6: Phase B] ⏸️ Pilote automatique désactivé (enableAutoPublish=false). Diffusion ignorée.`);
        return;
    }

    const duePublications = await prisma.publication.findMany({
        where: {
            status: 'PENDING',
            scheduledAt: { lte: new Date() }
        },
        include: { topic: true },
        take: 10
    });

    if (duePublications.length === 0) {
        console.log(`🚀 [Node 6: Phase B] 📭 Aucune publication en attente pour l'instant.`);
        return;
    }

    console.log(`🚀 [Node 6: Phase B] ⚡ ${duePublications.length} publications prêtes à être expédiées.`);

    for (const pub of duePublications) {
        try {
            const topic = pub.topic;
            let draftData: any = {};
            try {
                draftData = JSON.parse(topic.final_draft || '{}');
            } catch (e) {
                console.error(`🚀 [Node 6: Phase B] ❌ Erreur parsing final_draft pour topic ${topic.id}`);
                await prisma.publication.update({
                    where: { id: pub.id },
                    data: { status: 'FAILED' }
                });
                continue;
            }

            let isSuccess = false;

            // --- DIFFUSION DISCORD ---
            if (pub.platform === 'DISCORD') {
                const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
                if (!webhookUrl) {
                    console.error("🚀 [Node 6: Phase B] ❌ DISCORD_WEBHOOK_URL absente du fichier .env");
                } else {
                    const embed = {
                        title: draftData.headline || topic.taxonomy,
                        description: draftData.body || '',
                        color: hexToDecimal('#DC2626'),
                        fields: [
                            { name: 'Niveau d\'Alerte', value: topic.taxonomy || 'INFO', inline: true },
                            { name: 'Silo Éditorial', value: topic.geo || 'Global', inline: true }
                        ],
                        footer: { text: 'Radar L\'Assez • Investigation' },
                        timestamp: new Date().toISOString()
                    };

                    const discordRes = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ embeds: [embed] })
                    });

                    if (discordRes.ok) {
                        isSuccess = true;
                        console.log(`🚀 [Node 6: Phase B] ✅ [DISCORD] Message expédié avec succès pour le topic ${topic.id}`);
                    } else {
                        console.error(`🚀 [Node 6: Phase B] ❌ [DISCORD] Erreur HTTP ${discordRes.status}`);
                    }
                }
            }

            // --- DIFFUSION PAYLOAD CMS ---
            else if (pub.platform === 'PAYLOAD') {
                try {
                    const origin = 'https://api.lassez.fr';
                    
                    // Récupération ou rafraîchissement du jeton JWT Payload
                    if (!cachedPayloadToken || Date.now() > payloadTokenExpiresAt) {
                        const loginRes = await fetch(`${origin}/api/users/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: process.env.PAYLOAD_ADMIN_EMAIL || 'admin@lassez.fr',
                                password: process.env.PAYLOAD_ADMIN_PASSWORD || 'lassez2026'
                            })
                        });
                        const loginData = await loginRes.json();
                        if (loginData.token) {
                            cachedPayloadToken = loginData.token;
                            payloadTokenExpiresAt = Date.now() + (2 * 60 * 60 * 1000);
                        }
                    }

                    const token = cachedPayloadToken;
                    const contentPayload = draftData.body || '';
                    const topicGeo = topic.geo || 'FRANCE';
                    const topicTaxonomy = topic.taxonomy || 'INFO';
                    let niveauAlerte = 'standard';
                    if (topicTaxonomy.includes('URGENT') || topicTaxonomy.includes('FLASH')) niveauAlerte = 'flash';

                    let tagIds: string[] = [];
                    if (topic.tags) {
                        try {
                            const parsedTags = JSON.parse(topic.tags);
                            if (Array.isArray(parsedTags)) {
                                for (const tagName of parsedTags) {
                                    const cleanName = String(tagName).trim();
                                    if (cleanName) {
                                        const searchRes = await fetch(`${origin}/api/tags?where[name][equals]=${encodeURIComponent(cleanName)}`);
                                        const searchData = await searchRes.json();
                                        if (searchData.docs && searchData.docs.length > 0) {
                                            tagIds.push(searchData.docs[0].id);
                                        } else {
                                            const createRes = await fetch(`${origin}/api/tags`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', 'Authorization': `JWT ${token}` },
                                                body: JSON.stringify({ name: cleanName, slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-') })
                                            });
                                            const createData = await createRes.json();
                                            if (createData.doc?.id) tagIds.push(createData.doc.id);
                                        }
                                    }
                                }
                            }
                        } catch (e) { }
                    }

                    const revelationRes = await fetch(`${origin}/api/revelations`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `JWT ${token}`
                        },
                        body: JSON.stringify({
                            titre: draftData.headline,
                            _status: 'published',
                            contenu_rapide: contentPayload,
                            contenu_rapide_html: `<p>${draftData.body.replace(/\n/g, '<br>')}</p>`,
                            niveau_alerte: niveauAlerte,
                            zone_geo: topicGeo.toLowerCase() === 'france' ? 'france' : 'international',
                            tags: tagIds.length > 0 ? tagIds : undefined
                        })
                    });

                    if (revelationRes.ok) {
                        isSuccess = true;
                        console.log(`🚀 [Node 6: Phase B] ✅ [PAYLOAD] Révélation injectée dans Payload avec succès (Topic: ${topic.id})`);
                    } else {
                        const errorText = await revelationRes.text();
                        console.error(`🚀 [Node 6: Phase B] ❌ [PAYLOAD] Échec d'injection HTTP ${revelationRes.status} :`, errorText);
                    }
                } catch(e) {
                    console.error(`🚀 [Node 6: Phase B] ❌ [PAYLOAD] Erreur lors de l'injection :`, e);
                }
            }

            // Mise à jour du statut de publication
            if (isSuccess) {
                await prisma.publication.update({
                    where: { id: pub.id },
                    data: { status: 'PUBLISHED', publishedAt: new Date() }
                });

                const remaining = await prisma.publication.count({
                    where: { topicId: topic.id, status: 'PENDING' }
                });
                if (remaining === 0) {
                    await prisma.newsTopic.update({
                        where: { id: topic.id },
                        data: { status: 'PUBLISHED', publishedAt: new Date() }
                    });
                }
            } else {
                await prisma.publication.update({
                    where: { id: pub.id },
                    data: { status: 'FAILED' }
                });
            }

            // Pause anti-rate-limit entre les envois (2 secondes)
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`🚀 [Node 6: Phase B] ❌ Erreur sur la publication ${pub.id}:`, error);
        }
    }

    console.log(`🚀 [Node 6: Publisher] Cycle de diffusion achevé.`);
}
