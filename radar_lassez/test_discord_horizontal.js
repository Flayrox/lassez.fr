import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { generateSmartCacheImage } from './imageProcessor.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testDiscordHorizontal() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.error("No Discord Webhook URL configured.");
        return;
    }

    const sourceImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuBxrKloupICoto8P9PcaUl2BeFYY7vlA9WzsPd70b7Xpc3Ie4El3eTgATTthZl1HeusHgLapRthn_nh6ub3BdUqwNLAoz8dG38mw5v_7o1mDcj-3Eswk9yjcpUe3pjTyY2DPsnn20_f5TIsPKih5SG0_65YJlpDj1pHZtmUh1d_niOfjGHQDSWKOVk0yR3DVKKq8pJea_NHvzEyfk-NTPDJAEAoDFl57dYPgcuh9QBP5iKCZwJXDowY5bFG_oEkEoVczaJvzONMN3gG";
    const keyword = "riot police paris";
    const title = "LA POLICE DÉPLOYÉE EN MASSE AU COEUR DE PARIS";
    const punchline = "LA TENSION MONTE DANS LA CAPITALE AVANT LA DÉCISION";

    console.log("[TEST] Generating 16:9 horizontal image...");
    const imgInfo = await generateSmartCacheImage(sourceImage, keyword, title, punchline);

    if (!imgInfo || !imgInfo.localPath || !fs.existsSync(imgInfo.localPath)) {
        console.error("Failed to generate image.");
        return;
    }

    console.log("[TEST] Image generated successfully. Uploading to Discord...");

    const formData = new FormData();
    const embeds = [];
    const fileIndex = 0;
    const fileName = `radar_${fileIndex}.jpg`;

    formData.append(`files[${fileIndex}]`, fs.createReadStream(imgInfo.localPath), { filename: fileName });

    embeds.push({
        title: `🧪 [TEST] ${title}`,
        description: "🚨 ALERTE GÉNÉRALE ! \nCeci est un test manuel pour valider le moteur AI 16:9.",
        fields: [
            { name: "🏷️ Geo", value: "france", inline: true }
        ],
        image: { url: `attachment://${fileName}` },
        color: 3447003
    });

    formData.append('payload_json', JSON.stringify({
        content: "🔔 **TEST MANUEL DU MOTEUR D'IMAGE HORIZONTALE 16:9**",
        embeds: embeds
    }));

    try {
        await axios.post(webhookUrl, formData, {
            headers: formData.getHeaders()
        });
        console.log("-> ✅ Notification envoyée sur Discord !");
    } catch (err) {
        console.error("❌ Échec Webhook Discord:", err.response?.data || err.message);
    }
}

testDiscordHorizontal();
