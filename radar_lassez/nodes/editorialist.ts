import { GoogleGenerativeAI } from '@google/generative-ai';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

/**
 * Node 4: Editorialist — Data-Driven Prompt Assembly Engine
 * 
 * This node no longer contains ANY editorial logic.
 * It reads prompt blocks from GlobalSettings and taxonomy templates from the DB,
 * then assembles the system prompt dynamically for each article based on its taxonomy.
 */
export async function runEditorialistNode() {
    console.log(`\n[Node 4: Editorialist] ✍️ Lancement de la rédaction IA (Data-Driven Engine)...`);

    const topics = await prisma.newsTopic.findMany({
        where: { status: 'RESEARCHED' }
    });

    if (topics.length === 0) {
        console.log(`[Node 4] 🤷‍♂️ Aucun Topic (statut: RESEARCHED) à rédiger.`);
        return;
    }

    console.log(`[Node 4] 📝 ${topics.length} sujets en attente de rédaction experte.`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn(`[Node 4] ⚠️ Variable d'environnement GEMINI_API_KEY absente.`);
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Résolution en cascade : Node > Global > Default
    const requestedModel = await getEffectiveParam('editor', 'aiModelPro', 'gemini-3.1-pro-preview');
    const concurrencyLimit = await getEffectiveParam('editor', 'maxConcurrentTasks', 5);

    // ——————————————————————————————————
    // Load ALL prompt blocks from the DB
    // ——————————————————————————————————
    const settings: any = await prisma.globalSettings.findFirst();
    const baseIdentity = settings?.baseIdentityPrompt || FALLBACK_BASE_IDENTITY;
    const researchMission = settings?.researchMissionPrompt || FALLBACK_RESEARCH_MISSION;
    const vocabularyRules = settings?.vocabularyRulesPrompt || FALLBACK_VOCABULARY_RULES;
    const imageRules = settings?.imageRulesPrompt || FALLBACK_IMAGE_RULES;

    // Load ALL active taxonomy templates from the DB
    const taxonomyTemplates: any[] = await (prisma as any).taxonomyTemplate.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
    });

    // Index by name for O(1) lookup
    const taxonomyMap = new Map(taxonomyTemplates.map(t => [t.name, t]));
    console.log(`[Node 4] 📋 ${taxonomyTemplates.length} taxonomy templates loaded: ${taxonomyTemplates.map(t => t.name).join(', ')}`);

    // ——————————————————————————————————
    // Dynamic Prompt Assembly Function
    // ——————————————————————————————————
    const assembleSystemPrompt = (taxonomyName: string): string => {
        const template = taxonomyMap.get(taxonomyName) || taxonomyMap.get('ALERTE');
        
        if (!template) {
            console.warn(`[Node 4] ⚠️ No taxonomy template found for "${taxonomyName}", using raw fallback.`);
            return `${baseIdentity}\n${researchMission}\n${vocabularyRules}\n${imageRules}\n\nRédige un post percutant au format JSON.`;
        }

        // Parse examples
        let examplesBlock = '';
        try {
            const examples = JSON.parse(template.examplesJson);
            if (Array.isArray(examples) && examples.length > 0) {
                examplesBlock = `\n\n== EXEMPLES D'INSPIRATION ==\n${examples.map((ex: string, i: number) => `Exemple ${i + 1} :\n${ex}`).join('\n\n')}`;
            }
        } catch (e) {}

        // Parse output schema
        let outputBlock = '';
        try {
            const schema = JSON.parse(template.outputSchemaJson);
            outputBlock = `\n\n=== FORMAT DE SORTIE JSON STRICT OBLIGATOIRE ===\n${JSON.stringify(schema, null, 2)}`;
        } catch (e) {}

        return `${baseIdentity}\n${researchMission}\n${vocabularyRules}\n${imageRules}\n\n${template.formatInstructions}${examplesBlock}${outputBlock}`;
    };

    const editorialModel = requestedModel;
    const limit = pLimit(Number(concurrencyLimit));
    let draftedCount = 0;

    await Promise.all(topics.map(topic => limit(async () => {
        try {
            // Assemble the prompt DYNAMICALLY from DB data
            const systemPromptForTopic = assembleSystemPrompt(topic.taxonomy || 'ALERTE');
            
            const model = genAI.getGenerativeModel({
                model: editorialModel,
                systemInstruction: systemPromptForTopic,
                // @ts-ignore : Feature recente
                tools: [{ googleSearch: {} }],
                generationConfig: {
                    responseMimeType: "application/json",
                    // @ts-ignore : Feature recente
                    thinkingConfig: { thinkingLevel: "high" }
                }
            });

            const parsedData = JSON.parse(topic.raw_data);
            const context = parsedData.articles.map((a: any) => `Source: ${a.source_name}\nBiais: ${a.source_bias}\nTitre: ${a.title}\nContenu: ${a.content}`).join('\n\n');
            const prompt = `Voici le contexte consolidé à traiter pour le format ${topic.taxonomy || 'ALERTE'} :\n${context}`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            let draft;
            try {
                draft = JSON.parse(responseText);
            } catch (parseError) {
                console.error(`[Node 4] ❌ Erreur de parsing JSON pour le sujet ${topic.id}`, responseText);
                return;
            }

            // Fusionner les anciens tags avec les nouveaux
            const existingTags = JSON.parse(topic.tags || '[]');
            const newTags = draft.tags || [];
            const mergedTags = [...new Set([...existingTags, ...newTags])];

            await prisma.newsTopic.update({
                where: { id: topic.id },
                data: {
                    status: 'DRAFTED',
                    final_draft: JSON.stringify(draft),
                    taxonomy: draft.taxonomie,
                    geo: draft.geo,
                    tags: JSON.stringify(mergedTags)
                }
            });

            console.log(`[Node 4] 📰 RÉDIGÉ [${draft.taxonomie}] : "${draft.headline}"`);
            draftedCount++;
        } catch (error) {
            console.error(`[Node 4] ❌ Erreur API sur le sujet ${topic.id} :`, error instanceof Error ? error.message : error);
        }
    })));

    console.log(`[Node 4: Editorialist] ✅ Rédaction experte complétée. ${draftedCount} topics passés en DRAFTED.`);
}

// ——————————————————————————————————
// Fallback Constants (used ONLY if GlobalSettings fields are null)
// These are frozen snapshots of the original L'Assez DNA.
// ——————————————————————————————————
const FALLBACK_BASE_IDENTITY = `Tu es le Rédacteur en Chef de "L'Assez", un média d'investigation radical sur les réseaux sociaux. Ta mission est de rédiger un post percutant (style Twitter/Telegram) à partir des sources fournies.
TON : Urgent, scandalisé, implacable, intelligent et direct ("Le Mécanicien"). Tu refuses le jargon militant poussiéreux.`;

const FALLBACK_RESEARCH_MISSION = `=== MISSION DE RECHERCHE ET SYNTHÈSE ===
1. Utilise le CONTENU FOURNI dans le contexte comme base de ton analyse.
2. Utilise ton outil GOOGLE SEARCH pour :
   - Vérifier les faits.
   - Extraire le "passif" ou les casseroles des protagonistes mentionnés.
   - Trouver des éléments de contexte plus larges pour armer ton attaque implacable.`;

const FALLBACK_VOCABULARY_RULES = `=== LA RÈGLE DE VOCABULAIRE (ALERTE ROUGE - SANCTION) ===
- MOTS INTERDITS : Oligarchie, Bourgeoisie, Bloc bourgeois, Prolétaire, Superstructure, Dystopie, Grand capital, Peste brune, Camisole libérale.
- MOTS AUTORISÉS : Le gouvernement, les milliardaires, le patronat, la Macronie, la droite, l'extrême droite, les travailleurs, l'État, les actionnaires.`;

const FALLBACK_IMAGE_RULES = `=== RÈGLE DES IMAGES (LA MÉTHODE DES TIRS) ===
- Tir 1 (Le Sniper) : 1 requête ultra précise.
- Tir 2 (Le Pistolet) : 2 requêtes plus larges.
- Tir 3 (Le Fusil à pompe) : 3 requêtes symboliques.`;