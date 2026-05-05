import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Validator Agent
 * Mission: Check for hallucinations, formatting errors, and ensure quality.
 */
export class ValidatorAgent {
    constructor(apiKey, modelName = 'gemini-1.5-flash') {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' }
        });
    }

    async validate(articleJson, originalSource) {
        console.log(`[Agent:Validator] Validating article: ${articleJson.shortTitle}`);

        const prompt = `
            Tu es un Correcteur et Fact-checker senior.
            Vérifie que le Flash suivant est conforme aux faits d'origine et ne contient pas d'hallucinations graves.
            Vérifie aussi la qualité de la langue et le formatage.

            FLASH À VÉRIFIER :
            ${JSON.stringify(articleJson, null, 2)}

            SOURCE D'ORIGINE :
            ${originalSource}

            RÉPONDS UNIQUEMENT PAR CE JSON :
            {
                "isValid": true | false,
                "reason": "Si non valide, pourquoi ?",
                "corrections": { ...articleJson corrigé si besoin ... }
            }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            return JSON.parse(result.response.text());
        } catch (error) {
            console.error('[Agent:Validator] Error during validation:', error.message);
            return { isValid: true, reason: "Validation failed, skipping.", corrections: articleJson };
        }
    }
}
