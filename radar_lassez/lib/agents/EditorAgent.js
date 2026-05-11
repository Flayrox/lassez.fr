import { GoogleGenAI } from '@google/genai';
import { BaseAgent } from './BaseAgent.js';

/**
 * Editor Agent (v3.0 - Gemini 3 Flash Edition)
 * Mission: Rewrite the article with the "L'Assez" tone based on the research.
 */
export class EditorAgent extends BaseAgent {
    constructor(apiKey, modelName = 'gemini-3-flash-preview', customPrompt = '') {
        super(apiKey, modelName);
        this.client = new GoogleGenAI({ apiKey });
        this.customPrompt = customPrompt;
    }

    async rewrite(articles, researchContext, type = 'BREAKING') {
        // Handle both single article and array of articles from batching
        const articleList = Array.isArray(articles) ? articles : [articles];
        const titles = articleList.map(a => a.title).join(' | ');
        console.log(`[Agent:Editor] 🖋️ Crafting ${type} flash from ${articleList.length} sources: ${titles}`);
        console.log(`   -> Target Model: ${this.modelName}`);

        const baseInstructions = this.customPrompt || `
            Tu es l'Éditorialiste OSINT de "L'Assez", un média ancré dans une gauche de rupture (anticapitaliste, anti-impérialiste, antifasciste).
            
            TA POSTURE:
            - La froideur de la preuve : Informe comme un rapport de renseignement (True Crime, Mediapart). Ne fais pas de morale ni de prêchi-prêcha indignation.
            - BANNIS le jargon militant ("le grand capital", "les masses laborieuses", "camarades").
            - UTILISE un vocabulaire clinique : "prédation économique", "asymétrie des pouvoirs", "ingénierie fiscale", "désinformation industrielle".

            TA MISSION:
            - Rédiger un "Flash" ultra percutant en formatant les données brutes et le contexte (Casier Judiciaire Politique + OSINT).
            - Si plusieurs articles te sont fournis, synthétise-les en UNE grande alerte systémique illustrant les ramifications du sujet.
            - Évite les exclamations abusives. Expose les faits et les contradictions.
        `;

        const articlesContent = articleList.map((a, i) => `--- SOURCE ${i+1} ---\nTitre: ${a.title}\nContenu: ${a.content}`).join('\n\n');

        const prompt = `
            ${baseInstructions}

            TYPE DEMANDÉ : ${type}
            
            ARTICLES BRUTS (À CROISER/SYNTHÉTISER) :
            ${articlesContent}

            CONTEXTE GLOBAL (RECHERCHE OSINT + CASIER POLITIQUE) :
            ${researchContext}

            FORMAT DE SORTIE OBLIGATOIRE (JSON) :
            {
                "typeOuverture": "Le tag correspondant au type (ex: 🔴 RENSEIGNEMENT ou 🔴 ALERTE INFO)",
                "theme": "Thème en un mot (ex: JUSTICE, POLICE, ECOLOGIE)",
                "themeEmoji": "Emoji correspondant au thème",
                "shortTitle": "Titre choc sans emojis",
                "flash": "Texte complet (fusion des articles et du contexte). Informe de manière clinique.",
                "punchline": "Résumé piquant de 6 à 10 mots",
                "imageKeyword": "Mot-clé anglais (pour recherche d'illustration)",
                "geo": "france" ou "international",
                "tags": ["tag1", "tag2"],
                "fiabilite": "haute" | "moyenne" | "suspecte"
            }
        `;

        try {
            console.log(`[Agent:Editor] Calling Gemini API...`);
            
            const response = await this.callWithRetry(() => this.client.models.generateContent({
                model: this.modelName,
                contents: prompt,
                config: {
                    thinkingConfig: {
                        thinkingLevel: "high"
                    },
                    responseMimeType: 'application/json'
                }
            }));

            const parsed = JSON.parse(response.text);
            console.log(`[Agent:Editor] Rewrite complete: ${parsed.shortTitle}`);
            return parsed;
        } catch (error) {
            console.error('[Agent:Editor] ❌ Error during writing:', error.message);
            return null;
        }
    }
}
