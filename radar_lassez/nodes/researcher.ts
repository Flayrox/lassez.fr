import { GoogleGenerativeAI } from '@google/generative-ai';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

export async function runResearcherNode() {
    console.log(`\n[Node 3: Researcher] 🧠 Lancement du filtrage IA (Triage Rapide)...`);

    // 1. Récupération des articles à traiter
    const topics = await prisma.newsTopic.findMany({
        where: { status: 'INGESTED' }
    });

    if (topics.length === 0) {
        console.log(`[Node 3] 🤷‍♂️ Aucun Topic (statut: INGESTED) à analyser.`);
        return;
    }

    console.log(`[Node 3] 🔍 ${topics.length} sujets en attente d'analyse IA.`);

    // 2. Récupération de la configuration IA (Graph-Driven)
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

    const model = genAI.getGenerativeModel({
        model: requestedModel,
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    // Constuire le Prompt Système global de L'Assez
    const systemPrompt = `Tu es le filtre éditorial de L'Assez, un média d'investigation anticapitaliste. Ton but est de filtrer l'actualité brute et de la catégoriser.
Garde les sujets systémiques : inégalités, luttes sociales, corruption, extrême-droite, mensonges médiatiques, impérialisme.
Jette les polémiques stériles, les faits divers, la communication gouvernementale classique.
RÈGLE DU BIAIS : Observe le source_bias. Si une source de 'Droite/Extrême-Droite' attaque un sujet ou une figure 'Décoloniale/Gauche', sois hyper critique : rejette si c'est de la désinformation pure, ou ajoute un flag 'CRITICAL_CROSSCHECK'.
${customPrompt ? `\nDIRECTIVE SPÉCIALE DU JOUR : ${customPrompt}` : ''}

=== CATÉGORISATION (Taxonomie) ===
Tu dois assigner une taxonomie aux sujets que tu gardes :
- ALERTE : Sujet grave, systémique, nécessitant une analyse et un démontage en règle (Loi, scandale, enquête).
- INFO : Actualité classique mais marquante à développer.
- FLASH : Information très courte, factuelle, un événement ponctuel ou une action choc (ex: une plainte déposée, une audience qui chute, un portrait décroché).
- CITATION : Une phrase choc, polémique ou révélatrice prononcée par une figure publique/politique.

Réponds UNIQUEMENT par un JSON avec la structure exacte suivante :
{
  "results": [
    {
      "id": "uuid-du-topic",
      "pertinent": true,
      "taxonomy": "ALERTE" | "INFO" | "FLASH" | "CITATION",
      "flag": "un drapeau optionnel comme CRITICAL_CROSSCHECK ou null",
      "reason": "une justification ultra-courte de pourquoi tu le gardes ou le jettes"
    }
  ]
}`;

    // 3. Batches concurrency par blocs de 15 topics
    const CHUNK_SIZE = 15;
    const limit = pLimit(Number(concurrencyLimit));
    const chunks = [];
    for (let i = 0; i < topics.length; i += CHUNK_SIZE) {
        chunks.push(topics.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[Node 3] 🚀 Exécution de ${chunks.length} requêtes concurrentes (Max ${settings.maxConcurrentTasks} à la fois)...`);

    let validCount = 0;
    let rejectedCount = 0;

    // 4. Lancement concurrent des requêtes IA
    await Promise.all(chunks.map(chunk => limit(async () => {
        try {
            // Assembler le payload pour l'IA
            const articlesPayload = chunk.map(t => {
                const parsedData = JSON.parse(t.raw_data);
                return {
                    id: t.id,
                    title: parsedData.clusterTitle,
                    biases: parsedData.aggregatedBias,
                    // On ne passe qu'un résumé pour pas exploser le token limit
                    excerpt: parsedData.articles[0]?.content?.substring(0, 300) + '...'
                };
            });

            // Map pour la verbosité des logs
            const titleMap = new Map(articlesPayload.map(a => [a.id, a.title]));

            const prompt = `${systemPrompt}\n\nVoici les sujets à analyser :\n${JSON.stringify(articlesPayload, null, 2)}`;
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const data = JSON.parse(responseText);

            // Mise à jour de la DB pour chaque réponse reçue de ce sous-groupe
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
    console.log(`[Node 3] 🔴 Topics écartés (faits divers/com) et passés en REJECTED : ${rejectedCount}`);
}