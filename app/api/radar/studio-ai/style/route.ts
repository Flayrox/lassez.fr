import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

const SCHEMA = {
    "stat": { style: "background:#000;color:#fff;font-weight:700;padding:0 4px" },
    "critical_keyword": { style: "color:#DC2626;font-weight:700" },
    "action_verb": { style: "text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px" },
    "strong_quote": { style: "background:#DC2626;color:#fff;padding:0 4px" },
};

export async function POST(request: Request) {
    try {
        const { fields, bg = 'light', accent = '#DC2626' } = await request.json();
        if (!fields || Object.keys(fields).length === 0)
            return NextResponse.json({ error: 'Aucun champ texte fourni' }, { status: 400 });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `Tu es le Directeur Artistique de "L'Assez", un média militant brutaliste.
Ta mission: enrichir les champs texte suivants avec un balisage HTML inline minimal pour mettre en avant les informations les plus fortes.

SCHÉMA DE STYLES AUTORISÉS (ne sort JAMAIS de ce schéma):
- Statistique/chiffre clé → <span style="background:#000;color:#fff;font-weight:700;padding:0 4px">60%</span>
- Mot-clé critique (nom propre, institution, lieu) → <span style="color:${accent};font-weight:700">Gaza</span>
- Verbe d'action fort → <span style="text-decoration:underline;text-decoration-color:${accent};text-decoration-thickness:3px">exiger</span>
- Citation percutante courte → <span style="background:${accent};color:#fff;padding:0 4px">"Ils ont menti"</span>

RÈGLES ABSOLUES:
- Maximum 15% du texte total peut avoir un style (sois sélectif!)
- Fond ${bg === 'dark' ? 'SOMBRE' : 'CLAIR'}: évite texte trop clair sur fond clair
- Ne modifie JAMAIS la structure des phrases ni le sens
- Retourne UNIQUEMENT le JSON sans markdown

CHAMPS À STYLER:
${JSON.stringify(fields, null, 2)}

Retourne un JSON avec exactement les mêmes clés que l'input, mais avec les spans ajoutés:
{ "styledFields": { "headline": "...", "body": "...", ... } }`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.3 }
        });

        const raw = (response.text || '{}').replace(/```json|```/g, '').trim();
        const data = JSON.parse(raw);

        return NextResponse.json({ styledFields: data.styledFields || {} });
    } catch (error: any) {
        console.error('Studio AI Style Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
