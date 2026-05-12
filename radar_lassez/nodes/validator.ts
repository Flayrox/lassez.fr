import { GoogleGenAI, Type } from '@google/genai';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

export async function runValidatorNode() {
    console.log(`\n[Node 5: Validator] ⚖️ Lancement de la validation éditoriale...`);

    const topics = await prisma.newsTopic.findMany({
        where: { status: 'DRAFTED' }
    });

    if (topics.length === 0) {
        console.log(`[Node 5] 🤷‍♂️ Aucun Topic (statut: DRAFTED) à valider.`);
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    const ai = new GoogleGenAI({ apiKey });
    const requestedModel = await getEffectiveParam('validator', 'aiModelValidator', 'gemini-3-flash-preview');
    const concurrencyLimit = await getEffectiveParam('validator', 'maxConcurrentTasks', 5);

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            isValid: { type: Type.BOOLEAN, description: "True si validé, False sinon" },
            corrections: { type: Type.STRING, description: "Le texte corrigé si nécessaire", nullable: true },
            reason: { type: Type.STRING, description: "Pourquoi tu valides ou non" }
        },
        required: ["isValid", "reason"]
    };

    const limit = pLimit(Number(concurrencyLimit));

    await Promise.all(topics.map(topic => limit(async () => {
        try {
            const draft = JSON.parse(topic.final_draft || '{}');
            const systemPrompt = `Tu es le Secrétaire de Rédaction de "L'Assez". Ton rôle est de VALIDER ou CORRIGER les drafts produits par l'IA éditoriale.
CRITÈRES : 
1. Le ton doit être froid, clinique et incisif (pas de pathos).
2. Pas de mots interdits (Oligarchie, Bourgeoisie, etc.).
3. Précision factuelle absolue.`;

            const prompt = `Voici le draft :\n${draft.body}`;
            
            const result = await ai.models.generateContent({
                model: requestedModel,
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: "application/json",
                    responseJsonSchema: responseSchema
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
                console.log(`[Node 5] ❌ Rejeté : ${evaluation.reason}`);
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'REJECTED' }
                });
            }
        } catch (e) {
            console.error(`[Node 5] Erreur sur ${topic.id}`, e);
            try {
                await prisma.newsTopic.update({
                    where: { id: topic.id },
                    data: { status: 'REJECTED_ERROR' }
                });
            } catch (updateErr) {
                console.error(`[Node 5] Impossible de set REJECTED_ERROR sur ${topic.id}`, updateErr);
            }
        }
    })));
}
