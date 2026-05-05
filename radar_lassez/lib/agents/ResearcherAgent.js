import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Researcher Agent
 * Mission: Fact-check the information and find historical context or "passif" of the entities involved.
 */
export class ResearcherAgent {
    constructor(apiKey, modelName = 'gemini-1.5-pro') {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: modelName,
            tools: [{ googleSearch: {} }]
        });
    }

    async research(article) {
        console.log(`[Agent:Researcher] Researching context for: ${article.title}`);
        
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
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error('[Agent:Researcher] Error during research:', error.message);
            return "Aucune recherche supplémentaire n'a pu être effectuée.";
        }
    }
}
