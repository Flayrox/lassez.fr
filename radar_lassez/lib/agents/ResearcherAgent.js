import { GoogleGenAI } from '@google/genai';

/**
 * Researcher Agent (v3.0 - Gemini 3 Reasoning Edition)
 * Mission: Fact-check the information and find historical context or "passif" of the entities involved.
 */
export class ResearcherAgent {
    constructor(apiKey, modelName = 'gemini-3-flash-preview') {
        this.client = new GoogleGenAI({ apiKey });
        this.modelName = modelName;
    }

    async researchBatch(articles) {
        console.log(`[Agent:Researcher] 🚀 Rapide Triage Batch of ${articles.length} articles`);
        console.log(`   -> Target Model: ${this.modelName}`);
        
        const articlesList = articles.map((a, i) => `ID: ${a.id || i}\nTitre: ${a.title}\nRésumé: ${a.content.substring(0, 300)}`).join('\n\n');

        const prompt = `
            Tu es le filtre d'entrée pour L'Assez, un média politique anticapitaliste d'investigation.
            
            TA MISSION:
            Examine cette liste d'articles et NE RETIENS QUE ceux qui concernent : corruption, ingénierie fiscale, luttes sociales (grèves, syndicats), répression policière, violences d'État, impérialisme, écologie politique, etc.
            REJETTE : faits divers (crashes, vols, meurtres simples), culture, loisirs, sport pur, start-up, polémiques stériles sur twitter.

            ARTICLES :
            ${articlesList}

            FORMAT DE SORTIE OBLIGATOIRE (JSON pur, liste d'IDs approuvés) :
            ["id_1", "id_2"]
        `;

        try {
            console.log(`[Agent:Researcher] Calling Gemini API for batch filtering...`);
            // Pas de thinking ici, on veut de la vitesse
            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });
            const textResponse = response.text;
            console.log(`[Agent:Researcher] Triage complete. Output length: ${textResponse?.length || 0} chars.`);
            
            try {
                return JSON.parse(textResponse); // Return array of IDs
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
