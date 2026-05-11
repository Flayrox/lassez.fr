import { GoogleGenAI } from '@google/genai';
import { BaseAgent } from './BaseAgent.js';

/**
 * Researcher Agent (v3.0 - Gemini 3 Reasoning Edition)
 * Mission: Fact-check the information and find historical context or "passif" of the entities involved.
 */
export class ResearcherAgent extends BaseAgent {
    constructor(apiKey, modelName = 'gemini-3-flash-preview') {
        super(apiKey, modelName);
        this.client = new GoogleGenAI({ apiKey });
    }

    async researchBatch(articles) {
        console.log(`[Agent:Researcher] 🚀 Rapide Triage Batch of ${articles.length} articles`);
        console.log(`   -> Target Model: ${this.modelName}`);
        
        const articlesList = articles.map((a, i) => `ID: ${a.id || i}\nTitre: ${a.title}\nRésumé: ${a.content.substring(0, 300)}`).join('\n\n');

        const prompt = `
            Tu es l'Analyste de Renseignement de "L'Assez". Ton rôle est de filtrer le flux entrant avec une froideur chirurgicale.
            
            TA POSTURE :
            - Pas de morale, pas de militantisme émotionnel.
            - Focus sur les structures de pouvoir, les flux financiers et la répression.
            
            TA MISSION :
            Examine cette liste d'articles et ne sélectionne QUE ceux qui présentent un intérêt pour une enquête de fond sur :
            - Corruption, ingénierie fiscale, évasion de capitaux.
            - Luttes sociales structurantes (grèves majeures, syndicalisme de combat).
            - Appareils d'État : Répression policière, surveillance, décisions législatives liberticides.
            - Géopolitique : Impérialisme, néocolonialisme économique.
            - Écologie politique : Écocides industriels, prédation des ressources.

            REJETTE CATÉGORIQUEMENT :
            - Faits divers isolés (accidents, crimes passionnels, vols).
            - Lifestyle, divertissement, sport, tech "gadget".
            - Micro-polémiques de réseaux sociaux sans enjeu de pouvoir réel.

            ARTICLES :
            ${articlesList}

            FORMAT DE SORTIE OBLIGATOIRE (JSON pur, uniquement une liste d'IDs approuvés) :
            ["id_1", "id_2"]
        `;

        try {
            console.log(`[Agent:Researcher] Calling Gemini API for batch filtering...`);
            
            const response = await this.callWithRetry(() => this.client.models.generateContent({
                model: this.modelName,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            }));

            const textResponse = response.text;
            console.log(`[Agent:Researcher] Triage complete. Output length: ${textResponse?.length || 0} chars.`);
            
            try {
                return JSON.parse(textResponse); 
            } catch (e) {
                console.warn('[Agent:Researcher] ⚠️ JSON Parse error for batch triage.');
                return [];
            }
        } catch (error) {
            console.error('[Agent:Researcher] ❌ Error during triage batch:', error.message);
            return [];
        }
    }
}
