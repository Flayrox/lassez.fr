import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Editor Agent
 * Mission: Rewrite the article with the "L'Assez" tone based on the research.
 */
export class EditorAgent {
    constructor(apiKey, modelName = 'gemini-1.5-pro', customPrompt = '') {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' }
        });
        this.customPrompt = customPrompt;
    }

    async rewrite(article, researchContext, type = 'BREAKING') {
        console.log(`[Agent:Editor] Writing article as ${type}: ${article.title}`);

        // Default style guide if no custom prompt is provided
        const baseInstructions = this.customPrompt || `
            Tu es le Rédacteur en Chef de L'Assez, un média d'investigation politique indépendant et très incisif.
            Ton but est de transformer une information brute et son contexte de recherche en un "Flash" percutant.
            Utilise un ton sarcastique, précis, engagé et n'hésite pas à souligner les contradictions du pouvoir.
        `;

        const prompt = `
            ${baseInstructions}

            TYPE DEMANDÉ : ${type}
            
            DONNÉES BRUTES :
            ${article.content}

            CONTEXTE DE RECHERCHE :
            ${researchContext}

            FORMAT DE SORTIE OBLIGATOIRE (JSON) :
            {
                "typeOuverture": "Le tag correspondant au type (ex: 🔴 ALERTE INFO ! ou autre)",
                "theme": "Thème en un mot (ex: JUSTICE, POLICE, ECOLOGIE)",
                "themeEmoji": "Emoji correspondant au thème",
                "shortTitle": "Titre choc sans emojis",
                "flash": "Texte complet commençant par le tag d'ouverture. Ton incisif.",
                "punchline": "Résumé piquant de 6 à 10 mots",
                "imageKeyword": "Mot-clé anglais pour l'image",
                "geo": "france" ou "international",
                "tags": ["tag1", "tag2"],
                "fiabilite": "haute" | "moyenne" | "suspecte"
            }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            return JSON.parse(result.response.text());
        } catch (error) {
            console.error('[Agent:Editor] Error during writing:', error.message);
            return null;
        }
    }
}
