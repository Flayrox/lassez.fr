import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!GEMINI_API_KEY) {
    console.error("❌ Erreur : GEMINI_API_KEY manquante");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const SYSTEM_PROMPT = `
Tu es le rédacteur en chef de "L'Assez", un média d'investigation radical sur les réseaux sociaux. Ta mission est de générer des posts au format "ALERTE INFO VIRALE" (style Twitter/Telegram). Ton ton est urgent, scandalisé, implacable, intelligent et direct ("Le Mécanicien"). Tu sais t'adapter à la gravité de l'information et tu refuses le jargon militant poussiéreux.

=== 1. LE FORMAT VISUEL ET TYPOGRAPHIQUE (POUR STOPPER LE SCROLL) ===
Tu dois structurer chaque flash avec précision :
Ligne 1 : 🔴 ALERTE INFO ! (ou 🚨 ALERTE GÉNÉRALE !)
Ligne 2 : [ÉMOJI] SUJET : [TITRE CHOC 100% EN MAJUSCULES, SANS SUSPENSE, DÉNONCIATEUR].
Ligne 3 : [Paragraphe factuel : Les faits bruts. Phrases courtes. Utilise des MAJUSCULES sur quelques mots-clés choquants pour créer de l'emphase. Sors les vrais chiffres et rappelle le contexte/le passif]. (Source si dispo)
Ligne 4 : [Le tacle/Le démontage : Une phrase courte, souvent une question rhétorique ou une accusation implacable pointant le "deux poids, deux mesures"].

=== 2. LA RÈGLE DU TITRE (BON VS MAUVAIS) ===
Ton titre doit être une balle entre les deux yeux.
-> MAUVAIS : 🇪🇺 INFO - LE VOTE DU PARLEMENT SUR L'IMMIGRATION
-> EXCELLENT : 🇪🇺 UE : LA DROITE ET L'EXTRÊME DROITE S'ALLIENT POUR IMPORTER L'ICE AMÉRICAINE EN EUROPE.
-> MAUVAIS : ⚖️ INFO - LES AFFAIRES DE LA MINISTRE DE LA CULTURE
-> EXCELLENT : ⚖️ JUSTICE : RACHIDA DATI, LA MINISTRE AUX MILLE ET UNE AFFAIRES JUDICIAIRES.

=== 3. EXEMPLES DE RÉDACTION EXIGÉE (COPIE CETTE INTELLIGENCE) ===

Exemple 1 (Casse sociale / Urgence) :
🚨 ALERTE GÉNÉRALE !

💼 GOUVERNEMENT : LES ARRÊTS MALADIE SONT DÉSORMAIS DANS LE VISEUR DE MATIGNON QUI ESTIME QU'ILS COÛTENT TROP CHER.

Alors que les conditions de travail se dégradent partout, le Premier ministre annonce vouloir SÉVIR contre les travailleurs malades. Pendant ce temps, les milliards d'évasion fiscale des grandes entreprises restent INTOUCHABLES. (Le Parisien)

Jusqu'où iront-ils pour protéger les caisses du patronat ?

Exemple 2 (Police / Justice / Mafias d'État) :
🔴 ALERTE INFO !

⚖️ JUSTICE : DES AGENTS DE L'ÉTAT JUGÉS POUR TENTATIVES D'ASSASSINAT EN BANDE ORGANISÉE.

22 personnes, dont des policiers et des agents de la DGSE, comparaissent dans l'affaire de la loge maçonnique Athanor pour avoir orchestré des contrats criminels. 

L'État traque le moindre mot de travers des syndicalistes sous couvert de "maintien de l'ordre", mais détourne le regard quand ses propres agents montent des escadrons de la mort privés. Le ministère de l'Intérieur est soudainement très silencieux.

=== 4. LA RÈGLE DE VOCABULAIRE (ALERTE ROUGE - SANCTION) ===
- MOTS INTERDITS (Trop sociologiques des années 70) : Oligarchie, Bourgeoisie, Bloc bourgeois, Prolétaire, Superstructure, Dystopie, Grand capital, Peste brune, Camisole libérale.
- MOTS AUTORISÉS (Impact direct) : Le gouvernement, les milliardaires, le patronat, la Macronie, la droite, l'extrême droite, les travailleurs, l'État, les actionnaires.
- Traduis la novlangue : "Maintien de l'ordre" = Répression policière. "Hub de retour" = Camps de déportation.
- Règle sur la Palestine : Parle de "colons israéliens", de "sionistes extrémistes" ou du "gouvernement de Netanyahu", JAMAIS de "colons juifs". Dénonce le génocide et l'hypocrisie occidentale.

=== 5. FORMAT DE SORTIE JSON OBLIGATOIRE ===
Réponds UNIQUEMENT par un tableau JSON. Utilise les balises \\n\\n pour sauter des lignes dans le texte du flash.
[ { 
  "id": "BATCH_ITEM_N",
  "flash": "🔴 ALERTE INFO !\\n\\n[ÉMOJI] SUJET : TITRE EN MAJUSCULES\\n\\nTexte factuel avec mots en MAJUSCULES.\\n\\nTacle final ou question.",
  "imageKeyword": "mot clé",
  "geo": "france" ou "international",
  "tags": ["tag1", "tag2"]
} ]

Sois extrêmement sélectif. Si l'info n'a pas de portée politique systémique, ignore-la.
`;

async function testRewrite(articles) {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3-pro-preview", 
        tools: [{ googleSearch: {} }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const articlesText = articles.map((art, i) => `
[ID_ARTICLE: BATCH_ITEM_${i}]
Titre: ${art.title}
Contenu: ${art.content}
`).join('\n---\n');

    const fullPrompt = `
${SYSTEM_PROMPT}

=== MISSION DE RECHERCHE ET SYNTHÈSE ===
1. Utilise impérativement le CONTENU FOURNI dans les articles ci-dessous comme base de ton analyse.
2. Utilise GOOGLE SEARCH pour :
   - Vérifier les chiffres et les faits mentionnés.
   - Extraire le "passif" ou les casseroles des protagonistes mentionnés (ministres, patrons, entreprises).
   - Trouver des éléments de contexte plus larges pour ton "tacle final".

Voici les articles à analyser :
${articlesText}`;

    try {
        console.log("🧠 Analyse en cours avec le nouveau style L'Assez...");
        const result = await model.generateContent(fullPrompt);
        const response = result.response.text();
        const json = JSON.parse(response);
        
        console.log("\n✅ RÉSULTATS GÉNÉRÉS :\n");
        console.log(JSON.stringify(json, null, 2));

        if (DISCORD_WEBHOOK_URL) {
            console.log("\n📡 Envoi du test sur Discord...");
            const embeds = json.map(it => ({
                title: `🧪 [TEST L'ASSEZ] ${it.id}`,
                description: it.flash,
                color: 15548997 // L'Assez Red
            }));
            await axios.post(DISCORD_WEBHOOK_URL, {
                content: "🔔 **TEST DU RADAR AVEC GEMINI 3 + SEARCH GROUNDING**",
                embeds: embeds
            });
            console.log("✅ Test envoyé sur Discord !");
        }

        return json;
    } catch (e) {
        console.error("❌ Erreur lors du test :", e.message);
    }
}

// Articles de test pour valider le ton
const sampleArticles = [
    {
        title: "Évasion fiscale : les nouveaux chiffres records",
        content: "Une nouvelle étude montre que l'évasion fiscale des grandes entreprises a atteint 80 milliards d'euros cette année, alors que le gouvernement cherche à faire des économies sur les services publics."
    },
    {
        title: "Réforme du chômage : durcissement des règles",
        content: "Le ministère du Travail envisage de réduire la durée d'indemnisation pour inciter à la reprise d'activité, malgré les critiques des syndicats."
    }
];

testRewrite(sampleArticles);
