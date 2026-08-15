import { payloadClient } from '../lib/payload-client';
import { getEffectiveParam } from '../lib/config-resolver';
import { TwitterApi } from 'twitter-api-v2';
import { BskyAgent } from '@atproto/api';

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

    const pendingTopics = await payloadClient.getPendingSignalsWithoutPublications();

    if (pendingTopics.length > 0) {
        console.log(`🚀 [Node 6: Phase A] 📤 ${pendingTopics.length} nouveaux articles à programmer.`);

        // Bascule atomique PENDING → QUEUED (les topics récupérés n'ont pas de publication)
        await payloadClient.updateManySignals(
            pendingTopics.map(t => t.id),
            { status: 'QUEUED' }
        );

        const platforms = [];
        if (enableDiscord) platforms.push({ name: 'DISCORD', mode: await getEffectiveParam('publisher', 'discordPublishMode', 'DIRECT') });
        if (enableX) platforms.push({ name: 'X', mode: await getEffectiveParam('publisher', 'xPublishMode', 'SCHEDULED') });
        if (enableBluesky) platforms.push({ name: 'BLUESKY', mode: await getEffectiveParam('publisher', 'blueskyPublishMode', 'SCHEDULED') });
        if (enableMastodon) platforms.push({ name: 'MASTODON', mode: await getEffectiveParam('publisher', 'mastodonPublishMode', 'SCHEDULED') });
        if (enablePayloadCMS) platforms.push({ name: 'PAYLOAD', mode: await getEffectiveParam('publisher', 'payloadPublishMode', 'DIRECT') });

        const lastScheduledDates: Record<string, Date> = {};
        for (const p of platforms) {
            if (p.mode === 'SCHEDULED') {
                const lastPub = await payloadClient.getLastScheduledPublication(p.name);
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
            await payloadClient.createPublications(publicationsToCreate);
            console.log(`🚀 [Node 6: Phase A] ✅ ${publicationsToCreate.length} missions créées dans Payload.`);
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

    const duePublications = await payloadClient.getDuePublications(10);

    if (duePublications.length === 0) {
        console.log(`🚀 [Node 6: Phase B] 📭 Aucune publication en attente pour l'instant.`);
        return;
    }

    console.log(`🚀 [Node 6: Phase B] ⚡ ${duePublications.length} publications prêtes à être expédiées.`);

    for (const pub of duePublications) {
        try {
            const topic = pub.topic || await payloadClient.getSignal(pub.topicId);
            if (!topic) {
                console.error(`🚀 [Node 6: Phase B] ❌ Topic introuvable pour la publication ${pub.id}`);
                await payloadClient.updatePublication(pub.id, { status: 'FAILED' });
                continue;
            }

            let draftData: any = {};
            try {
                draftData = JSON.parse(topic.final_draft || '{}');
            } catch (e) {
                console.error(`🚀 [Node 6: Phase B] ❌ Erreur parsing final_draft pour topic ${topic.id}`);
                await payloadClient.updatePublication(pub.id, { status: 'FAILED' });
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
                    const origin = payloadClient.apiBase.replace(/\/api\/payload$/, '');
                    const token = await payloadClient.getToken();
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
                                        const searchRes = await fetch(`${origin}/api/payload/tags?where[name][equals]=${encodeURIComponent(cleanName)}`);
                                        const searchData = await searchRes.json();
                                        if (searchData.docs && searchData.docs.length > 0) {
                                            tagIds.push(searchData.docs[0].id);
                                        } else {
                                            const createRes = await fetch(`${origin}/api/payload/tags`, {
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

                    const revelationRes = await fetch(`${origin}/api/payload/revelations`, {
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
                await payloadClient.updatePublication(pub.id, {
                    status: 'PUBLISHED',
                    publishedAt: new Date()
                });

                const remaining = await payloadClient.countPendingPublications(topic.id);
                if (remaining === 0) {
                    await payloadClient.updateSignal(topic.id, {
                        status: 'PUBLISHED',
                        publishedAt: new Date()
                    });
                }
            } else {
                await payloadClient.updatePublication(pub.id, {
                    status: 'FAILED'
                });
            }

            // Pause anti-rate-limit entre les envois (2 secondes)
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e: any) {
            console.error(`🚀 [Node 6: Phase B] ❌ Erreur lors de la diffusion de la publication ${pub.id}:`, e.message);
            try {
                await payloadClient.updatePublication(pub.id, { status: 'FAILED' });
            } catch (err) { }
        }
    }
}
