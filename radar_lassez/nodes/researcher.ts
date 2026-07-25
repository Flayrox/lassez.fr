import { GoogleGenAI, Type } from '@google/genai';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

const FALLBACK_RESEARCHER_SYSTEM = `Tu es un rédacteur en chef d'investigation. Ton rôle est de trier et évaluer la valeur journalistique des dépêches brutes.`;
const FALLBACK_REJECT_CRITERIA = `Rejeter les faits divers mineurs sans portée sociétale, la publicité déguisée et les annonces corporate triviales.`;

/**
 * Nœud 3 : Researcher (Filtrage & Triage IA)
 * 
 * Analyse les dépêches brutes (statut INGESTED) via le modèle Gemini Flash rapide.
 * Attribue un score d'intérêt journalistique (0 à 100), filtre les sujets triviaux
 * et associe les taxonomies éditoriales appropriées.
 */
export async function runResearcherNode() {
    console.log(`\n[Node 3: Researcher] 🧠 Lancement du filtrage IA (Triage Rapide)...`);

    const topics = await prisma.newsTopic.findMany({
        where: { status: 'INGESTED' }
    });

    if (topics.length === 0) {
        console.log(`[Node 3] ℹ️ Aucun sujet (statut: INGESTED) à analyser.`);
        return;
    }

    console.log(`[Node 3] 🔍 ${topics.length} sujets en attente d'analyse IA.`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn(`[Node 3] ⚠️ Variable d'environnement GEMINI_API_KEY absente. Étape ignorée.`);
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Résolution dynamique des modèles et de la concurrence depuis Prisma
    const requestedModel = await getEffectiveParam('research', 'aiModelFlash', 'gemini-3-flash-preview');
    const customPrompt = await getEffectiveParam('research', 'customPromptModifier', '');
    const concurrencyLimit = await getEffectiveParam('research', 'maxConcurrentTasks', 5);

    const settings: any = await prisma.globalSettings.findFirst();
    const researcherSystem = settings?.researcherSystemPrompt || FALLBACK_RESEARCHER_SYSTEM;
    const rejectCriteria = settings?.researcherRejectCriteria || FALLBACK_REJECT_CRITERIA;

    const taxonomyTemplates: any[] = await (prisma as any).taxonomyTemplate.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });

    const limit = pLimit(Number(concurrencyLimit));

    const tasks = topics.map(topic => limit(async () => {
        try {
            let rawData: any = {};
            try { rawData = JSON.parse(topic.raw_data || '{}'); } catch (e) { }

            const promptText = `
${researcherSystem}

CRITÈRES DE REJET :
${rejectCriteria}

${customPrompt ? `CONSIGNES ÉDITORIALES SPÉCIFIQUES :\n${customPrompt}\n` : ''}

SUJET À ÉVALUER :
Titre : ${rawData.clusterTitle || 'Sujet sans titre'}
Extrait : ${rawData.excerpt || rawData.source_content || ''}
Source : ${rawData.source_name || 'Inconnue'}
            `.trim();

            const response = await ai.models.generateContent({
                model: requestedModel,
                contents: promptText,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            approved: { type: Type.BOOLEAN, description: 'True si le sujet présente une valeur journalistique' },
                            score: { type: Type.INTEGER, description: 'Note de 0 à 100' },
                            reason: { type: Type.STRING, description: 'Justification succincte du choix' },
                            suggestedTaxonomy: { type: Type.STRING, description: 'Catégorie suggérée' },
                            suggestedGeo: { type: Type.STRING, description: 'Zone géographique concernée (ex: France, International)' }
                        },
                        required: ['approved', 'score', 'reason']
                    }
                }
            });

            const resultText = response.text;
            if (!resultText) throw new Error("Réponse vide générée par Gemini");

            const evaluation = JSON.parse(resultText);

            if (evaluation.approved && evaluation.score >= 50) {
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: {
                        status: 'RESEARCHED',
                        taxonomy: evaluation.suggestedTaxonomy || 'INFO',
                        geo: evaluation.suggestedGeo || 'FRANCE'
                    }
                });
                console.log(`[Node 3] ✅ Approved (Score: ${evaluation.score}/100) : ${rawData.clusterTitle || topic.id}`);
            } else {
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'REJECTED' }
                });
                console.log(`[Node 3] ❌ Rejeté (${evaluation.reason}) : ${rawData.clusterTitle || topic.id}`);
            }

        } catch (error: any) {
            console.error(`[Node 3] ❌ Erreur analyse sujet ${topic.id}:`, error.message);
        }
    }));

    await Promise.all(tasks);
    console.log(`[Node 3: Researcher] Analyse IA terminée pour tous les sujets.`);
}