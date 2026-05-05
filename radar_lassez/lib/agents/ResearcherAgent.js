import { GoogleGenAI } from '@google/genai';

/**
 * Researcher Agent (v3.0 - Gemini 3 Reasoning Edition)
 * Mission: Fact-check the information and find historical context or "passif" of the entities involved.
 */
export class ResearcherAgent {
    constructor(apiKey, modelName = 'gemini-3.1-pro-preview') {
        this.client = new GoogleGenAI({ apiKey });
        this.modelName = modelName;
    }

    async research(article) {
        console.log(`[Agent:Researcher] 🧠 Thinking deeply about: ${article.title}`);
        console.log(`   -> Target Model: ${this.modelName}`);
        
        const prompt = `
            Tu es un chercheur OSINT et fact-checker pour un média d'investigation. 
            Ta mission est d'analyser l'information suivante et d'utiliser Google Search pour :
            1. Vérifier la véracité des faits et chiffres mentionnés.
            2. Identifier les personnalités ou entreprises citées et trouver leur "passif" (scandales passés, condamnations, casseroles, liens d'intérêts).
            3. Trouver des éléments de contexte plus larges (historique du sujet, enjeux cachés).

            ARTICLE À ANALYSER :
            Titre : ${article.title}
            Source : ${article.sourceTitle}
            Contenu : ${article.content.substring(0, 2000)}

            Rends un rapport structuré avec :
            - Vérification des faits (Vrai/Faux/Partiel)
            - Éléments de contexte (Casseroles, historique)
            - Liens de sources fiables trouvées
        `;

        try {
            console.log(`[Agent:Researcher] Calling Gemini 3 API...`);
            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    thinkingConfig: {
                        thinkingLevel: "high"
                    }
                }
            });
            console.log(`[Agent:Researcher] Research complete. Output length: ${response.text?.length || 0} chars.`);
            return response.text;
        } catch (error) {
            console.error('[Agent:Researcher] ❌ Error during research:', error.message);
            return "Aucune recherche supplémentaire n'a pu être effectuée.";
        }
    }
}
