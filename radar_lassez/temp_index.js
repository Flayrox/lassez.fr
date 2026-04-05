import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
    RSS_FEEDS: [
        // Médias Indépendants & Proches LFI/Gauche
        'https://www.mediapart.fr/articles/feed',
        // 'https://www.blast-info.fr/rss.xml', // Renvoie 404 actuellement
        'https://reporterre.net/spip.php?page=backend',
        // 'https://www.streetpress.com/feed', // Renvoie 404 actuellement
        'https://www.humanite.fr/feed',
        'https://basta.media/spip.php?page=backend',

        // Politiques (Blogs persos ou RSShub pour X/Twitter)
        // 'https://www.jean-luc-melenchon.fr/feed/', // Erreur de certificat TLS
        // 'https://rsshub.app/twitter/user/MathildePanot',      // Remplace par ton instance RSSHub locale plus tard
        // 'https://rsshub.app/twitter/user/Francois_Ruffin',

        // Médias Mainstream (Pour alimenter la critique médias / décryptage)
        'https://www.huffingtonpost.fr/rss/all_full.xml',
        'https://www.france24.com/fr/rss',
        'https://www.franceinfo.fr/politique.rss'
    ],
    HISTORY_FILE: path.join(__dirname, 'historique.json'),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL
};

const parser = new Parser({
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

// -- 1. GESTION DE LA MEMOIRE --
async function loadHistory() {
    try {
        const data = await fs.readFile(CONFIG.HISTORY_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function saveHistory(history) {
    await fs.writeFile(CONFIG.HISTORY_FILE, JSON.stringify(history, null, 2));
}

// -- 2. LE CERVEAU (Gemini avec output JSON en Batch) --
async function rewriteBatchWithGemini(itemsBatch) {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    // On prépare les articles à analyser
    const articlesText = itemsBatch.map((item, index) => `
[ID_ARTICLE: ${item.id}]
Titre original: ${item.title}
Contenu: ${item.content.substring(0, 1500)}
---
`).join('\n');

    const prompt = `
Tu es le rédacteur en chef du média d'investigation indépendant "L'Assez". Tu rédiges un fil d'actualité en direct (style Telegram/Twitter).
On te fournit une liste d'articles d'actualité brute.

=== 1. FILTRE ÉDITORIAL ===
Tu dois rejeter et ignorer complètement les dépêches sur : le sport (JO, foot...), les potins, le lifestyle, la culture légère, les apps de rencontres ou des faits divers isolés sans enjeux de société.
Tu ne gardes que : Politique, International, OSINT, Justice, Dérives d’État, Scandales financiers, Mouvements sociaux.

=== 2. DÉDUPLICATION SÉMANTIQUE (ANTI-SPAM) ===
Dans la liste fournie, il est très probable que plusieurs médias (ex: HuffPost et France24) parlent EXACTEMENT du même événement. 
Tu NE DOIS SURTOUT PAS créer deux flashs séparés pour le même événement.
Si tu repères des doublons, FUSIONNE-LES en UN SEUL Flash L'Assez. Choisis l'ID de l'article le plus riche en informations comme ID de référence pour le JSON. Les autres seront ignorés.

=== 3. FORMAT L'ASSEZ (TWEET/FLASH) ===
Pour chaque événement retenu, rédige un "Flash" ultra-concis, direct et percutant. Pas de baratin.
Structure stricte du texte :
[Emojis pertinents (ex: 🔴 🇫🇷👮 ou 🇮🇱🇵🇸)] INFO - [Titre d'accroche direct et très PROVOCATEUR]

[1 à 3 paragraphes très courts résumant les faits réels. Pas de fioriture.]

=== 4. REMISE EN CONTEXTE / FACT-CHECKING (CRUCIAL) ===
C'est la marque de fabrique de L'Assez. Tu DOIS repérer le sous-texte et rétablir la vérité sociologique ou politique en fin de Flash.
- Ex: Si la droite accuse la gauche de "violence", rappelle factuellement que les vraies condamnations (violences, racisme) concernent massivement des militants d'extrême droite, mais que le narratif médiatique dominant (possédé par des milliardaires) impose l'inverse pour faire peur.
- Ex: Si on parle d'une affaire de corruption, souligne le deux poids deux mesures par rapport à la délinquance de rue.

=== 5. FORMAT DE SORTIE OBLIGATOIRE (JSON ARRAY) ===
Tu dois répondre UNIQUEMENT par un tableau JSON valide contenant les articles retenus, avec la structure suivante :
[
  {
    "id": "ID_ARTICLE correspondant fourni dans le prompt",
    "flash": "Le texte formaté L'Assez, incluant les emojis, les sauts de ligne (\\\\n), et le fact-checking piquant.",
    "imageKeyword": "UN SEUL mot-clé en anglais (ex: police, macron, finance, riot) qui illustre l'article pour recherche d'image"
  }
]
Si aucun article n'est retenu, renvoie un tableau vide [].

Voici les articles à analyser :
${articlesText}
    `;

    try {
        const result = await model.generateContent(prompt);
        const jsonResponse = JSON.parse(result.response.text());
        return jsonResponse;
    } catch (error) {
        console.error("Erreur Gemini lors du traitement :", error.message);
        return [];
    }
}

// -- 3. LA DIFFUSION (Webhook Discord Phase 1) --
async function publishToDiscord(markdownText, sourceUrl, sourceTitle, imageUrl) {
    if (!CONFIG.DISCORD_WEBHOOK_URL) {
        console.error("Webhook Discord manquant dans le fichier .env !");
        return;
    }

    const embed = {
        title: "📡 Nouvelle Dépêche Radar Décryptée",
        description: markdownText,
        url: sourceUrl,
        color: 13631488, // Rouge L'Assez (#D00000 -> 13631488)
        footer: {
            text: `Source traitée : ${sourceTitle}`
        }
    };

    if (imageUrl) {
        embed.image = { url: imageUrl };
    }

    const payload = {
        embeds: [embed]
    };

    try {
        await axios.post(CONFIG.DISCORD_WEBHOOK_URL, payload, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log("-> ✅ Article envoyé sur Discord !");
    } catch (err) {
        console.error("-> ❌ Erreur Discord:", err.response?.data || err.message);
    }
}

// -- FONCTION PRINCIPALE --
async function main() {
    console.log("🚀 Démarrage du Radar L'Assez (Phase 1 : Discord Batch)...");

    const history = await loadHistory();
    let unreadItems = [];

    // 1. Collecter tous les nouveaux articles non lus
    for (const feedUrl of CONFIG.RSS_FEEDS) {
        console.log(`\n🔍 Scan du flux : ${feedUrl}`);
        try {
            const feed = await parser.parseURL(feedUrl);
            const recentItems = feed.items.slice(0, 10); // on prend un peu plus large car on filtre ensuite

            for (const item of recentItems) {
                const itemId = item.guid || item.link;
                if (!history.includes(itemId)) {

                    // Récupération intelligente de l'image (sans API IA, directement via le RSS)
                    let imageUrl = null;

                    // Cas 1 : Enclosure standard (ex: France24)
                    if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) {
                        imageUrl = item.enclosure.url;
                    }
                    // Cas 2 : Balise media:content (ex: Mediapart, Yahoo)
                    else if (item.mediaContent && item.mediaContent['$'] && item.mediaContent['$'].url) {
                        imageUrl = item.mediaContent['$'].url;
                    }
                    // Cas 3 : Fouille dans le HTML du contenu décodé (ex: Huffington Post)
                    else {
                        // Le 'content:encoded' contient tout le HTML formatté de l'article WordPress
                        const contentToCheck = item.contentEncoded || item['content:encoded'] || item.content || '';
                        const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"'>]+)["']/i;
                        const match = contentToCheck.match(imgRegex);
                        if (match) {
                            // On remplace les caractères encodés éventuels
                            imageUrl = match[1].replace(/&amp;/g, '&');
                        }
                    }

                    unreadItems.push({
                        id: itemId,
                        title: item.title,
                        link: item.link,
                        content: item.contentSnippet || item.content || item.summary || "",
                        sourceTitle: feed.title,
                        imageUrl: imageUrl
                    });
                }
            }
        } catch (error) {
            console.error(`⚠️ Erreur sur le flux ${feedUrl} :`, error.message);
        }
    }

    console.log(`\n📥 ${unreadItems.length} nouvelles dépêches globales détectées.`);

    if (unreadItems.length === 0) {
        console.log("✅ Terminé. Rien de neuf sous le soleil.");
        return;
    }

    // On sélectionne max 10 articles pour le batch (limite de taille de contexte)
    const batchToProcess = unreadItems.slice(0, 10);
    console.log(`🧠 Envoi de ${batchToProcess.length} articles à l'IA d'un coup...`);

    // 2. Traitement par lot
    const aiResults = await rewriteBatchWithGemini(batchToProcess);

    if (aiResults && aiResults.length > 0) { console.log(JSON.stringify(aiResults, null, 2));
        console.log(`✅ L'IA a retenu et condensé ${aiResults.length} articles pertinents.`);

        // 3. Boucle de publication
        let newItemsCount = 0;
        for (const result of aiResults) {
            const originalItem = batchToProcess.find(i => i.id === result.id);
            if (originalItem && result.flash) {
                // Correction de l'affichage des retours à la ligne JSON
                let formattedFlash = result.flash.replace(/\\n/g, '\n');

                // Ajout du TAG_IMAGE pour le futur pipeline visuel et pour tests
                if (result.imageKeyword) {
                    formattedFlash += `\n\nTAG_IMAGE: ${result.imageKeyword}`;
                }

                await publishToDiscord(formattedFlash, originalItem.link, originalItem.sourceTitle, originalItem.imageUrl);

                // Mettre à jour l'historique
                history.push(result.id);
                newItemsCount++;
                await saveHistory(history);

                // Petit délai pour ne pas flooder le Webhook Discord (5 req/sec limite)
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // On marque également comme 'lus' les articles qui ont été rejetés par l'IA 
        // pour ne pas lui renvoyer en boucle à chaque lancement
        const rejectedItems = batchToProcess.filter(i => !aiResults.some(res => res.id === i.id));
        for (const rejected of rejectedItems) {
            history.push(rejected.id);
        }
        await saveHistory(history);

        console.log(`\n✅ Terminé. ${newItemsCount} nouvelles dépêches envoyées sur le Radar.`);
    } else {
        console.log(`\n✅ L'IA a rejeté tous les articles (hors ligne éditoriale ou erreur). On les marque comme lus pour ne plus les vérifier.`);
        for (const item of batchToProcess) {
            history.push(item.id);
        }
        await saveHistory(history);
    }
}

main();
