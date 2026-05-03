import { NextResponse } from 'next/server';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const responseSchema = {
  type: "object",
  properties: {
    recommended_template: { type: "string" },
    stylized_html: { type: "string" }
  },
  required: ["recommended_template", "stylized_html"]
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text } = body;

        if (!text) {
            return NextResponse.json({ success: false, error: 'Texte requis' }, { status: 400 });
        }

        const client = new GoogleGenAI({ 
            apiKey: process.env.GEMINI_API_KEY || '',
            httpOptions: { timeout: 120000 }
        });
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
   - N'hésite pas à ajouter d'autres <span style="color: red; font-weight: bold;"> ou même des couleurs spécifiques pays si le contexte s'y prête parfaitement.
   - Rends un HTML pur (sans markdown) avec ces petites modifications à l'intérieur des phrases de l'article pour qu'il soit imprimé textuellement sur l'image.

Tu travailles pour un média engagé, le résultat doit être repostable, attrayant et percutant.`;

        console.log('[Studio AI Generic] Starting analysis...');
        const response = await client.models.generateContent({ 
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.4,
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.MEDIUM
                },
                responseMimeType: 'application/json',
                responseJsonSchema: responseSchema as any,
            }
        });

        const data = JSON.parse(response.text);
        console.log('[Studio AI Generic] Analysis complete.');

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
