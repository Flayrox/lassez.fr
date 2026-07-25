import { GoogleGenAI, Type } from '@google/genai';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

const FALLBACK_BASE_IDENTITY = `Tu es le rédacteur en chef du média d'investigation L'Assez. Ton style est percutant, analytique et sans langue de bois.`;
const FALLBACK_RESEARCH_MISSION = `Transformer les informations brutes en un compte-rendu d'investigation captivant et étayé.`;
const FALLBACK_VOCABULARY_RULES = `Utiliser un vocabulaire précis, incisif et factuel. Bannir le jargon vague et le sensationnalisme gratuit.`;
const FALLBACK_IMAGE_RULES = `Suggérer des mots-clés d'illustrations sobres et évocateurs.`;

/**
 * Nœud 4 : Editorialist (Rédaction d'Investigation IA Pro)
 * 
 * Génère le corps de l'article d'investigation en assemblant dynamiquement la charte éditoriale
 * de L'Assez et les consignes propres à chaque catégorie via Gemini Pro.
 */
export async function runEditorialistNode() {
    console.log(`\n[Node 4: Editorialist] ✍️ Lancement de la rédaction IA (Modèle Pro)...`);

    const topics = await prisma.newsTopic.findMany({
        where: { status: 'RESEARCHED' }
    });

    if (topics.length === 0) {
        console.log(`[Node 4] ℹ️ Aucun sujet (statut: RESEARCHED) à rédiger.`);
        return;
    }

    console.log(`[Node 4] 📝 ${topics.length} sujets prêts pour rédaction d'investigation.`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn(`[Node 4] ⚠️ Variable d'environnement GEMINI_API_KEY absente. Étape ignorée.`);
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Normalisation sécurisée des chaînes de modèles IA Pro
    const rawModel = await getEffectiveParam('editor', 'aiModelPro', 'gemini-2.5-pro');
    const requestedModel = rawModel.includes('3.') ? 'gemini-2.5-pro' : rawModel;
    const concurrencyLimit = await getEffectiveParam('editor', 'maxConcurrentTasks', 3);

    const settings: any = await prisma.globalSettings.findFirst();
    const baseIdentity = settings?.baseIdentityPrompt || FALLBACK_BASE_IDENTITY;
    const researchMission = settings?.researchMissionPrompt || FALLBACK_RESEARCH_MISSION;
    const vocabularyRules = settings?.vocabularyRulesPrompt || FALLBACK_VOCABULARY_RULES;
    const imageRules = settings?.imageRulesPrompt || FALLBACK_IMAGE_RULES;

    const taxonomyTemplates: any[] = await (prisma as any).taxonomyTemplate.findMany({
        where: { active: true },
    });

    const limit = pLimit(Number(concurrencyLimit));

    const tasks = topics.map(topic => limit(async () => {
        try {
            let rawData: any = {};
            try { rawData = JSON.parse(topic.raw_data || '{}'); } catch (e) { }

            const topicTaxonomy = topic.taxonomy || 'INFO';
            const matchedTemplate = taxonomyTemplates.find(t => t.slug === topicTaxonomy || t.name === topicTaxonomy);

            const systemPrompt = `
${baseIdentity}
${researchMission}
${vocabularyRules}
${imageRules}

${matchedTemplate ? `CONSIGNES CATÉGORIE [${matchedTemplate.name}] :\n${matchedTemplate.promptText}\n` : ''}
            `.trim();

            const userPrompt = `
REDACTION DU DOSSIER :
Titre source : ${rawData.clusterTitle || 'Sujet sans titre'}
Contenu source : ${rawData.excerpt || rawData.source_content || ''}
Catégorie : ${topicTaxonomy}
Zone Geo : ${topic.geo || 'Global'}
            `.trim();

            const response = await ai.models.generateContent({
                model: requestedModel,
                contents: `${systemPrompt}\n\n${userPrompt}`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            headline: { type: Type.STRING, description: 'Titre percutant au style L\'Assez' },
                            body: { type: Type.STRING, description: 'Corps complet du texte d\'investigation' },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Mots-clés et thématiques' },
                            imageKeyword: { type: Type.STRING, description: 'Mot-clé en anglais pour l\'illustration d\'arrière-plan' }
                        },
                        required: ['headline', 'body', 'tags']
                    }
                }
            });

            const resultText = response.text;
            if (!resultText) throw new Error("Réponse vide générée par Gemini Pro");

            const draftResult = JSON.parse(resultText);

            await prisma.newsTopic.update({
                where: { id: topic.id },
                data: {
                    status: 'DRAFTED',
                    final_draft: JSON.stringify({
                        headline: draftResult.headline,
                        body: draftResult.body,
                    }),
                    tags: JSON.stringify(draftResult.tags || []),
                    image_url: draftResult.imageKeyword || topic.image_url || 'investigation'
                }
            });

            console.log(`[Node 4] ✅ Article rédigé avec succès : ${draftResult.headline}`);

        } catch (error: any) {
            console.error(`[Node 4] ❌ Erreur rédaction pour le topic ${topic.id}:`, error.message);
        }
    }));

    await Promise.all(tasks);
    console.log(`[Node 4: Editorialist] Rédaction terminée pour l'ensemble des sujets.`);
}