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

// Migration douce des colonnes geo/tags si elles n'existent pas encore
try {
    const cols = db.pragma('table_info(radar_posts)').map(c => c.name);
    if (!cols.includes('geo')) db.exec("ALTER TABLE radar_posts ADD COLUMN geo TEXT DEFAULT 'france'");
    if (!cols.includes('tags')) db.exec("ALTER TABLE radar_posts ADD COLUMN tags TEXT DEFAULT ''");
    if (!cols.includes('punchline')) db.exec("ALTER TABLE radar_posts ADD COLUMN punchline TEXT DEFAULT ''");
} catch (e) { }

function enqueuePost(sourceUrl, sourceTitle, flashContent, imageKeyword, status = 'PENDING', geo = 'france', tags = '', punchline = '') {
    try {
        db.prepare('INSERT OR IGNORE INTO radar_posts (source_url, source_title, flash_content, image_keyword, status, geo, tags, punchline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(sourceUrl, sourceTitle || 'Inconnu', flashContent, imageKeyword || '', status, geo, tags, punchline);
    } catch (e) {
        // En cas d'erreur (ex: colonne manquante temporaire avant migration persistée), on ignore ou on relance
        console.warn('⚠️ Erreur DB enqueuePost (punchline manquante ?)', e.message);
    }
}

// -- 3. LE SCRAPER TELEGRAM (Mini-RSSHub Local) --
async function fetchTelegramMessages(handle) {
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
            messages.push({
                title: `Post Telegram @${handle}`,
                content: text,
                link: link,
                pubDate: new Date().toISOString()
            });
        }

        return messages;
    } catch (e) {
        console.error(`❌ Erreur Telegram @${handle}:`, e.message);
        return [];
    }
}

// -- 2. LE CERVEAU (Gemini avec output JSON en Batch) --
// -- 2. LE CERVEAU (Gemini avec output JSON en Batch) --
async function rewriteBatchWithGemini(itemsBatch, maxArticles, customPrompt) {
    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-preview",
        tools: [{ googleSearch: {} }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const articlesText = itemsBatch.map((item, index) => {
        const safeContent = item.content || "";
        return `
[ID_ARTICLE: BATCH_ITEM_${index}]
Titre original: ${item.title}
Contenu: ${safeContent.substring(0, 1500)}
---
`;
    }).join('\n');

    const prompt = `
${customPrompt}

=== MISSION DE RECHERCHE ET SYNTHÈSE ===
1. Utilise impérativement le CONTENU FOURNI dans les articles ci-dessous comme base de ton analyse.
2. Utilise GOOGLE SEARCH pour :
   - Vérifier les chiffres et les faits mentionnés.
   - Extraire le "passif" ou les casseroles des protagonistes mentionnés (ministres, patrons, entreprises).
   - Trouver des éléments de contexte plus larges pour ton "tacle final".

=== RÈGLE DE SÉLECTION (LIMITATION) ===
Tu dois analyser les articles ci-dessous et sélectionner STRICTEMENT les ${maxArticles} infos les plus percutantes et systémiques. 
Génère AU MAXIMUM ${maxArticles} flashs (tu peux en renvoyer moins si l'actu est faible, mais JAMAIS plus de ${maxArticles}). Focus-toi uniquement sur le "top du top".

=== FORMAT DE SORTIE OBLIGATOIRE (JSON ARRAY) ===
Réponds UNIQUEMENT par un tableau JSON avec exactement ces champs :
[ { 
  "id": "BATCH_ITEM_N",
  "shortTitle": "titre choc sans emojis",
  "flash": "texte complet du flash L'Assez",
  "imageKeyword": "mot-clé image strict en anglais (ex: riot, police)",
  "punchline": "résumé marquant et piquant de 6 à 10 mots max, sans majuscules forcées",
  "geo": "france" ou "international",
  "tags": ["tag1", "tag2"]
} ]
- "shortTitle" : Un titre très court et choc (max 6-8 mots) résumant l'info pour l'image.
- "flash" : Le texte rédigé selon les règles de style de L'Assez (ALERTE INFO, ÉMOJI, SUJET, etc).

Voici les articles à analyser (Source principale) :
${articlesText}
    `;

    try {
        console.log(`[DEBUG] Sending to Gemini (Radical Mode)...`);
        const result = await model.generateContent(prompt);
        console.log(`[DEBUG] Gemini responded!`);

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
            content: "🔔 **MODE TEST ACTIF** : Voici les bangers générés par l'IA. Le *Moteur d'Image* a aussi été testé et son rendu est attaché.",
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
    try { rssFeeds = JSON.parse(settings.rss_feeds || '[]'); } catch(e){}
    try { telegramChannels = JSON.parse(settings.telegram_channels || '[]'); } catch(e){}
    const dynamicPrompt = settings.ai_prompt || "Tu es un assistant...";

    if (autoApprove) {
        console.log("🤖 Mode Fantôme actif : les bangers seront auto-approuvés (APPROVED) dès leur génération.");
    }

    let unreadItems = [];
    let scanErrors = [];

    for (const feedUrl of rssFeeds) {
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
                        (item.contentEncoded || item.content || '').match(/<img[^>]+src=["'](https?:\/\/[^"'>]+)["']/i)?.[1]?.replace(/&amp;/g, '&')
                });
            }
        } catch (error) {
            console.warn(`⚠️ Flux ignoré (${feedUrl}) : ${error.message}`);
            scanErrors.push({ source: feedUrl, type: 'RSS', error: error.message });
        }
    }

    for (const handle of telegramChannels) {
        try {
            const msgs = await fetchTelegramMessages(handle);
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

    unreadItems.sort(() => Math.random() - 0.5);
    const batchToProcess = unreadItems.slice(0, 40);

    console.log(`🧠 Analyse IA de ${batchToProcess.length} articles...`);
    const aiResults = await rewriteBatchWithGemini(batchToProcess, maxArticles, dynamicPrompt);

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
                    
                    const testMode = settings.discord_test_mode === 'true';
                    // Dans le cas du mode test, on peut quand même enqueue en PENDING 
                    // ou choisir de ne rien faire. Ici on enqueue (PENDING) pour qu'il le voit sur le dashboard aussi.
                    enqueuePost(original.id, finalTitle, flash, original.imageUrl || result.imageKeyword, ingestStatus, geo, tags, result.punchline || "INFO EXCLUSIVE L'ASSEZ");
                    
                    newItems.push({
                        title: finalTitle,
                        flash: flash,
                        geo: geo,
                        tags: tags,
                        imageUrl: original.imageUrl || result.imageKeyword,
                        punchline: result.punchline || "INFO EXCLUSIVE L'ASSEZ"
                    });
                }
            }
        }

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
}

main().catch(error => {
    console.error("\n❌ CRASH FATAL NON-GÉRÉ DANS MAIN() :");
    console.error(error);
    process.exit(1);
});
