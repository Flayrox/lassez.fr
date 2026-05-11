import { GoogleGenerativeAI } from '@google/generative-ai';
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const requestedModel = await getEffectiveParam('validator', 'aiModelValidator', 'gemini-2.0-flash');

    const model = genAI.getGenerativeModel({
        model: requestedModel,
        generationConfig: { responseMimeType: "application/json" }
    });

    for (const topic of topics) {
        try {
            const draft = JSON.parse(topic.final_draft || '{}');
            const systemPrompt = `Tu es le Secrétaire de Rédaction de "L'Assez". Ton rôle est de VALIDER ou CORRIGER les drafts produits par l'IA éditoriale.
CRITÈRES : 
1. Le ton doit être froid, clinique et incisif (pas de pathos).
2. Pas de mots interdits (Oligarchie, Bourgeoisie, etc.).
3. Précision factuelle absolue.

Réponds en JSON :
{
  "isValid": true | false,
  "corrections": "le texte corrigé si nécessaire",
  "reason": "pourquoi tu valides ou non"
}`;

            const prompt = `${systemPrompt}\n\nVoici le draft :\n${draft.body}`;
            const result = await model.generateContent(prompt);
            const evaluation = JSON.parse(result.response.text());

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
        }
    }
}
