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

async function testDiscord() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.error("No Discord Webhook URL configured.");
        return;
    }

    const keyword = "riot police paris";
    const title = "LA POLICE DÉPLOYÉE EN MASSE";
    const punchline = "LA TENSION MONTE DANS LA CAPITALE AVANT LA DÉCISION";

    console.log("[TEST] Generating image via Pollinations AI...");
    const imgInfo = await generateSmartCacheImage(null, keyword, title, punchline);

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
        description: "🚨 ALERTE GÉNÉRALE ! \nCeci est un test manuel pour valider le moteur AI 1:1 génératif.",
        fields: [
            { name: "🏷️ Geo", value: "france", inline: true },
            { name: "🖼️ Moteur Image", value: `✅ Générée via mot-clé IA ("${keyword}")`, inline: false }
        ],
        image: { url: `attachment://${fileName}` },
        color: 3447003
    });

    formData.append('payload_json', JSON.stringify({
        content: "🔔 **TEST MANUEL DU MOTEUR D'IMAGE IA SEUL**",
        embeds: embeds
    }));

    try {
        await axios.post(webhookUrl, formData, {
            headers: formData.getHeaders()
        });
        console.log("-> ✅ Notification avec Image IA envoyée sur Discord !");
    } catch (err) {
        console.error("❌ Échec Webhook Discord:", err.response?.data || err.message);
    }
}

testDiscord();
