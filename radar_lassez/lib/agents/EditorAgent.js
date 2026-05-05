import { GoogleGenAI } from '@google/genai';

/**
 * Editor Agent (v3.0 - Gemini 3 Flash Edition)
 * Mission: Rewrite the article with the "L'Assez" tone based on the research.
 */
export class EditorAgent {
    constructor(apiKey, modelName = 'gemini-3-flash-preview', customPrompt = '') {
        this.client = new GoogleGenAI({ apiKey });
        this.modelName = modelName;
        this.customPrompt = customPrompt;
    }

    async rewrite(article, researchContext, type = 'BREAKING') {
        console.log(`[Agent:Editor] 🖋️ Crafting ${type} flash: ${article.title}`);
        console.log(`   -> Target Model: ${this.modelName}`);

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
            console.log(`[Agent:Editor] Calling Gemini 3 API...`);
            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });
            const parsed = JSON.parse(response.text);
            console.log(`[Agent:Editor] Rewrite complete: ${parsed.shortTitle}`);
            return parsed;
        } catch (error) {
            console.error('[Agent:Editor] ❌ Error during writing:', error.message);
            console.error('Raw response might be:', response?.text);
            return null;
        }
    }
}
