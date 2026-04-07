/**
 * ═══════════════════════════════════════════════════════════════
 *  RADAR L'ASSEZ — SCRIPT DE TEST DE FLUX GLOBAL
 *  
 *  Ce script simule une info pour chaque type de source et de format
 *  et l'envoie sur Discord pour validation visuelle.
 * ═══════════════════════════════════════════════════════════════
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import fs from 'fs';
import { generateSmartCacheImage } from './imageProcessor.js';
import FormData from 'form-data';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = new Database(path.join(__dirname, 'radar.db'), { readonly: true });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getSettings() {
    const rows = db.prepare('SELECT key, value FROM radar_settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    return settings;
}

async function runTest() {
    console.log("🧪 Lancement du Test Global des Flux Radar...");
    const settings = getSettings();
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

    if (!discordWebhook) {
        console.error("❌ Erreur: DISCORD_WEBHOOK_URL non défini.");
        return;
    }

    const testScenarios = [
        {
            type: "TWITTER / X (via RSS-Bridge)",
            title: "Post de @Mediapart",
            content: "🔴 EXCLUSIF. De nouveaux documents prouvent l'implication de plusieurs ministres dans l'affaire de financement occulte. #Investigation",
            format: "ALERTE INFO",
            source: "Twitter @Mediapart"
        },
        {
            type: "TELEGRAM (Scraper)",
            title: "Post Telegram @LInsumission",
            content: "Manifestation massive à Paris contre la réforme. La police utilise des gaz lacrymogènes. Plusieurs blessés signalés.",
            format: "DÉCRYPTAGE",
            source: "Telegram @LInsumission"
        },
        {
            type: "RSS (Standard)",
            title: "Le Monde - Politique",
            content: "Le gouvernement annonce une nouvelle loi sur le logement qui pourrait impacter des millions de foyers précaires.",
            format: "LE FAIT DU JOUR",
            source: "Le Monde"
        }
    ];

    const results = [];

    for (const scenario of testScenarios) {
        console.log(`\n🧠 Génération pour le scénario : ${scenario.type}...`);
        
        const prompt = `
${settings.ai_prompt || "Tu es l'IA de L'Assez."}

INSTRUCTIONS SPÉCIFIQUES POUR LE TEST :
- Format demandé : ${scenario.format}
- Source : ${scenario.source}
- Contenu à traiter : ${scenario.content}

Réponds UNIQUEMENT par un JSON avec ces champs :
{
  "typeOuverture": "🔴 ALERTE INFO !" ou "🔎 DÉCRYPTAGE" ou "📌 LE FAIT DU JOUR",
  "flash": "texte rédigé avec ton style tacleur et incisif",
  "shortTitle": "titre choc",
  "punchline": "la punchline en 8 mots",
  "imageKeyword": "riot police"
}
`;

        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        
        try {
            const cleanJson = response.replace(/```json/i, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanJson);
            results.push({ ...data, ...scenario });
        } catch (e) {
            console.error("❌ Échec parse JSON pour scénario", scenario.type);
        }
    }

    console.log(`\n📤 Envoi de ${results.length} tests sur Discord...`);

    const formData = new FormData();
    const embeds = results.map((it, idx) => ({
        title: `🧪 [TEST FLUX: ${it.type}] ${it.shortTitle}`,
        description: it.flash,
        fields: [
            { name: "🎯 Format Visé", value: it.format, inline: true },
            { name: "📡 Source", value: it.source, inline: true },
            { name: "⚡ Punchline", value: it.punchline, inline: false }
        ],
        color: idx === 0 ? 15548997 : (idx === 1 ? 3447003 : 10181046)
    }));

    formData.append('payload_json', JSON.stringify({
        content: "🔔 **TEST TECHNIQUE RADAR COMPLET**\nLe système a simulé les différents flux (Twitter, Telegram, RSS) et les formats d'IA associés.",
        embeds: embeds
    }));

    try {
        await axios.post(discordWebhook, formData, { headers: formData.getHeaders() });
        console.log("✅ Tests envoyés avec succès sur Discord !");
    } catch (err) {
        console.error("❌ Échec envoi Discord:", err.message);
    }
}

runTest().then(() => {
    console.log("\n🏁 Fin du test.");
    db.close();
    process.exit(0);
});
