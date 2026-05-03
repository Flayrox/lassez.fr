import { NextResponse } from 'next/server';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const responseSchema = {
  type: "object",
  properties: {
    styledFields: {
      type: "object",
      additionalProperties: { type: "string" }
    }
  },
  required: ["styledFields"]
};

export async function POST(request: Request) {
    try {
        const { fields, bg = 'light', accent = '#DC2626' } = await request.json();
        if (!fields || Object.keys(fields).length === 0)
            return NextResponse.json({ error: 'Aucun champ texte fourni' }, { status: 400 });

        const prompt = `Tu es le Directeur Artistique de "L'Assez", un média militant brutaliste.
Ta mission: enrichir les champs texte suivants avec un balisage HTML inline minimal pour mettre en avant les informations les plus fortes. 
Ces textes sont destinés à une publication Instagram impactante.

SCHÉMA DE STYLES AUTORISÉS (ne sors JAMAIS de ce schéma):
- Statistique/chiffre clé → <span style="background:#000;color:#fff;font-weight:700;padding:0 4px">60%</span>
- Mot-clé critique (nom propre, institution, lieu) → <span style="color:${accent};font-weight:700">MOT</span>
- Verbe d'action fort → <span style="text-decoration:underline;text-decoration-color:${accent};text-decoration-thickness:3px">VERBE</span>
- Citation percutante courte → <span style="background:${accent};color:#fff;padding:0 4px">"CIT"</span>

RÈGLES ABSOLUES:
- Maximum 15% du texte total peut avoir un style (sois sélectif!).
- Ne modifie JAMAIS la structure des phrases ni le sens.
- Utilise la puissance de ton raisonnement pour identifier les termes les plus porteurs de sens et de rébellion.

CHAMPS À STYLER:
${JSON.stringify(fields, null, 2)}`;

        const client = new GoogleGenAI({ 
            apiKey: process.env.GEMINI_API_KEY || '',
            httpOptions: { timeout: 120000 }
        });
        console.log('[Studio AI Style] Starting styling...');
        const response = await client.models.generateContent({ 
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.3,
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.MEDIUM
                },
                responseMimeType: "application/json",
                responseJsonSchema: responseSchema as any,
            }
        });

        const data = JSON.parse(response.text);
        console.log('[Studio AI Style] Styling complete.');

        return NextResponse.json({ styledFields: data.styledFields || {} });
    } catch (error: any) {
        console.error('Studio AI Style Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
