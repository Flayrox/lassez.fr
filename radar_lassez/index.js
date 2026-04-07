import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import fs from 'fs';
import { generateSmartCacheImage } from './imageProcessor.js';
import FormData from 'form-data';
import { deduplicateItems } from './deduplicator.js';
import { searchArchives, extractEntitiesFromTitles, archiveDeclarations } from './politicalMemory.js';
import { detectVideoUrl, processVideo, cleanupVideoFiles } from './videoIngester.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = new Database(path.join(__dirname, 'radar.db'));

const CONFIG = {
    HISTORY_FILE: path.join(__dirname, 'historique.json'),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    WP_URL: (process.env.WP_URL || '').replace(/\/$/, ''),
    WP_USER: process.env.WP_USER,
    WP_PASSWORD: process.env.WP_PASSWORD,
    WP_CATEGORY_ID: 12
};

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['content:encoded', 'contentEncoded']
        ]
    }
});
const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);

// -- 0. CORE WORDPRESS (JWT PUSH) --
async function pushToWordPress(title, content) {
    if (!CONFIG.WP_URL || !CONFIG.WP_USER || !CONFIG.WP_PASSWORD) {
        console.error("⚠️ Identifiants WordPress manquants dans .env");
        return null;
    }

    try {
        const tokenResponse = await axios.post(`${CONFIG.WP_URL}/wp-json/jwt-auth/v1/token`, {
            username: CONFIG.WP_USER,
            password: CONFIG.WP_PASSWORD
        });
        const token = tokenResponse.data.token;

        const postResponse = await axios.post(`${CONFIG.WP_URL}/wp-json/wp/v2/posts`, {
            title: title,
            content: content,
            status: 'publish',
            categories: [CONFIG.WP_CATEGORY_ID]
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`🚀 Article publié sur WordPress ! ID: ${postResponse.data.id}`);
        return postResponse.data.id;
    } catch (err) {
        console.error("❌ Échec de publication WordPress :", err.response?.data?.message || err.message);
        return null;
    }
}

// -- 1. GESTION DE LA MEMOIRE (SQLite) --
function getSettings() {
    try {
        const rows = db.prepare('SELECT key, value FROM radar_settings').all();
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        return settings;
    } catch (e) {
        return { max_articles: "3" };
    }
}

function saveSetting(key, value) {
    try {
        db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)').run(key, value);
    } catch (e) {
        console.error("❌ Erreur SQL saveSetting:", e.message);
    }
}

function isProcessed(sourceUrl) {
    const row = db.prepare('SELECT id FROM radar_posts WHERE source_url = ?').get(sourceUrl);
    return !!row;
}

function updatePostStatus(id, status, wpId = null) {
    try {
        db.prepare('UPDATE radar_posts SET status = ?, wp_id = ? WHERE id = ?').run(status, wpId, id);
    } catch (e) {
        console.error("❌ Erreur SQL updatePostStatus:", e.message);
    }
}

function markAsIgnored(sourceUrl, sourceTitle) {
    try {
        db.prepare('INSERT INTO radar_posts (source_url, source_title, flash_content, status) VALUES (?, ?, ?, ?)').run(sourceUrl, sourceTitle, "IGNORÉ PAR IA", 'IGNORED');
    } catch (e) { }
}

// Migration douce des colonnes si elles n'existent pas encore
try {
    const cols = db.pragma('table_info(radar_posts)').map(c => c.name);
    if (!cols.includes('geo')) db.exec("ALTER TABLE radar_posts ADD COLUMN geo TEXT DEFAULT 'france'");
    if (!cols.includes('tags')) db.exec("ALTER TABLE radar_posts ADD COLUMN tags TEXT DEFAULT ''");
    if (!cols.includes('punchline')) db.exec("ALTER TABLE radar_posts ADD COLUMN punchline TEXT DEFAULT ''");
    if (!cols.includes('type_ouverture')) db.exec("ALTER TABLE radar_posts ADD COLUMN type_ouverture TEXT DEFAULT '📌 LE FAIT DU JOUR'");
    if (!cols.includes('fiabilite')) db.exec("ALTER TABLE radar_posts ADD COLUMN fiabilite TEXT DEFAULT 'haute'");
    if (!cols.includes('video_path')) db.exec("ALTER TABLE radar_posts ADD COLUMN video_path TEXT");
} catch (e) { }

function enqueuePost(sourceUrl, sourceTitle, flashContent, imageKeyword, status = 'PENDING', geo = 'france', tags = '', punchline = '', typeOuverture = '📌 LE FAIT DU JOUR', fiabilite = 'haute', videoPath = null) {
    try {
        db.prepare('INSERT OR IGNORE INTO radar_posts (source_url, source_title, flash_content, image_keyword, status, geo, tags, punchline, type_ouverture, fiabilite, video_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(sourceUrl, sourceTitle || 'Inconnu', flashContent, imageKeyword || '', status, geo, tags, punchline, typeOuverture, fiabilite, videoPath);
    } catch (e) {
        console.warn('⚠️ Erreur DB enqueuePost:', e.message);
    }
}

// -- 3. LE SCRAPER TELEGRAM (Mini-RSSHub Local + Détection Vidéo) --
async function fetchTelegramMessages(handle, videoOptions = {}) {
    try {
        console.log(`📡 Scraping Telegram : @${handle}...`);
        const url = `https://t.me/s/${handle}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const html = response.data;

        const messages = [];
        const msgRegex = /<div class="tgme_widget_message_text js-message_text[^>]*>([\s\S]*?)<\/div>/g;
        const linkRegex = /<a class="tgme_widget_message_date" href="(https:\/\/t\.me\/[^"]+)"/g;
        // Détection des vidéos dans les messages Telegram
        const videoRegex = /<video[^>]*src="([^"]+)"/g;

        let match;
        const rawTexts = [];
        while ((match = msgRegex.exec(html)) !== null) {
            let text = match[1].replace(/<br\/?>/g, '\n').replace(/<[^>]*>/g, '').trim();
            if (text) rawTexts.push(text);
        }

        const links = [];
        while ((match = linkRegex.exec(html)) !== null) {
            links.push(match[1]);
        }

        const count = Math.min(rawTexts.length, links.length, 15);
        for (let i = 1; i <= count; i++) {
            const text = rawTexts[rawTexts.length - i];
            const link = links[links.length - i];

            const msg = {
                title: `Post Telegram @${handle}`,
                content: text,
                link: link,
                pubDate: new Date().toISOString(),
                videoUrl: null,
                videoPath: null
            };

            // Détecter les vidéos dans le texte du message
            const videoUrlInText = detectVideoUrl(text);
            if (videoUrlInText) {
                msg.videoUrl = videoUrlInText;
                console.log(`  🎬 [TELEGRAM] Vidéo détectée dans @${handle}: ${videoUrlInText}`);

                // Pipeline vidéo complet (pré-filtre + download + transcription)
                try {
                    const videoResult = await processVideo(videoUrlInText, text, videoOptions);
                    if (videoResult) {
                        msg.content += `\n\n--- TRANSCRIPTION VIDÉO ---\n${videoResult.transcription}`;
                        msg.videoPath = videoResult.videoPath;
                        console.log(`  ✅ [TELEGRAM] Vidéo traitée pour @${handle}`);
                    }
                } catch (videoErr) {
                    console.warn(`  ⚠️ [TELEGRAM] Erreur vidéo: ${videoErr.message}`);
                }
            }

            messages.push(msg);
        }

        return messages;
    } catch (e) {
        console.error(`❌ Erreur Telegram @${handle}:`, e.message);
        return [];
    }
}

// -- 2. LE CERVEAU (Gemini avec output JSON en Batch) --
// -- SYSTÈME DE CONFIANCE PAR SOURCE --
const DEFAULT_SOURCE_TRUST = {
    // 🟢 Confiance haute
    'mediapart': '🟢', 'humanite': '🟢', 'humanité': '🟢', 'blast': '🟢', 'reporterre': '🟢',
    'basta': '🟢', 'politis': '🟢', 'arretsurimages': '🟢', 'arrêt sur images': '🟢',
    '972mag': '🟢', 'amnesty': '🟢', 'hrw': '🟢', 'btselem': '🟢',
    'franceinsoumise': '🟢', 'palestinechronicle': '🟢',
    // 🟡 Confiance moyenne
    'france24': '🟡', 'rfi': '🟡', 'francetvinfo': '🟡', 'lemonde': '🟡',
    'leparisien': '🟡', 'lacroix': '🟡', 'la-croix': '🟡', 'rtl': '🟡',
    'nouvelobs': '🟡', 'midilibre': '🟡', 'globalvoices': '🟡',
    'theconversation': '🟡', 'chathamhouse': '🟡',
    'brevesdepresse': '🟡', 'alertesinfos': '🟡', 'mediavenir': '🟡',
    // 🔴 Confiance basse
    'lefigaro': '🔴', 'figaro': '🔴', 'cnews': '🔴', 'bfmtv': '🔴', 'bfm': '🔴',
};

function getSourceTrust(sourceTitle, sourceUrl, sourceTrustMap = DEFAULT_SOURCE_TRUST) {
    const combined = (sourceTitle + ' ' + sourceUrl).toLowerCase();
    for (const [key, level] of Object.entries(sourceTrustMap)) {
        if (combined.includes(key)) return level;
    }
    return '🟡'; // Par défaut : confiance moyenne
}

function parseJsonSetting(raw, fallback) {
    try {
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
}

function normalizeBridgeBaseUrl(rawUrl) {
    const fallback = 'http://localhost:3300';
    const base = (rawUrl || fallback).trim().replace(/\/$/, '');
    return base || fallback;
}

function buildTwitterBridgeFeed(baseUrl, account) {
    const u = account.replace(/^@/, '').trim();
    if (!u) return null;
    return `${baseUrl}/?action=display&bridge=TwitterBridge&context=By+username&u=${encodeURIComponent(u)}&format=Atom`;
}

// -- 2. LE CERVEAU (Gemini 3 Pro avec JSON strict et confiance source) --
async function rewriteBatchWithGemini(itemsBatch, maxArticles, customPrompt, archiveContext = '', sourceTrustMap = DEFAULT_SOURCE_TRUST, aiModelMain = 'gemini-2.5-pro-preview-05-06', specificPrompts = {}) {
    const model = genAI.getGenerativeModel({
        model: aiModelMain,
        tools: [{ googleSearch: {} }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const articlesText = itemsBatch.map((item, index) => {
        const safeContent = item.content || "";
        const trustLevel = getSourceTrust(item.sourceTitle, item.id, sourceTrustMap);
        return `
[ID_ARTICLE: BATCH_ITEM_${index}]
Titre original: ${item.title}
Source: ${item.sourceTitle} ${trustLevel === '🔴' ? '[⚠️ CONFIANCE BASSE — VÉRIFICATION OBLIGATOIRE VIA GOOGLE SEARCH]' : trustLevel === '🟢' ? '[✅ CONFIANCE HAUTE]' : '[🟡 CONFIANCE MOYENNE]'}
Contenu: ${safeContent.substring(0, 1500)}
---
`;
    }).join('\n');

    const archiveBlock = archiveContext ? `

=== ARCHIVES L'ASSEZ (CASIER JUDICIAIRE POLITIQUE) ===
Les archives suivantes contiennent des déclarations passées de personnalités politiques. Utilise-les pour détecter des contradictions :
${archiveContext}
=== FIN DES ARCHIVES ===
` : '';

    const prompt = `
${customPrompt}
${archiveBlock}

=== INSTRUCTIONS DE FORMATAGE SPÉCIFIQUES ===
${specificPrompts.breaking ? `POUR LES ALERTES INFO : ${specificPrompts.breaking}` : ''}
${specificPrompts.decrypt ? `POUR LES DÉCRYPTAGES : ${specificPrompts.decrypt}` : ''}
${specificPrompts.standard ? `POUR LES FAITS DU JOUR : ${specificPrompts.standard}` : ''}

=== MISSION DE RECHERCHE ET SYNTHÈSE ===
1. Utilise impérativement le CONTENU FOURNI dans les articles ci-dessous comme base de ton analyse.
2. Utilise GOOGLE SEARCH pour :
   - Vérifier les chiffres et les faits mentionnés.
   - Extraire le "passif" ou les casseroles des protagonistes mentionnés (ministres, patrons, entreprises).
   - Trouver des éléments de contexte plus larges pour ton "tacle final".
   - OBLIGATOIRE pour les sources 🔴 CONFIANCE BASSE : cross-checker l'info.

=== RÈGLE DE SÉLECTION (LIMITATION) ===
Tu dois analyser les articles ci-dessous et sélectionner STRICTEMENT les ${maxArticles} infos les plus percutantes et systémiques. 
Génère AU MAXIMUM ${maxArticles} flashs (tu peux en renvoyer moins si l'actu est faible, mais JAMAIS plus de ${maxArticles}). Focus-toi uniquement sur le "top du top".

=== FORMAT DE SORTIE OBLIGATOIRE (JSON ARRAY) ===
Réponds UNIQUEMENT par un tableau JSON avec exactement ces champs :
[ { 
  "id": "BATCH_ITEM_N",
  "typeOuverture": "📌 LE FAIT DU JOUR",
  "themeEmoji": "⚖️",
  "theme": "JUSTICE",
  "shortTitle": "titre choc sans emojis",
  "flash": "texte complet du flash L'Assez commencant par le TAG D'OUVERTURE + emoji thème + thème",
  "imageKeyword": "mot-clé image strict en anglais (ex: riot, police)",
  "punchline": "résumé marquant et piquant de 6 à 10 mots max, sans majuscules forcées",
  "geo": "france" ou "international",
  "tags": ["tag1", "tag2"],
  "fiabilite": "haute" ou "moyenne" ou "suspecte",
  "entitesPolitiques": ["Macron", "Darmanin"]
} ]

CHAMPS IMPORTANTS :
- "typeOuverture" : OBLIGATOIRE. Un de : "🔴 ALERTE INFO !", "📌 LE FAIT DU JOUR", "🔎 DÉCRYPTAGE", "🗓️ À VENIR"
- "fiabilite" : "suspecte" si source 🔴 ET non confirmée par Google Search
- "entitesPolitiques" : liste des personnages politiques mentionnés (pour alimenter le casier judiciaire)
- "flash" : Le texte rédigé selon les règles de style de L'Assez. DOIT commencer par le typeOuverture.

Voici les articles à analyser (Source principale) :
${articlesText}
    `;

    try {
        console.log(`[DEBUG] Envoi à Gemini 3 Pro (Cerveau Éditorial v2)...`);
        const result = await model.generateContent(prompt);
        console.log(`[DEBUG] Gemini a répondu !`);

        const rawText = result.response.text();

        let jsonResponse;
        try {
            let cleanText = rawText.replace(/```json/i, '').replace(/```/g, '').trim();
            jsonResponse = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error("[DEBUG] JSON Parse Failed:", parseErr.message);
            return [];
        }

        return jsonResponse;
    } catch (error) {
        console.error("Erreur Gemini lors du traitement :", error.message);
        return [];
    }
}

// -- 3. LA DIFFUSION (Webhook Discord Administratif) --
async function notifyDiscordValidation(items, autoApprove = false, testMode = false) {
    if (!CONFIG.DISCORD_WEBHOOK_URL) return;

    const count = items.length;

    // Mode Test : Envoi des détails complets avec test du moteur d'image
    if (testMode && count > 0) {
        const formData = new FormData();
        const embeds = [];
        const attachmentsPayload = [];
        let fileIndex = 0;

        for (const it of items.slice(0, 10)) {
            const embed = {
                title: `🧪 [TEST] ${it.title}`,
                description: it.flash,
                fields: [
                    { name: "🏷️ Geo", value: it.geo, inline: true },
                    { name: "🔎 Tags", value: it.tags || "—", inline: true }
                ],
                color: 3447003 // Blue
            };

            if (it.imageUrl) {
                // Qu'il s'agisse d'une image native (HTTP) ou d'un mot-clé IA, on la passe OBLIGATOIREMENT
                // Le mot-clé est défini, on déclenche le moteur SmartCacheImage pour montrer à l'utilisateur que ça marche
                console.log(`[TEST-IMG] Traitement de l'image (SmartCache Filtres) pour : ${it.imageUrl}...`);
                const imgInfo = await generateSmartCacheImage(it.imageUrl, it.imageUrl, it.title, it.punchline);
                
                if (imgInfo && imgInfo.localPath && fs.existsSync(imgInfo.localPath)) {
                    const fileName = `radar_${fileIndex}.jpg`;
                    formData.append(`files[${fileIndex}]`, fs.createReadStream(imgInfo.localPath), { filename: fileName });
                    attachmentsPayload.push({ id: fileIndex, filename: fileName, description: "Image L'Assez" });
                    
                    embed.image = { url: `attachment://${fileName}` };
                    
                    if (it.imageUrl.startsWith('http')) {
                        embed.fields.push({ name: "🖼️ Moteur Image", value: `✅ Filtres appliqués sur l'image source !`, inline: false });
                    } else {
                        embed.fields.push({ name: "🖼️ Moteur Image", value: `✅ Générée via mot-clé IA`, inline: false });
                    }
                    fileIndex++;
                } else {
                    embed.fields.push({ name: "🖼️ Moteur Image", value: `❌ Échec du maquillage (Source/Mot-clé: ${it.imageUrl})`, inline: false });
                }
            } else {
                embed.fields.push({ name: "🖼️ Moteur Image", value: "Pas d'image (aucun mot-clé ni source)", inline: false });
            }

            embeds.push(embed);
        }

        formData.append('payload_json', JSON.stringify({
            content: "🔔 **MODE TEST ACTIF** : Voici les flash_content générés par l'IA. Le *Moteur d'Image* a aussi été testé et son rendu est attaché.",
            embeds: embeds,
            attachments: attachmentsPayload
        }));

        try {
            await axios.post(CONFIG.DISCORD_WEBHOOK_URL, formData, {
                headers: formData.getHeaders()
            });
            console.log("-> ✅ Notification détaillée avec Images (TEST) envoyée sur Discord !");
        } catch (err) {
            console.error("❌ Échec Webhook Discord (Test):", err.message);
        }
        return;
    }

    // Mode Normal : Notification condensée
    const embed = autoApprove ? {
        title: "🤖 Radar L'Assez : Mode Fantôme ✈️",
        description: `**${count}** flash(s) généré(s) et **auto-approuvé(s)** !\nIls seront publiés automatiquement selon le délai anti-bot configuré.`,
        color: 3066993  // Vert
    } : {
        title: "📡 Radar L'Assez : En attente de validation",
        description: `L'IA a généré **${count}** nouveau(x) Flash(s) !\nRendez-vous sur le Dashboard d'administration Web pour les publier sur L'Assez.`,
        color: 13631488  // Rouge
    };

    try {
        await axios.post(CONFIG.DISCORD_WEBHOOK_URL, { embeds: [embed] }, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log("-> ✅ Notification envoyée sur Discord !");
    } catch (err) {
        console.error("❌ Échec Webhook Discord:", err.message);
    }
}

// -- FONCTION PRINCIPALE --
async function fetchFeedWithTimeout(feedUrl, timeoutMs) {
    return Promise.race([
        parser.parseURL(feedUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout strict atteint')), timeoutMs))
    ]);
}

async function main() {
    console.log("🚀 Démarrage du Radar L'Assez...");

    const settings = getSettings();
    const maxArticles = parseInt(settings.max_articles || '3', 10);
    const rssLookbackHours = parseInt(settings.rss_lookback_hours || '24', 10);
    const autoApprove = settings.auto_approve_enabled === 'true';
    const ingestStatus = autoApprove ? 'APPROVED' : 'PENDING';
    
    // Dynamic lists & prompts from DB
    let rssFeeds = [];
    let telegramChannels = [];
    let xAccounts = [];
    try { rssFeeds = JSON.parse(settings.rss_feeds || '[]'); } catch(e){}
    try { telegramChannels = JSON.parse(settings.telegram_channels || '[]'); } catch(e){}
    try { xAccounts = JSON.parse(settings.x_accounts || '[]'); } catch(e){}
    const rssBridgeBaseUrl = normalizeBridgeBaseUrl(settings.rss_bridge_base_url);
    const xFeeds = xAccounts.map(acc => buildTwitterBridgeFeed(rssBridgeBaseUrl, acc)).filter(Boolean);
    const effectiveRssFeeds = Array.from(new Set([...rssFeeds, ...xFeeds]));
    const dynamicPrompt = settings.ai_prompt || "Tu es un assistant...";
    const aiPromptBreaking = settings.ai_prompt_breaking || "";
    const aiPromptDecrypt = settings.ai_prompt_decrypt || "";
    const aiPromptStandard = settings.ai_prompt_standard || "";
    const aiModelMain = settings.ai_model_main || 'gemini-2.5-pro-preview-05-06';
    const sourceTrustMap = parseJsonSetting(settings.source_trust_map, DEFAULT_SOURCE_TRUST);
    const dedupOptions = {
        similarityThreshold: parseFloat(settings.dedup_similarity_threshold || '0.65'),
        recentHours: parseInt(settings.dedup_recent_hours || '24', 10)
    };
    const videoOptions = {
        enabled: settings.video_ingest_enabled !== 'false',
        prefilterModel: settings.video_prefilter_model || 'gemini-2.0-flash',
        prefilterPrompt: settings.video_prefilter_prompt || undefined,
        prefilterMinChars: parseInt(settings.video_prefilter_min_chars || '20', 10),
        transcribeModel: settings.video_transcribe_model || 'gemini-2.0-flash',
        maxAudioMb: parseInt(settings.video_max_audio_mb || '20', 10)
    };

    if (autoApprove) {
        console.log("🤖 Mode Fantôme actif : les flash_content seront auto-approuvés (APPROVED) dès leur génération.");
    }

    let unreadItems = [];
    let scanErrors = [];

    for (const feedUrl of effectiveRssFeeds) {
        try {
            console.log(`🔍 Scan RSS : ${feedUrl}`);
            const feed = await fetchFeedWithTimeout(feedUrl, 15000);

            for (const item of feed.items) {
                const itemId = item.guid || item.link;
                if (!itemId || isProcessed(itemId)) continue;

                if (item.isoDate || item.pubDate) {
                    const articleDate = new Date(item.isoDate || item.pubDate);
                    const hoursDiff = (new Date().getTime() - articleDate.getTime()) / (1000 * 60 * 60);
                    if (hoursDiff > rssLookbackHours) continue;
                }

                unreadItems.push({
                    id: itemId,
                    title: item.title || "Flash Info",
                    link: item.link,
                    content: item.contentSnippet || item.content || "",
                    sourceTitle: feed.title || "Flux RSS",
                    imageUrl: (item.enclosure?.type?.startsWith('image') ? item.enclosure.url : null) ||
                        item.mediaContent?.['$']?.url ||
                        (item.contentEncoded || item.content || '').match(/<img[^>]+src=["'](https?:\/\/[^"'>]+)["']/i)?.[1]?.replace(/&/g, '&')
                });
            }
        } catch (error) {
            console.warn(`⚠️ Flux ignoré (${feedUrl}) : ${error.message}`);
            scanErrors.push({ source: feedUrl, type: 'RSS', error: error.message });
        }
    }

    for (const handle of telegramChannels) {
        try {
            const msgs = await fetchTelegramMessages(handle, videoOptions);
            for (const msg of msgs) {
                if (!isProcessed(msg.link)) {
                    unreadItems.push({
                        id: msg.link,
                        title: msg.title,
                        link: msg.link,
                        content: msg.content,
                        sourceTitle: `Telegram @${handle}`,
                        imageUrl: null
                    });
                }
            }
        } catch (error) {
            console.warn(`⚠️ Telegram ignoré (${handle}) : ${error.message}`);
            scanErrors.push({ source: handle, type: 'Telegram', error: error.message });
        }
    }

    saveSetting('last_scan_errors', JSON.stringify(scanErrors));

    if (unreadItems.length === 0) return console.log("✅ Tout est à jour.");

    // ─── PHASE 2 : TAMIS ANTI-DOUBLONS ───
    console.log('\n🛡️ Passage dans le Tamis Anti-Doublons...');
    const deduplicated = deduplicateItems(unreadItems, db, dedupOptions);

    if (deduplicated.length === 0) return console.log("✅ Tout a été filtré par le Tamis.");

    deduplicated.sort(() => Math.random() - 0.5);
    const batchToProcess = deduplicated.slice(0, 40);

    // ─── PHASE 4 : CASIER JUDICIAIRE POLITIQUE (RAG) ───
    console.log('\n🗄️ Consultation du Casier Judiciaire Politique...');
    const detectedEntities = extractEntitiesFromTitles(batchToProcess);
    const archiveContext = searchArchives(detectedEntities, db);
    if (archiveContext) {
        console.log(`  📚 ${detectedEntities.length} entité(s) détectée(s), archives injectées dans le prompt.`);
    }

    // ─── PHASE 1 : CERVEAU ÉDITORIAL ───
    console.log(`\n🧠 Analyse IA de ${batchToProcess.length} articles (Cerveau Éditorial v2)...`);
    const aiResults = await rewriteBatchWithGemini(batchToProcess, maxArticles, dynamicPrompt, archiveContext, sourceTrustMap, aiModelMain, {
        breaking: aiPromptBreaking,
        decrypt: aiPromptDecrypt,
        standard: aiPromptStandard
    });

    if (aiResults && aiResults.length > 0) {
        let newItems = [];
        for (const result of aiResults) {
            const indexMatch = result.id.match(/\d+/);
            if (indexMatch) {
                const index = parseInt(indexMatch[0], 10);
                const original = batchToProcess[index];
                if (original) {
                    let flash = result.flash.replace(/\\n/g, '\n');
                    const geo = result.geo || 'france';
                    const tags = Array.isArray(result.tags) ? result.tags.join(',') : '';
                    const finalTitle = result.shortTitle || original.sourceTitle;
                    const typeOuverture = result.typeOuverture || '📌 LE FAIT DU JOUR';
                    const fiabilite = result.fiabilite || 'haute';
                    const videoPath = original.videoPath || null;
                    
                    enqueuePost(original.id, finalTitle, flash, original.imageUrl || result.imageKeyword, ingestStatus, geo, tags, result.punchline || "INFO EXCLUSIVE L'ASSEZ", typeOuverture, fiabilite, videoPath);
                    
                    newItems.push({
                        title: finalTitle,
                        flash: flash,
                        geo: geo,
                        tags: tags,
                        imageUrl: original.imageUrl || result.imageKeyword,
                        punchline: result.punchline || "INFO EXCLUSIVE L'ASSEZ",
                        typeOuverture: typeOuverture,
                        fiabilite: fiabilite,
                        entitesPolitiques: result.entitesPolitiques || []
                    });
                }
            }
        }

        // ─── PHASE 4 (suite) : ARCHIVAGE DES DÉCLARATIONS ───
        archiveDeclarations(aiResults, batchToProcess, db);

        const handledIds = aiResults.map(r => {
            const m = r.id.match(/\d+/);
            return m ? batchToProcess[parseInt(m[0], 10)]?.id : null;
        }).filter(id => id !== null);

        for (const item of batchToProcess) {
            if (!handledIds.includes(item.id)) markAsIgnored(item.id, item.sourceTitle);
        }

        const label = autoApprove ? 'flash(s) auto-approuvé(s) ✈️' : 'flash(s) en attente de validation';
        console.log(`\n✅ ${newItems.length} ${label}.`);
        if (newItems.length > 0) {
            const isTest = settings.discord_test_mode === 'true';
            await notifyDiscordValidation(newItems, autoApprove, isTest);
        }
    } else {
        console.log(`\n✅ Tout a été filtré par l'IA.`);
        for (const item of batchToProcess) markAsIgnored(item.id, item.sourceTitle);
    }

    // Nettoyage des fichiers vidéo temporaires (>24h)
    cleanupVideoFiles();
}

main().catch(error => {
    console.error("\n❌ CRASH FATAL NON-GÉRÉ DANS MAIN() :");
    console.error(error);
    process.exit(1);
});
