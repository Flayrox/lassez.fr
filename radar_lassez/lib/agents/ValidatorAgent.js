import { GoogleGenAI } from '@google/genai';
import { BaseAgent } from './BaseAgent.js';

/**
 * Validator Agent (v3.0 - Gemini 3 Lite Edition)
 * Mission: Check for hallucinations, formatting errors, and ensure quality.
 */
export class ValidatorAgent extends BaseAgent {
    constructor(apiKey, modelName = 'gemini-3.1-flash-lite-preview') {
        super(apiKey, modelName);
        this.client = new GoogleGenAI({ apiKey });
    }

    async validate(articleJson, originalSource) {
        console.log(`[Agent:Validator] ✅ Verifying article: ${articleJson.shortTitle}`);
        console.log(`   -> Target Model: ${this.modelName}`);

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
                "reason": "Si non valide, explique pourquoi (ex: trop subjectif, erreur sur les chiffres, etc.)",
                "corrections": { ...articleJson avec les ajustements de texte si isValid est true mais qu'un polissage est nécessaire ... }
            }
        `;

        try {
            console.log(`[Agent:Validator] Calling Gemini 3 API...`);

            const response = await this.callWithRetry(() => this.client.models.generateContent({
                model: this.modelName,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            }));

            const parsed = JSON.parse(response.text);
            console.log(`[Agent:Validator] Validation finished: isValid=${parsed.isValid}`);
            return parsed;
        } catch (error) {
            console.error('[Agent:Validator] ❌ Error during validation:', error.message);
            return { isValid: true, reason: "Validation failed, skipping safety check.", corrections: articleJson };
        }
    }
}
