import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';
import { TwitterApi } from 'twitter-api-v2';
import { BskyAgent } from '@atproto/api';

// Fonction utilitaire pour convertir une couleur Hex (#DC2626) en décimal pour Discord
function hexToDecimal(hex: string): number {
    const cleanedHex = hex.replace('#', '');
    return parseInt(cleanedHex, 16);
}

// Générer un entier aléatoire entre min et max
function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function runPublisherNode() {
    console.log(`\n🚀 [Node 6: Publisher] Lancement de la Tour de Contrôle (Scheduling & Diffusion)`);

    // Résolution en cascade
    const enableDiscord = await getEffectiveParam('publisher', 'enableDiscord', true);
    const enableX = await getEffectiveParam('publisher', 'enableX', false);
    const enableMastodon = await getEffectiveParam('publisher', 'enableMastodon', false);
    const enableBluesky = await getEffectiveParam('publisher', 'enableBluesky', false);
    const enablePayloadCMS = await getEffectiveParam('publisher', 'enablePayloadCMS', true);
    
    const minDelay = await getEffectiveParam('publisher', 'minPublishDelay', 60);
    const maxDelay = await getEffectiveParam('publisher', 'maxPublishDelay', 120);
    const enableAutoPublish = await getEffectiveParam('publisher', 'enableAutoPublish', true);

    // ========================================================
    // PHASE A : CRÉATION DES MISSIONS (L'ENFILEUR)
    // ========================================================
    console.log(`🚀 [Node 6: Phase A] Recherche de nouveaux articles à planifier...`);

    const pendingTopics = await prisma.newsTopic.findMany({
        where: { 
            status: 'PENDING',
            publications: { none: {} } // Uniquement ceux sans aucune publication
        }
    });

    if (pendingTopics.length > 0) {
        console.log(`🚀 [Node 6: Phase A] 📤 ${pendingTopics.length} nouveaux articles à enfiler.`);

        for (const topic of pendingTopics) {
            // Déterminer les réseaux à provisionner
            const platforms = [];
            if (enableDiscord) platforms.push({ name: 'DISCORD', mode: await getEffectiveParam('publisher', 'discordPublishMode', 'DIRECT') });
            if (enableX) platforms.push({ name: 'X', mode: await getEffectiveParam('publisher', 'xPublishMode', 'SCHEDULED') });
            if (enableBluesky) platforms.push({ name: 'BLUESKY', mode: await getEffectiveParam('publisher', 'blueskyPublishMode', 'SCHEDULED') });
            if (enableMastodon) platforms.push({ name: 'MASTODON', mode: 'SCHEDULED' });
            if (enablePayloadCMS) platforms.push({ name: 'PAYLOAD', mode: 'DIRECT' });

            for (const platform of platforms) {
                let finalScheduledAt = new Date();

                if (platform.mode === "SCHEDULED") {
                    // Trouver la dernière publication programmée pour ce réseau
                    const lastPub = await prisma.publication.findFirst({
                        where: { platform: platform.name },
                        orderBy: { scheduledAt: 'desc' }
                    });

                    let baseDate = new Date();
                    if (lastPub && lastPub.scheduledAt > baseDate) {
                        baseDate = lastPub.scheduledAt;
                    }
                    
                    const delayMinutes = getRandomInt(Number(minDelay), Number(maxDelay));
                    finalScheduledAt = new Date(baseDate.getTime() + delayMinutes * 60000);
                }

                await prisma.publication.create({
                    data: {
                        topicId: topic.id,
                        platform: platform.name,
                        status: 'PENDING',
                        scheduledAt: finalScheduledAt
                    }
                });
                
                console.log(`🚀 [Node 6: Phase A] 📅 [${platform.name}] Planifié pour : ${finalScheduledAt.toLocaleString()}`);
            }

            // Bascule le Topic en QUEUED (il a été distribué en file d'attente)
            await prisma.newsTopic.update({
                where: { id: topic.id },
                data: { status: 'QUEUED' }
            });
        }
    } else {
        console.log(`🚀 [Node 6: Phase A] Aucun nouvel article à planifier.`);
    }

    // ========================================================
    // PHASE B : EXÉCUTION (LE DIFFUSEUR)
    // ========================================================
    if (!enableAutoPublish) {
        console.log(`🚀 [Node 6: Phase B] ⚠️ L'auto-publication (exécution) est DÉSACTIVÉE.`);
        return;
    }

    console.log(`🚀 [Node 6: Phase B] Inspection des publications dues...`);

    const now = new Date();
    const duePublications = await prisma.publication.findMany({
        where: {
            status: 'PENDING',
            scheduledAt: { lte: now }
        },
        include: { topic: true },
        orderBy: { scheduledAt: 'asc' }
    });

    if (duePublications.length === 0) {
        console.log(`🚀 [Node 6: Phase B] 💤 Aucune publication attendue pour le moment.`);
        return;
    }

    console.log(`🚀 [Node 6: Phase B] ⚡ ${duePublications.length} publications à exécuter maintenant.`);

    for (const pub of duePublications) {
        try {
            const topic = pub.topic;
            if (!topic.final_draft) continue;

            const draftData = typeof topic.final_draft === 'string' 
                ? JSON.parse(topic.final_draft) 
                : topic.final_draft;

            // =====================================================
            // DONNÉES CANONIQUES depuis la table NewsTopic
            // (Source de vérité maintenue par les Nodes 1-5)
            // =====================================================
            const accentColor = draftData.metadata?.accent_color ? hexToDecimal(draftData.metadata.accent_color) : 0x000000;
            const topicTaxonomy = topic.taxonomy || 'INFO'; // Source de vérité depuis la DB
            const topicTags = topic.tags ? JSON.parse(topic.tags) : []; // Source de vérité depuis la DB (JSON string parsé)
            const topicGeo = topic.geo || 'international'; // Source de vérité depuis la DB
            const topicImageUrl = topic.image_url; // Source de vérité depuis la DB

            const tagsString = topicTags.map((t: string) => `#${t}`).join(' ');
            const geoInfo = `📍 ${topicGeo.toUpperCase()}`;

            let isSuccess = false;

            // Base du texte pour les RS (contenu éditorial depuis final_draft)
            const rsText = `${draftData.headline}\n\n${draftData.body}\n\n${tagsString}`;

            // Logique de diffusion spécifique par plateforme
            if (pub.platform === 'DISCORD') {
                const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
                if (!webhookUrl) {
                    console.error(`🚀 [Node 6: Phase B] ❌ DISCORD_WEBHOOK_URL manquante pour pub ${pub.id}`);
                    continue;
                }

                const embed: any = {
                    title: draftData.headline || "ALERTE INFO",
                    description: `${draftData.body}\n\n${tagsString}`,
                    color: accentColor,
                    footer: { text: `Format: ${topicTaxonomy} | ${geoInfo} | ID: ${topic.id.slice(0, 8)}` },
                    timestamp: new Date().toISOString()
                };

                if (topicImageUrl) {
                    embed.image = { url: topicImageUrl };
                }

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] }),
                });

                if (response.ok || response.status === 204) {
                    isSuccess = true;
                    console.log(`🚀 [Node 6: Phase B] ✅ [DISCORD] Payload émis avec succès (Topic: ${topic.id})`);
                } else {
                    console.error(`🚀 [Node 6: Phase B] ❌ [DISCORD] Échec HTTP ${response.status}`);
                }

            } else if (pub.platform === 'X') {
                const appKey = process.env.TWITTER_API_KEY;
                const appSecret = process.env.TWITTER_API_SECRET;
                const accessToken = process.env.TWITTER_ACCESS_TOKEN;
                const accessSecret = process.env.TWITTER_ACCESS_SECRET;
                
                if (!appKey || !appSecret || !accessToken || !accessSecret) {
                    console.error(`🚀 [Node 6: Phase B] ❌ Variables X (Twitter) manquantes.`);
                    continue;
                }

                const twitterClient = new TwitterApi({
                    appKey, appSecret, accessToken, accessSecret
                });

                try {
                    await twitterClient.v2.tweet(rsText.slice(0, 280)); // X limit = 280
                    isSuccess = true;
                    console.log(`🚀 [Node 6: Phase B] ✅ [X] Tweet posté avec succès (Topic: ${topic.id})`);
                } catch(e) {
                    console.error(`🚀 [Node 6: Phase B] ❌ [X] Erreur API :`, e);
                }

            } else if (pub.platform === 'BLUESKY') {
                const identifier = process.env.BLUESKY_IDENTIFIER;
                const password = process.env.BLUESKY_APP_PASSWORD;

                if (!identifier || !password) {
                    console.error(`🚀 [Node 6: Phase B] ❌ Variables Bluesky manquantes.`);
                    continue;
                }

                const agent = new BskyAgent({ service: 'https://bsky.social' });
                try {
                    await agent.login({ identifier, password });
                    await agent.post({ text: rsText.slice(0, 300) }); // Bluesky limit = 300
                    isSuccess = true;
                    console.log(`🚀 [Node 6: Phase B] ✅ [BLUESKY] Posté avec succès (Topic: ${topic.id})`);
                } catch(e) {
                    console.error(`🚀 [Node 6: Phase B] ❌ [BLUESKY] Erreur API :`, e);
                }

            } else if (pub.platform === 'MASTODON') {
                const url = process.env.MASTODON_INSTANCE_URL;
                const token = process.env.MASTODON_ACCESS_TOKEN;

                if (!url || !token) {
                    console.error(`🚀 [Node 6: Phase B] ❌ Variables Mastodon manquantes.`);
                    continue;
                }

                try {
                    const response = await fetch(`${url}/api/v1/statuses`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            status: rsText,
                            visibility: 'public'
                        })
                    });

                    if (response.ok) {
                        isSuccess = true;
                        console.log(`🚀 [Node 6: Phase B] ✅ [MASTODON] Pouet posté avec succès (Topic: ${topic.id})`);
                    } else {
                        console.error(`🚀 [Node 6: Phase B] ❌ [MASTODON] Échec HTTP ${response.status}`);
                    }
                } catch(e) {
                    console.error(`🚀 [Node 6: Phase B] ❌ [MASTODON] Erreur :`, e);
                }

            } else if (pub.platform === 'PAYLOAD') {
                const url = process.env.PAYLOAD_SERVER_URL;
                const email = process.env.PAYLOAD_BOT_EMAIL;
                const password = process.env.PAYLOAD_BOT_PASSWORD;

                if (!url || !email || !password) {
                    console.error(`🚀 [Node 6: Phase B] ❌ Variables Payload CMS manquantes.`);
                    continue;
                }

                try {
                    // Login
                    const loginRes = await fetch(`${url}/api/users/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    
                    if (!loginRes.ok) {
                        console.error(`🚀 [Node 6: Phase B] ❌ [PAYLOAD] Erreur d'authentification.`);
                        continue;
                    }
                    const { token } = await loginRes.json();

                    // Extraire et préparer les données depuis le final_draft (contenu éditorial)
                    const contentPayload = {
                        root: {
                            type: 'root',
                            format: '',
                            indent: 0,
                            version: 1,
                            direction: 'ltr',
                            children: [
                                {
                                    type: 'paragraph',
                                    format: '',
                                    indent: 0,
                                    version: 1,
                                    direction: 'ltr',
                                    children: [{ type: 'text', text: draftData.body, format: 0, style: '', detail: 0, mode: 'normal', version: 1 }]
                                }
                            ]
                        }
                    };

                    // Mapper la taxonomie depuis la DB vers le champ niveau_alerte de Payload
                    const niveauAlerte = topicTaxonomy === 'ALERTE' ? 'Public' : 'Public';
                    
                    // Traiter les tags depuis la DB : chercher/créer les tags et récupérer leurs IDs
                    let tagIds: string[] = [];
                    if (topicTags && topicTags.length > 0) {
                        for (const tagName of topicTags) {
                            try {
                                // Chercher le tag existant
                                const tagSearchRes = await fetch(`${url}/api/tags?where[name][equals]=${encodeURIComponent(tagName)}`, {
                                    headers: { 'Authorization': `JWT ${token}` }
                                });

                                let tagId: string | null = null;

                                if (tagSearchRes.ok) {
                                    const tagSearchData = await tagSearchRes.json();
                                    if (tagSearchData.docs && tagSearchData.docs.length > 0) {
                                        tagId = tagSearchData.docs[0].id;
                                    }
                                }

                                // Si le tag n'existe pas, le créer
                                if (!tagId) {
                                    const tagCreateRes = await fetch(`${url}/api/tags`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `JWT ${token}`
                                        },
                                        body: JSON.stringify({ name: tagName })
                                    });

                                    if (tagCreateRes.ok) {
                                        const createdTag = await tagCreateRes.json();
                                        tagId = createdTag.doc?.id || createdTag.id;
                                    }
                                }

                                if (tagId) {
                                    tagIds.push(tagId);
                                }
                            } catch (tagErr) {
                                console.warn(`🚀 [Node 6: Phase B] ⚠️ [PAYLOAD] Erreur lors du traitement du tag "${tagName}"`, tagErr);
                            }
                        }
                    }

                    // Créer la révélation dans Payload (collection "revelations")
                    // Utilisant les données canoniques depuis la table NewsTopic
                    const revelationRes = await fetch(`${url}/api/revelations`, {
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
                        console.log(`🚀 [Node 6: Phase B] ✅ [PAYLOAD] Révélation injectée dans Payload (Taxonomie: ${topicTaxonomy} | Geo: ${topicGeo} | Tags: ${tagIds.length} | Topic: ${topic.id})`);
                    } else {
                        const errorText = await revelationRes.text();
                        console.error(`🚀 [Node 6: Phase B] ❌ [PAYLOAD] Échec d'injection HTTP ${revelationRes.status} :`, errorText);
                    }
                } catch(e) {
                    console.error(`🚀 [Node 6: Phase B] ❌ [PAYLOAD] Erreur Injection :`, e);
                }
            }

            // Met à jour la Publication
            if (isSuccess) {
                await prisma.publication.update({
                    where: { id: pub.id },
                    data: { status: 'PUBLISHED', publishedAt: new Date() }
                });

                // Optionnel : vérifier si on doit basculer le status du Topic global en PUBLISHED 
                // C-à-d s'il n'y a plus de publications 'PENDING' liées à ce Topic
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
                // En cas d'erreur de la plateforme, on passe à FAILED pour bloquer tout loop infini
                await prisma.publication.update({
                    where: { id: pub.id },
                    data: { status: 'FAILED' }
                });
            }

            // Pause pour éviter les rate limits (2 secondes)
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`🚀 [Node 6: Phase B] ❌ Erreur fatale sur pub ${pub.id}:`, error);
        }
    }

    console.log(`🚀 [Node 6: Publisher] Fin cycle Tour de Contrôle.`);
}
