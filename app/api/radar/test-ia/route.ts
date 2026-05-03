import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Database from 'better-sqlite3';
import path from 'path';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath, { readonly: true });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { textToTest } = body;

        if (!textToTest) {
            return NextResponse.json({ success: false, error: 'Texte manquant' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Clé API Gemini non configurée' }, { status: 500 });
        }

        // Get AI prompt from settings
        const db = getDb();
        const promptRow = db.prepare('SELECT value FROM radar_settings WHERE key = ?').get('ai_prompt') as { value: string } | undefined;
        db.close();

        const customPrompt = promptRow?.value || '';

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro", 
            tools: [{ googleSearchRetrieval: {} } as any],
        });

        const fullPrompt = `
${customPrompt}

=== MISSION DE RECHERCHE ET SYNTHÈSE ===
1. Utilise impérativement le CONTENU FOURNI dans les articles ci-dessous comme base de ton analyse.
2. Utilise GOOGLE SEARCH pour :
   - Vérifier les chiffres et les faits mentionnés.
   - Extraire le "passif" ou les casseroles des protagonistes mentionnés (ministres, patrons, entreprises).
   - Trouver des éléments de contexte plus larges pour ton "tacle final".

=== FORMAT DE SORTIE OBLIGATOIRE (JSON ARRAY) ===
Réponds UNIQUEMENT par un tableau JSON avec exactement ces champs :
[ { 
  "id": "BATCH_ITEM_N",
  "shortTitle": "titre choc sans emojis",
  "flash": "texte complet du flash L'Assez",
  "imageKeyword": "mot-clé image",
  "geo": "france" ou "international",
  "tags": ["tag1", "tag2"]
} ]
- "shortTitle" : Un titre très court et choc (max 6-8 mots) résumant l'info pour l'image.
- "flash" : Le texte rédigé selon les règles de style de L'Assez (ALERTE INFO, ÉMOJI, SUJET, etc).

Voici les articles à analyser (Source principale) :

[ID_ARTICLE: BATCH_ITEM_TEST]
Titre original: Test Manuel
Contenu: ${textToTest}
---
`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const response = await result.response;
        const rawText = response.text() || "";
        
        let jsonResponse;
        try {
            let cleanText = rawText.replace(/```json/i, '').replace(/```/g, '').trim();
            jsonResponse = JSON.parse(cleanText);
        } catch (parseErr: any) {
            console.error("JSON Parse Failed:", parseErr.message);
            jsonResponse = [{ id: 'PARSE_ERROR', flash: 'Erreur de parsing JSON. Le modèle a retourné : \n' + rawText, shortTitle: 'Erreur' }];
        }

        return NextResponse.json({ success: true, results: jsonResponse });
    } catch (error: any) {
        console.error("Erreur API Test IA:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
