import { GoogleGenAI, Type } from '@google/genai';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

/**
 * Nœud 5 : Validator (Secrétariat de Rédaction & Conformité)
 * 
 * Exécute une relecture de sécurité et de conformité factuelle sur chaque brouillon rédigé.
 * Bascule les articles validés vers le statut VALIDATED (prêt pour enrichissement média).
 */
export async function runValidatorNode() {
    console.log(`\n[Node 5: Validator] ⚖️ Lancement de la validation éditoriale...`);

    const topics = await prisma.newsTopic.findMany({
        where: { status: 'DRAFTED' }
    });

    if (topics.length === 0) {
        console.log(`[Node 5] ℹ️ Aucun sujet (statut: DRAFTED) à valider.`);
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn(`[Node 5] ⚠️ Variable d'environnement GEMINI_API_KEY absente. Étape ignorée.`);
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const requestedModel = await getEffectiveParam('validator', 'aiModelValidator', 'gemini-3-flash-preview');
    const concurrencyLimit = await getEffectiveParam('validator', 'maxConcurrentTasks', 5);

    const limit = pLimit(Number(concurrencyLimit));

    await Promise.all(topics.map(topic => limit(async () => {
        try {
            const draft = JSON.parse(topic.final_draft || '{}');
            const systemPrompt = `Tu es le Secrétaire de Rédaction de "L'Assez". Ton rôle est de VALIDER ou CORRIGER les brouillons produits par l'IA.
CRITÈRES : 
1. Le ton doit être neutre, rigoureux, clinique et incisif.
2. Éviter tout vocabulaire sensationnaliste ou déplacé.
3. Précision factuelle et clarté synthétique absolues.`;

            const prompt = `Voici le brouillon à évaluer :\n${draft.body}`;
            
            const result = await ai.models.generateContent({
                model: requestedModel,
                contents: `${systemPrompt}\n\n${prompt}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            isValid: { type: Type.BOOLEAN, description: "True si validé, False sinon" },
                            corrections: { type: Type.STRING, description: "Le texte corrigé si nécessaire" },
                            reason: { type: Type.STRING, description: "Justification du verdict de validation" }
                        },
                        required: ["isValid", "reason"]
                    }
                }
            });

            const responseText = result.text;
            if (!responseText) throw new Error("Réponse vide de l'IA.");
            const evaluation = JSON.parse(responseText);

            if (evaluation.isValid) {
                console.log(`[Node 5] ✅ Validé : ${topic.id}`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { 
                        status: 'VALIDATED',
                        final_draft: evaluation.corrections ? JSON.stringify({ ...draft, body: evaluation.corrections }) : topic.final_draft
                    }
                });
            } else {
                console.log(`[Node 5] ❌ Rejeté (${evaluation.reason}) : ${topic.id}`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'REJECTED' }
                });
            }
        } catch (e: any) {
            console.error(`[Node 5] ❌ Erreur validation sur le topic ${topic.id}:`, e.message);
            try {
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'REJECTED_ERROR' }
                });
            } catch (updateErr) { }
        }
    })));
}
