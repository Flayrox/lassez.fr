/**
 * broadcast_custom.js — Diffusion manuelle d'un post personnalisé
 *
 * Appelé par POST /api/radar/social-custom (option "Diffuser maintenant").
 * Envoie le texte (et éventuellement l'image) vers les canaux configurés :
 *   1. Discord (webhook)
 *   2. Payload CMS (révélation flash)
 *
 * Usage : node radar_lassez/broadcast_custom.js "texte" "url_image_ou_vide"
 */
import 'dotenv/config';

const text = String(process.argv[2] || '').trim();
const imageUrl = String(process.argv[3] || '').trim();

if (!text) {
    console.error('❌ [BROADCAST] Aucun texte fourni.');
    process.exit(1);
}

async function sendToDiscord() {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) {
        console.warn('⚠️ [BROADCAST] DISCORD_WEBHOOK_URL absente, canal Discord ignoré.');
        return false;
    }

    const embed = {
        title: '📡 Diffusion manuelle — L\'Assez',
        description: text,
        color: 0xDC2626,
        timestamp: new Date().toISOString(),
        ...(imageUrl ? { image: { url: imageUrl } } : {}),
        footer: { text: 'Radar L\'Assez • Broadcast manuel' },
    };

    try {
        const res = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
        });

        if (res.ok) {
            console.log('✅ [BROADCAST] [DISCORD] Message envoyé.');
            return true;
        }
        console.error(`❌ [BROADCAST] [DISCORD] HTTP ${res.status}:`, await res.text().catch(() => ''));
    } catch (e) {
        console.error('❌ [BROADCAST] [DISCORD]', e.message);
    }
    return false;
}

async function sendToPayload() {
    const origin = (process.env.PAYLOAD_SERVER_URL || 'https://api.lassez.fr').replace(/\/$/, '');
    const email = process.env.PAYLOAD_BOT_USER || process.env.PAYLOAD_ADMIN_EMAIL;
    const password = process.env.PAYLOAD_BOT_PASSWORD || process.env.PAYLOAD_ADMIN_PASSWORD;

    if (!email || !password) {
        console.warn('⚠️ [BROADCAST] Identifiants Payload absents, canal Payload ignoré.');
        return false;
    }

    try {
        const loginRes = await fetch(`${origin}/api/payload/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();
        const token = loginData?.token;
        if (!token) {
            console.error(`❌ [BROADCAST] [PAYLOAD] Login échoué (HTTP ${loginRes.status}).`);
            return false;
        }

        const cleanText = text.length > 2000 ? text.slice(0, 2000) : text;
        const res = await fetch(`${origin}/api/payload/revelations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `JWT ${token}`,
            },
            body: JSON.stringify({
                titre: cleanText.split('\n')[0].slice(0, 120) || 'FLASH',
                _status: 'published',
                contenu_rapide: cleanText,
                contenu_rapide_html: `<p>${cleanText.replace(/\n/g, '<br>')}</p>`,
                niveau_alerte: 'Public',
                zone_geo: 'france',
            }),
        });

        if (res.ok) {
            console.log('✅ [BROADCAST] [PAYLOAD] Révélation créée.');
            return true;
        }
        console.error(`❌ [BROADCAST] [PAYLOAD] HTTP ${res.status}:`, await res.text().catch(() => ''));
    } catch (e) {
        console.error('❌ [BROADCAST] [PAYLOAD]', e.message);
    }
    return false;
}

async function main() {
    const results = await Promise.all([sendToDiscord(), sendToPayload()]);
    const anySuccess = results.some(Boolean);
    console.log(anySuccess
        ? `✅ [BROADCAST] Diffusion terminée (${results.filter(Boolean).length}/${results.length} canaux).`
        : '❌ [BROADCAST] Aucun canal n\'a accepté la diffusion.');
    process.exit(anySuccess ? 0 : 1);
}

main();
