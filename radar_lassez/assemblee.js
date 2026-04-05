import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CONFIG = {
    API_URL: 'https://www.nosdeputes.fr/scrutins/json',
    HISTORY_FILE: path.join(__dirname, 'historique_assemblee.json'),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL
};

// Modèle Gemini
const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);

async function loadHistory() {
    try {
        const data = await fs.readFile(CONFIG.HISTORY_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function saveHistory(history) {
    await fs.writeFile(CONFIG.HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

// Fonction pour envoyer à Discord
async function publishToDiscord(markdownText, sourceUrl, scrutinTitre) {
    if (!CONFIG.DISCORD_WEBHOOK_URL) {
        console.error("Webhook Discord manquant dans le fichier .env !");
        return;
    }

    const embed = {
        title: "🏛️ Alerte Radar Hémicycle",
        description: markdownText,
        url: sourceUrl,
        color: 13631488, // Rouge L'Assez
        footer: {
            text: `Scrutin : ${scrutinTitre}`
        }
    };

    const payload = { embeds: [embed] };

    try {
        await axios.post(CONFIG.DISCORD_WEBHOOK_URL, payload, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log("-> ✅ Flash Hémicycle envoyé sur Discord !");
    } catch (err) {
        console.error("-> ❌ Erreur Discord:", err.response?.data || err.message);
    }
}

// Fonction pour analyser un scrutin avec Gemini
async function analyzeScrutinWithGemini(scrutin) {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    // Formatage des données de votes pour l'IA
    let detailsVotes = '';
    if (scrutin.ventilationVotes && scrutin.ventilationVotes.groupe) {
        // L'API NosDéputés structure parfois asynchrone, mais généralement:
        const groupes = Array.isArray(scrutin.ventilationVotes.groupe) ? scrutin.ventilationVotes.groupe : [scrutin.ventilationVotes.groupe];
        for (const g of groupes) {
            const nomGroupe = g.groupe?.groupe_sigle || "Inconnu";
            const pour = g.vote?.decompte?.pour || 0;
            const contre = g.vote?.decompte?.contre || 0;
            const abstention = g.vote?.decompte?.abstention || 0;
            detailsVotes += `- ${nomGroupe} : ${pour} Pour, ${contre} Contre, ${abstention} Abstentions\n`;
        }
    }

    const prompt = `
Tu es le rédacteur en chef politique du média indépendant L'Assez. Tu analyses les votes de l'Assemblée nationale pour dénoncer l'hypocrisie et le vrai visage des partis politiques derrière leurs discours médiatiques.

=== 1. LE TEXTE DE LOI ===
Titre : ${scrutin.titre || scrutin.sort}
Résultat global : ${scrutin.sort || "Inconnu"}

=== 2. DÉTAIL DES VOTES PAR GROUPE ===
${detailsVotes ? detailsVotes : "(Détails non fournis par l'API pour ce scrutin)"}

=== 3. LE FILTRE ÉDITORIAL ===
Ce texte de loi concerne-t-il les droits sociaux, l'économie, la police, les inégalités, ou l'écologie ? 
Si c'est un texte purement administratif, obscur ou sans véritable impact social sur le peuple : REPONDS EXACTEMENT ET UNIQUEMENT [{"id": "${scrutin.numero}", "action": "IGNORE"}].

=== 4. LE FORMAT L'ASSEZ (SI GARDÉ) ===
Si le scrutin est crucial, rédige un Flash très percutant. 
- Titre avec Emojis: 🔴🏛️ ILS ONT VOTÉ ÇA - [Titre direct et provocateur]
- Analyse: En 2-3 paragraphes courts. Dénonce l'hypocrisie de certains partis par rapport à leurs discours télés. Explique l'impact CONCRET de cette loi pour le peuple.
- Donne le résultat exact de certains partis majeurs pour illustrer (ex: LFI 100% Contre, RN Abstention complice...).
- Pas de jargon parlementaire.
- Tu dois fournir un mot-clé en anglais pertinent (ex: parliament, law, police, rich, strike) pour l'illustration.

=== 5. FORMAT DE SORTIE JSON OBLIGATOIRE ===
Tu dois répondre UNIQUEMENT par un tableau JSON valide avec cette structure :
[
  {
    "id": "${scrutin.numero}",
    "action": "KEEP",
    "flash": "Le texte formaté L'Assez, avec les emojis et \\\\n pour les sauts de ligne.",
    "imageKeyword": "mot_clé_anglais"
  }
]
`;

    try {
        const result = await model.generateContent(prompt);
        const jsonResponse = JSON.parse(result.response.text());
        return jsonResponse;
    } catch (error) {
        console.error("Erreur Gemini (Hémicycle) :", error.message);
        return [];
    }
}

async function main() {
    console.log("🚀 Démarrage du Radar Hémicycle...");

    const history = await loadHistory();

    try {
        console.log("📥 Récupération des scrutins depuis NosDéputés.fr...");
        const response = await axios.get(CONFIG.API_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        // Structure NosDéputés.fr : { "scrutins": [ { "scrutin": { "numero": 1234, "titre": "..." } }, ... ] }
        const dataScrutins = response.data.scrutins;

        if (!dataScrutins) {
            console.log("❌ Aucun scrutin trouvé dans l'API.");
            return;
        }

        let newItemsProcessed = 0;

        // On prend les 20 derniers scrutins
        const recentScrutins = dataScrutins.slice(0, 20);

        for (const item of recentScrutins) {
            const scrutin = item.scrutin;
            if (!scrutin || history.includes(scrutin.numero)) continue;

            const titreLower = scrutin.titre ? scrutin.titre.toLowerCase() : "";

            // 1. Filtre Hémicycle Plein (Votants >= 300)
            const votants = parseInt(scrutin.votants?.decompte?.nombre || 0, 10);
            if (votants < 300) {
                // Vote mineur, ignoré
                history.push(scrutin.numero);
                continue;
            }

            // 2. Filtre Mots-Clés Loi
            if (titreLower.includes("amendement")) {
                // Amendement ignoré
                history.push(scrutin.numero);
                continue;
            }

            const isMajorLaw = ["adoption définitive", "projet de loi", "motion de censure", "loi de finances"].some(kw => titreLower.includes(kw));

            // On peut être plus permissif si c'est pas un amendement mais qu'il y a > 300 votants (pour éviter de rater une loi importante mal titrée)
            // Mais pour être strict par rapport à la consigne: on continue le process quand même s'il y a > 300 votants et pas d'amendement.

            console.log(`\n🚨 SCRUTIN MAJEUR DÉTECTÉ : N°${scrutin.numero} - ${scrutin.titre.substring(0, 60)}... (${votants} votants)`);

            // 3. Rédacteur en Chef (Filtre Gemini)
            const aiResults = await analyzeScrutinWithGemini(scrutin);

            if (aiResults && aiResults.length > 0) {
                const result = aiResults[0];
                if (result.action === "KEEP" && result.flash) {
                    console.log("-> 🧠 Décodage Hémicycle validé !");

                    let formattedFlash = result.flash.replace(/\\n/g, '\n');
                    if (result.imageKeyword) {
                        formattedFlash += `\n\nTAG_IMAGE: ${result.imageKeyword}`;
                    }

                    const sourceUrl = `https://www.nosdeputes.fr/16/scrutin/${scrutin.numero}`;
                    await publishToDiscord(formattedFlash, sourceUrl, scrutin.titre);
                    newItemsProcessed++;
                } else {
                    console.log("-> 🛑 Ignoré par Gemini (pas d'impact social majeur).");
                }
            }

            history.push(scrutin.numero);
            await saveHistory(history);

            // Délai API
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log(`\n✅ Radar Hémicycle terminé. ${newItemsProcessed} alertes envoyées.`);

    } catch (err) {
        console.error("❌ Erreur API NosDéputés :", err.message);
    }
}

main();
