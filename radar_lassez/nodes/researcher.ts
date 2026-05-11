import { GoogleGenerativeAI } from '@google/generative-ai';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

/**
 * Node 3: Researcher — Data-Driven Triage Engine
 * 
 * The taxonomy list and filtering criteria are loaded from the DB.
 * Adding a new taxonomy in the UI automatically makes the researcher aware of it.
 */
export async function runResearcherNode() {
    console.log(`\n[Node 3: Researcher] 🧠 Lancement du filtrage IA (Triage Rapide)...`);

    const topics = await prisma.newsTopic.findMany({
        where: { status: 'INGESTED' }
    });

    if (topics.length === 0) {
        console.log(`[Node 3] 🤷‍♂️ Aucun Topic (statut: INGESTED) à analyser.`);
        return;
    }

    console.log(`[Node 3] 🔍 ${topics.length} sujets en attente d'analyse IA.`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn(`[Node 3] ⚠️ Variable d'environnement GEMINI_API_KEY absente.`);
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Résolution en cascade : Node > Global > Default
    const requestedModel = await getEffectiveParam('research', 'aiModelFlash', 'gemini-3-flash-preview');
    const customPrompt = await getEffectiveParam('research', 'customPromptModifier', '');
    const concurrencyLimit = await getEffectiveParam('research', 'maxConcurrentTasks', 5);

    // ——————————————————————————————————
    // Load prompt blocks & taxonomies from DB
    // ——————————————————————————————————
    const settings: any = await prisma.globalSettings.findFirst();
    const researcherSystem = settings?.researcherSystemPrompt || FALLBACK_RESEARCHER_SYSTEM;
    const rejectCriteria = settings?.researcherRejectCriteria || FALLBACK_REJECT_CRITERIA;

    // Load active taxonomies to build the dynamic categorization section
    const taxonomyTemplates: any[] = await (prisma as any).taxonomyTemplate.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });

    const taxonomySection = taxonomyTemplates.length > 0
        ? `=== CATÉGORISATION (Taxonomie) ===\nTu dois assigner une taxonomie aux sujets que tu gardes :\n${taxonomyTemplates.map(t => `- ${t.name} : ${t.description}`).join('\n')}`
        : `=== CATÉGORISATION ===\n- ALERTE : Sujet grave.\n- INFO : Actualité marquante.\n- FLASH : Fait ponctuel.\n- CITATION : Phrase choc.`;

    const taxonomyNames = taxonomyTemplates.length > 0
        ? taxonomyTemplates.map(t => `"${t.name}"`).join(' | ')
        : '"ALERTE" | "INFO" | "FLASH" | "CITATION"';

    console.log(`[Node 3] 📋 Taxonomies actives: ${taxonomyTemplates.map(t => t.name).join(', ')}`);

    const model = genAI.getGenerativeModel({
        model: requestedModel,
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    // Build the system prompt dynamically
    const systemPrompt = `${researcherSystem}
${customPrompt ? `\nDIRECTIVE SPÉCIALE DU JOUR : ${customPrompt}` : ''}

${taxonomySection}

${rejectCriteria}

Réponds UNIQUEMENT par un JSON avec la structure exacte suivante :
{
  "results": [
    {
      "id": "uuid-du-topic",
      "pertinent": true,
      "taxonomy": ${taxonomyNames},
      "flag": "un drapeau optionnel comme CRITICAL_CROSSCHECK ou null",
      "reason": "une justification ultra-courte de pourquoi tu le gardes ou le jettes"
    }
  ]
}`;

    // Batches concurrency par blocs de 15 topics
    const CHUNK_SIZE = 15;
    const limit = pLimit(Number(concurrencyLimit));
    const chunks = [];
    for (let i = 0; i < topics.length; i += CHUNK_SIZE) {
        chunks.push(topics.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[Node 3] 🚀 Exécution de ${chunks.length} requêtes concurrentes (Max ${concurrencyLimit} à la fois)...`);

    let validCount = 0;
    let rejectedCount = 0;

    await Promise.all(chunks.map(chunk => limit(async () => {
        try {
            const articlesPayload = chunk.map(t => {
                const parsedData = JSON.parse(t.raw_data);
                return {
                    id: t.id,
                    title: parsedData.clusterTitle,
                    biases: parsedData.aggregatedBias,
                    excerpt: parsedData.articles[0]?.content?.substring(0, 300) + '...'
                };
            });

            const titleMap = new Map(articlesPayload.map(a => [a.id, a.title]));

            const prompt = `${systemPrompt}\n\nVoici les sujets à analyser :\n${JSON.stringify(articlesPayload, null, 2)}`;
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const data = JSON.parse(responseText);

            for (const evaluation of data.results) {
                const isApproved = evaluation.pertinent;
                const title = titleMap.get(evaluation.id) || "Titre inconnu";
                
                if (isApproved) {
                    console.log(`[Node 3] 🟢 ACCEPTÉ [${evaluation.taxonomy}] : "${title}" ${evaluation.flag ? `(Flag: ${evaluation.flag})` : ''} - Raison: ${evaluation.reason}`);
                    validCount++;
                } else {
                    console.log(`[Node 3] 🔴 REJETÉ : "${title}" - Raison: ${evaluation.reason}`);
                    rejectedCount++;
                }

                await prisma.newsTopic.update({
                    where: { id: evaluation.id },
                    data: {
                        status: isApproved ? 'RESEARCHED' : 'REJECTED',
                        taxonomy: evaluation.taxonomy || null,
                        tags: evaluation.flag ? JSON.stringify([evaluation.flag]) : "[]"
                    }
                });
            }

        } catch (error) {
            console.error(`[Node 3] ❌ Erreur API sur un chunk ou parsing JSON défaillant :`, error instanceof Error ? error.message : error);
        }
    })));

    console.log(`[Node 3: Researcher] ✅ Triage IA complété.`);
    console.log(`[Node 3] 🟢 Topics validés et passés en RESEARCHED : ${validCount}`);
    console.log(`[Node 3] 🔴 Topics écartés et passés en REJECTED : ${rejectedCount}`);
}

// ——————————————————————————————————
// Fallback Constants
// ——————————————————————————————————
const FALLBACK_RESEARCHER_SYSTEM = `Tu es le filtre éditorial de L'Assez, un média d'investigation anticapitaliste. Ton but est de filtrer l'actualité brute et de la catégoriser.
Garde les sujets systémiques : inégalités, luttes sociales, corruption, extrême-droite, mensonges médiatiques, impérialisme.
Jette les polémiques stériles, les faits divers, la communication gouvernementale classique.
RÈGLE DU BIAIS : Observe le source_bias. Si une source de 'Droite/Extrême-Droite' attaque un sujet ou une figure 'Décoloniale/Gauche', sois hyper critique.`;

const FALLBACK_REJECT_CRITERIA = `REJETTE CATÉGORIQUEMENT :
- Faits divers isolés (accidents, crimes passionnels, vols).
- Lifestyle, divertissement, sport, tech "gadget".
- Micro-polémiques de réseaux sociaux sans enjeu de pouvoir réel.`;