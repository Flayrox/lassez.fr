import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRestAPIClient } from 'masto';
import { BskyAgent, RichText } from '@atproto/api';
import FormData from 'form-data';
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function getSettings() {
    try {
        const db = new Database(path.join(__dirname, 'radar.db'), { readonly: true });
        const rows = db.prepare('SELECT key, value FROM radar_settings').all();
        db.close();
        const settings = {};
        for(const r of rows) settings[r.key] = r.value;
        return settings;
    } catch(e) { return {}; }
}

// === HELPER ===
const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
};

// ============================================================================
// MASTODON
// ============================================================================
export async function postToMastodon(text, localImagePath, wpUrl, skipLink = false) {
    if (!process.env.MASTODON_ACCESS_TOKEN || !process.env.MASTODON_INSTANCE_URL) {
        console.log('Skip [MASTODON] Identifiants manquants.');
        return false;
    }

    try {
        console.log('🐘 [MASTODON] Connexion à l\'instance...');
        const masto = createRestAPIClient({
            url: process.env.MASTODON_INSTANCE_URL,
            accessToken: process.env.MASTODON_ACCESS_TOKEN,
        });

        const frontendUrl = process.env.FRONTEND_URL || 'https://lassez.fr';
        const finalUrl = wpUrl.replace('api.lassez.fr', new URL(frontendUrl).hostname);

        const statusText = skipLink 
            ? truncateText(text, 490) 
            : truncateText(`${text}\n\n🔗 Lire la suite : ${finalUrl}`, 490);

        let mediaIds = [];

        // Upload media nativement
        if (localImagePath && fs.existsSync(localImagePath)) {
            console.log('🐘 [MASTODON] Upload de l\'image...');
            const media = await masto.v2.media.create({
                file: new Blob([fs.readFileSync(localImagePath)]),
                description: 'Image illustration du flash info Radar L\'Assez'
            });
            mediaIds.push(media.id);
        }

        console.log('🐘 [MASTODON] Publication du statut (toot)...');
        await masto.v1.statuses.create({
            status: statusText,
            visibility: 'public',
            mediaIds: mediaIds.length > 0 ? mediaIds : undefined
        });

        console.log('✅ [MASTODON] Publié avec succès !');
        return true;
    } catch (err) {
        console.error('❌ [MASTODON] Erreur :', err.message || err);
        return false;
    }
}

// ============================================================================
// BLUESKY
// ============================================================================
export async function postToBluesky(text, localImagePath, wpUrl, skipLink = false) {
    if (!process.env.BLUESKY_IDENTIFIER || !process.env.BLUESKY_APP_PASSWORD) {
        console.log('Skip [BLUESKY] Identifiants manquants.');
        return false;
    }

    try {
        console.log('🦋 [BLUESKY] Connexion...');
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        await agent.login({
            identifier: process.env.BLUESKY_IDENTIFIER,
            password: process.env.BLUESKY_APP_PASSWORD,
        });

        const frontendUrl = process.env.FRONTEND_URL || 'https://lassez.fr';
        const finalUrl = wpUrl.replace('api.lassez.fr', new URL(frontendUrl).hostname);

        // Bluesky text limit is 300 chars, so we truncate string strictly
        // We ensure wpUrl has https:// for Bluesky's RichText parser to detect it as a link reliably
        const formattedUrl = finalUrl.startsWith('http') ? finalUrl : `https://${finalUrl}`;
        
        const statusText = skipLink 
            ? truncateText(text, 290) 
            : truncateText(`${text}\n\n🔗 ${formattedUrl}`, 290);

        let embed = undefined;

        // Upload media nativement
        if (localImagePath && fs.existsSync(localImagePath)) {
            console.log('🦋 [BLUESKY] Upload de l\'image...');
            const buffer = fs.readFileSync(localImagePath);
            // Guess mime type roughly based on extension
            const ext = path.extname(localImagePath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

            const response = await agent.uploadBlob(buffer, {
                encoding: mimeType
            });

            embed = {
                $type: 'app.bsky.embed.images',
                images: [{
                    alt: 'Illustration Radar L\'Assez',
                    image: response.data.blob
                }]
            };
        }

        // RichText détecte automatiquement les URLs et les rend cliquables (gère les emojis correctement)
        const rt = new RichText({ text: statusText });
        await rt.detectFacets(agent);

        console.log('🦋 [BLUESKY] Publication...');
        await agent.post({
            text: rt.text,
            facets: rt.facets,
            embed: embed,
            createdAt: new Date().toISOString()
        });

        console.log('✅ [BLUESKY] Publié avec succès !');
        return true;
    } catch (err) {
        console.error('❌ [BLUESKY] Erreur :', err.message || err);
        return false;
    }
}

// ============================================================================
// TWITTER / X
// ============================================================================
export async function postToTwitter(text, localImagePath, wpUrl, skipLink = false) {
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
        console.log('Skip [TWITTER] Identifiants manquants.');
        return false;
    }

    try {
        console.log('🐦 [TWITTER] Initialisation du client...');
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });

        const rwClient = client.readWrite;

        const frontendUrl = process.env.FRONTEND_URL || 'https://lassez.fr';
        const finalUrl = wpUrl.replace('api.lassez.fr', new URL(frontendUrl).hostname);

        // Twitter has a 280 character limit
        const statusText = skipLink 
            ? truncateText(text, 270) 
            : truncateText(`${text}\n\n🔗 ${finalUrl}`, 270);

        let mediaIds = [];

        // Upload media nativement (v1 API used for media upload inside v2 client)
        if (localImagePath && fs.existsSync(localImagePath)) {
            console.log('🐦 [TWITTER] Upload de l\'image...');
            const mediaId = await client.v1.uploadMedia(localImagePath);
            mediaIds.push(mediaId);
        }

        console.log('🐦 [TWITTER] Publication du tweet...');
        await rwClient.v2.tweet({
            text: statusText,
            media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined
        });

        console.log('✅ [TWITTER] Publié avec succès !');
        return true;
    } catch (err) {
        console.error('❌ [TWITTER] Erreur :', err.data?.detail || err.message || err);
        return false;
    }
}

// ============================================================================
// DISCORD (WEBHOOK BROADCAST)
// ============================================================================
export async function postToDiscord(text, localImagePath, wpUrl, skipLink = false) {
    if (!process.env.DISCORD_WEBHOOK_URL) {
        console.log('Skip [DISCORD] Webhook manquant.');
        return false;
    }

    try {
        console.log('🔔 [DISCORD] Préparation de la publication...');
        
        const frontendUrl = process.env.FRONTEND_URL || 'https://lassez.fr';
        const finalUrl = wpUrl.replace('api.lassez.fr', new URL(frontendUrl).hostname);
        
        const content = skipLink ? text : `${text}\n\n🔗 [Lire la suite](${finalUrl})`;

        // Discord Webhook supports multipart/form-data for images
        const formData = new FormData();
        
        const payload = {
            embeds: [{
                description: content,
                color: 14421030, // Rose/Rouge L'ASSEZ
                timestamp: new Date().toISOString()
            }]
        };

        if (localImagePath && fs.existsSync(localImagePath)) {
            const fileName = path.basename(localImagePath);
            formData.append('file', fs.createReadStream(localImagePath), fileName);
            payload.embeds[0].image = { url: `attachment://${fileName}` };
        }

        formData.append('payload_json', JSON.stringify(payload));

        await axios.post(process.env.DISCORD_WEBHOOK_URL, formData, {
            headers: { ...formData.getHeaders() }
        });

        console.log('✅ [DISCORD] Publié avec succès !');
        return true;
    } catch (err) {
        console.error('❌ [DISCORD] Erreur :', err.response?.data || err.message || err);
        return false;
    }
}

// ============================================================================
// GLOBAL CROSS-POSTING FUNCTION
// ============================================================================
export async function broadcastToSocials(text, localImagePath, wpUrl, skipLink = false) {
    console.log('================================================');
    console.log(`🌐 [CROSS-POSTING] Lancement sur les réseaux...`);
    console.log('================================================');

    const settings = getSettings();
    const useMastodon = settings.social_mastodon_enabled !== 'false';
    const useBluesky = settings.social_bluesky_enabled !== 'false';
    const useTwitter = settings.social_twitter_enabled !== 'false';
    const useDiscord = settings.social_discord_enabled === 'true';

    const tasks = [];
    if (useMastodon) tasks.push(postToMastodon(text, localImagePath, wpUrl, skipLink));
    if (useBluesky) tasks.push(postToBluesky(text, localImagePath, wpUrl, skipLink));
    if (useTwitter) tasks.push(postToTwitter(text, localImagePath, wpUrl, skipLink));
    if (useDiscord) tasks.push(postToDiscord(text, localImagePath, wpUrl, skipLink));

    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    } else {
        console.log('⚠️ [CROSS-POSTING] Tous les réseaux sociaux concernés sont désactivés.');
    }

    console.log('🏁 [CROSS-POSTING] Terminée pour cet article.');
}
