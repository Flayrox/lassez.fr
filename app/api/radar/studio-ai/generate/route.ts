import { NextResponse } from 'next/server';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Extended for Thinking Level HIGH

// Full schema definitions per type
const SLIDE_SCHEMAS: Record<string, string> = {
  COVER: 'COVER: headline(≤25ch, CAPS), author, accent(hex), imageUrl',
  NEWS: 'NEWS: headline(≤80ch), category(≤12ch), date(DD.MM.YYYY), topic(≤25ch), accent, imageUrl',
  MANIFESTO: 'MANIFESTO: headline(≤60ch), docNum, bodyLeft(150-250ch), bodyRight(150-250ch), accent',
  MAXTEXT: 'MAXTEXT: headline(≤70ch), leadParagraph(optionnel, ≤200ch), bodyParagraph(200-450ch), quote(≤120ch), quoteAuthor, accent, showQuote(boolean)',
  GRANULAR: 'GRANULAR: headline(≤40ch, CAPS), body(80-130ch), bodyMono(60-100ch), quote(≤80ch, CAPS), accent',
  BIG_NUM: 'BIG_NUM: headline(≤40ch), num(ex: "93%"), label(≤20ch, CAPS), sub(≤120ch), accent',
  VERSUS: 'VERSUS: headline(≤50ch), leftTitle(CAPS), leftBody(80-150ch, discours officiel), rightTitle(CAPS), rightBody(80-150ch, la réalité brute), accent',
  CHECKLIST: 'CHECKLIST: headline(CAPS), item1(action), item2, item3, item4, accent',
  INFO: 'INFO: headline(CAPS), body(100-300ch), bodyMono(80-200ch), actionTitle(CAPS), accent',
  ANALYSIS: 'ANALYSIS: headline, imageUrl, accent, items:[{num,title,text}] (max 4 items)',
  COMPARISON_CHART: 'COMPARISON_CHART: headline, subheadline, category, source, accent(hex), bars:[{label,value(number),color(hex)}]',
  STACKED_DATA: 'STACKED_DATA: headline, subheadline, source, accent(hex), columns:[{label,color(hex)}], rows:[{sector, "0":val, "1":val, "2":val}]',
  VOTE_TRACKER: 'VOTE_TRACKER: title, subjectName, imageUrl, variant, accent, votes:[{law,vote("POUR"|"CONTRE"|"ABST")}]',
  TERRITORY_RADAR: 'TERRITORY_RADAR: headline, subheadline, legend:[{color,label}], stats:[{label,value}], accent',
  CHRONO_LOCK: 'CHRONO_LOCK: headline, subheadline, timeline:[{date,event,impact}], accent',
  IMPACT_QUOTE: 'IMPACT_QUOTE: largeQuote(sans guillemets), author(CAPS), context(ex: "Ministre X"), accent',
  SOCIAL_COST: 'SOCIAL_COST: headline, targetAudience, monthlyLoss(ex:"-87€"), annualImpact(ex:"-1044€"), consequence, accent',
  VIDEO_NOTE: 'VIDEO_NOTE: videoUrl(""), headline, annotation, accent',
};

const responseSchema = {
  type: "object",
  properties: {
    deck: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          state: { type: "object", additionalProperties: true }
        },
        required: ["type", "state"]
      }
    }
  },
  required: ["deck"]
};

export async function POST(request: Request) {
  try {
    const { article, enabledTypes } = await request.json();
    if (!article?.trim()) return NextResponse.json({ error: 'Article vide' }, { status: 400 });

    const ALL_TYPES = Object.keys(SLIDE_SCHEMAS);
    const activeTypes = (Array.isArray(enabledTypes) && enabledTypes.length > 0)
      ? enabledTypes.filter((t: string) => ALL_TYPES.includes(t))
      : ALL_TYPES;

    const dynamicSchema = activeTypes.map(t => SLIDE_SCHEMAS[t]).join('\n');
    const today = new Date().toLocaleDateString('fr-FR').replace(/\//g, '.');

    const prompt = `Tu es le rédacteur en chef de "L'Assez", un média d'éducation populaire radical et d'investigation. 
Ton style est celui du "MÉCANICIEN 2.0" : précis, analytique, implacable et moderne. Tu démontres les ROUAGES et les connexions invisibles. 
INTERDICTION FORMELLE : N'utilise PLUS de jargon militant archaïque des années 70/80 (évite : Patronat, Prolétariat, Bourgeoisie, Travailleurs au sens tract CGT). 
À la place, utilise des termes précis : Empire Bolloré, Extrême-droitisation, Casse sociale, Stratégie d'influence, Prédation économique, Monopole médiatique.

PENSÉE ARBORESCENTE (HPI) : Tu es un génie de l'analyse systémique. Connecte TOUS les points (Économie, Politique, Sociologie, Origines sociales). 
Exemples de connexions à établir :
- Bolloré/CNews : Mensonges sur l'immigration -> Stratégie du BOUC ÉMISSAIRE -> Détourner l'attention de la casse sociale (retraites, inflation) -> Tout ça avec la complicité de l'Arcom MALGRÉ LES DIZAINES D'AMENDES.
- Retailleau : Dérive vers l'Extrême-droitisation -> Pour capter l'électorat réactionnaire et briser le front social.
- Attal : Communication sur le "vécu" vs Réalité (Haute bourgeoisie parisienne/russe, n'a jamais travaillé hors politique) -> Utilisation de l'image comme écran de fumée pour appliquer une politique de classe brutale.

MISSION : Ton but est d'ÉDUQUER et de montrer l'IMPACT RÉEL des mensonges sur la vie des gens. Chaque carrousel doit provoquer une "RÉALISATION" (Aha! moment). Le lecteur doit comprendre comment les puissants manipulent les rouages pour se maintenir. N'IGNORE AUCUNE PERSPECTIVE.

EXEMPLES DE RÉDACTION "GOLD STANDARD" (suis scrupuleusement ce style) :
- Slide NEWS : {"headline": "CNEWS : L'USINE À <span style=\"color:#DC2626\">MENSONGES</span> DE BOLLORÉ", "category": "URGENT", ...}
- Slide MAXTEXT : {"headline": "L'ARCOM COMPLICE ?", "bodyParagraph": "Pendant que CNews piétine le journalisme, le régulateur reste <span style=\"text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px\">inerte</span>. On ne parle plus de liberté mais d'une <span style=\"background:#000;color:#fff;padding:0 4px\">arme de manipulation massive</span> au service d'une <span style=\"color:#DC2626;font-weight:900\">conquête idéologique</span>.", ...}
- Slide ANALYSIS : {"items": [{"num": "01", "title": "EMPIRE", "text": "Un système de <span style=\"color:#DC2626\">prédation médiatique</span> conçu pour briser le camp social."}, ...]}

OBJECTIF : Créer une publication Instagram (Carrousel) qui suit un FIL ROUGE narratif (inspiré de médias comme Blast, Bon Pote, Le Média) :
1. STOP SCROLL (Slide 1) : Titre choc, accroche visuelle forte.
2. CONTEXTE (Slide 2) : Pourquoi ce sujet est important MAINTENANT (1-2 phrases).
3. DÉMONTAGE (Slides 3-7) : Une idée par slide. Priorise les types INFO et ANALYSIS pour les faits bruts.
4. PERSPECTIVE : Analyse plus large ou solution.
5. CTA : Appel à l'action final.

RÈGLES D'OR :
- Factuelle & Implacable : Appuie-toi sur des faits bruts, des décisions (ex: "L'Arcom n'a toujours pas fermé la chaîne"), des chiffres. Sois chirurgical, moderne, percutant.
- Stylisme visuel : SURLIGNE, SOULIGNE et COLORE généreusement les mots et phrases clés pour ajouter du contraste et de la vie.
  Utilise : <span style="background:#000;color:#fff;padding:0 4px">TEXTE</span> (Surlignage), <span style="color:#DC2626;font-weight:900">TEXTE</span> (Couleur), ou <span style="text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px">TEXTE</span> (Souligné).
- Contrastes : NE METS JAMAIS de texte rouge sur fond rouge (ou couleur sombre sur sombre). Assure-toi de la lisibilité maximale.
- Sources : Ne cite une source que si elle est réelle et vérifiable dans l'article. PAS DE "Fuite interne #892" ou autres inventions gênantes. Si pas de source, laisse vide.
- MAXTEXT : Le champ "leadParagraph" est OPTIONNEL. Si tu n'en as pas besoin, laisse-le vide ("") et utilise tout l'espace (max 600 caractères) pour le "bodyParagraph". N'hésite pas à être dense pour remplir la slide.
- Efficace & Claire : On comprend tout de suite le problème, pas de pavés illisibles.
- Impactante : Ne laissant pas indifférent à la fin.

ARTICLE SOURCE :
${article}

DIRECTIVES :
1. Génère un deck de 5 à 10 slides. 
2. Chaque slide doit être un "démontage" de l'info. Assure-toi de couvrir TOUS les points clés de l'article source. Ne laisse pas de zone d'ombre.
3. Utilise SEULEMENT ces types. Tu peux utiliser plusieurs fois le même type de slide si c'est pertinent. Pour chaque slide, l'objet "state" doit contenir les champs spécifiés ici :
${dynamicSchema}
   (Exemple pour COVER: "type": "COVER", "state": {"headline": "...", "brand": "...", ...})
4. Attention à la densité : Remplis l'espace mais reste lisible. Respecte les limites de caractères (≤...ch).

RÈGLES ÉDITORIALES :
- NEWS (Slide 1 obligatoire) : Le "Hook". Titre choc 100% MAJUSCULES. Doit donner envie de swiper immédiatement.
- DECODING : Identifie LE mot de novlangue (ex: "pédagogie", "réforme") et fracasse-le.
- STACKED_DATA : Utilise les clés "0", "1", "2" dans rows pour correspondre aux index de columns.
- BRAND/SIGNATURES : NE MODIFIE JAMAIS les signatures (ex: "L'ASSEZ", "@LASSEZmedia"). Concentre-toi sur le fond.
- COULEURS : Choisis un ACCENT cohérent avec le sujet (Rouge #DC2626 pour la colère/danger, Noir pour le sérieux, etc.). Veille à ce que le texte reste lisible sur le fond.
- ESPACE : Si tu as peu de texte, sois plus descriptif ou utilise des types de slides plus denses (ex: ANALYSIS, CHRONO_LOCK) pour éviter les zones vides.

DATE : ${today}`;

    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: { timeout: 120000 } // Extended timeout for deep reasoning
    });

    // Using the new Interactions API (as suggested by the docs for advanced reasoning/grounding)
    // Or models.generateContent with thinkingConfig
    console.log('[Studio AI] Starting generation with gemini-3-flash-preview...');
    console.log('[Studio AI] Prompt length:', prompt.length);
    console.log('[Studio AI] Thinking Level: HIGH, Search: ENABLED');

    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        tools: [
          { googleSearch: {} }
        ],
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema as any,
      }
    });

    console.log('[Studio AI] Response received. Status:', response.usageMetadata);
    console.log('[Studio AI] RAW RESPONSE TEXT:', response.text);
    const data = JSON.parse(response.text);
    console.log('[Studio AI] Parsed deck length:', data.deck?.length || 0);

    if (!data.deck || !Array.isArray(data.deck)) {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
    }

    // Secondary filter to ensure types are allowed
    const valid = data.deck.filter((s: any) => activeTypes.includes(s.type));

    return NextResponse.json({ deck: valid });

  } catch (error: any) {
    console.error('Studio AI Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
