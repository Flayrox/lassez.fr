import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text } = body;

        if (!text) {
            return NextResponse.json({ success: false, error: 'Texte requis' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const prompt = `
Tu es le Directeur Artistique Numérique de "L'Assez", un média brutaliste, satirique et incisif.
Ton rôle est d'analyser cet extrait de texte d'actualité pour concevoir la meilleure Slide Instagram possible.

TEXTE A ANALYSER :
"""
${text}
"""

TÂCHES :
1. Choisir le template le plus adapté entre "DAILY_NEWS" (pour les news brèves, impactantes, factuelles) et "MAX_TEXT" (pour les textes longs, les manifestes, analyses, éditos complexes).
2. Styliser le texte dynamiquement :
   - Repère les mots-clés, concepts forts ou pays (ex: "Palestine", "Climat", "Guerre", "Censure").
   - Entoure ces mots-clés de balises <span class="highlight-red">mot</span> pour faire un soulignage rouge brutaliste.
   - N'hésite pas à ajouter d'autres <span style="color: red; font-weight: bold;"> ou même des couleurs spécifiques pays (ex: vert/rouge/noir/blanc pour "Palestinien") si le contexte s'y prête parfaitement.
   - Rends un HTML pur (sans markdown) avec ces petites modifications à l'intérieur des phrases de l'article pour qu'il soit imprimé textuellement sur l'image.

Tu DOIS retourner ta réponse au strict format JSON suivant, SANS AUCUN markdown ni fioriture autour :

{
    "recommended_template": "DAILY_NEWS",
    "stylized_html": "Ceci est un texte sur le <span class=\\"highlight-red\\">Climat</span> qui est super important."
}
`;

        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.4,
                responseMimeType: 'application/json'
            }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text() || "{}";
        const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJsonStr);

        return NextResponse.json({
            success: true,
            recommended_template: data.recommended_template || 'DAILY_NEWS',
            stylized_html: data.stylized_html || text
        });

    } catch (error: any) {
        console.error("Erreur Studio AI:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
