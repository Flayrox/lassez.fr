import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Full schema definitions per type — only the enabled ones are injected in the prompt
const SLIDE_SCHEMAS: Record<string, string> = {
  COVER:     'COVER: headline(≤25ch,MAJUSCULES), brand, issueNum, author, swipeLabel, accent(hex), imageUrl',
  NEWS:      'NEWS: headline(≤80ch), brand, category(≤12ch), date(DD.MM.YYYY), topic(≤25ch), accent, imageUrl',
  MANIFESTO: 'MANIFESTO: headline(≤60ch), docNum, bodyLeft(150-250ch), bodyRight(150-250ch), metaLeft, actionLabel, metaRight, brand, accent',
  MAXTEXT:   'MAXTEXT: headline(≤70ch), tag(≤15ch), date, source, leadParagraph(180-280ch), bodyParagraph(200-350ch), quote(≤120ch), quoteAuthor, brand, accent, showQuote(boolean), showDate(boolean), showSource(boolean)',
  GRANULAR:  'GRANULAR: headline(≤40ch,CAPS), tag, slideNum(≤3ch), footerHandle, body(80-130ch), bodyMono(60-100ch), quote(≤80ch,CAPS), brand, accent',
  BIG_NUM:   'BIG_NUM: headline(≤40ch), num(le chiffre ex: "93%"), label(≤20ch,CAPS,ex: "DES MÉNAGES"), sub(≤120ch,contexte du chiffre), brand, accent',
  VERSUS:    'VERSUS: headline(≤50ch), leftTitle(≤20ch,CAPS), leftBody(80-150ch,discours officiel), rightTitle(≤20ch,CAPS), rightBody(80-150ch,la réalité), brand, accent',
  CHECKLIST: 'CHECKLIST: headline(≤40ch,CAPS), item1(≤60ch,action), item2(≤60ch), item3(≤60ch), item4(≤60ch), check1(false), check2(false), check3(false), check4(false), brand, accent',
  INFO:      'INFO: headline(≤40ch,CAPS), tag, slideNum(≤3ch), footerHandle, body(80-130ch), bodyMono(60-100ch), actionTitle(≤30ch,CAPS), actionMeta(≤50ch), brand, accent',
  ANALYSIS:  'ANALYSIS: headline, refCode, slideNum, totalSlides, item1Num, item1Title, item1Text, item2Num, item2Title, item2Text, item3Num, item3Title, item3Text, imageUrl, brand, accent',
  OUTRO:     'OUTRO: headline, brandHandle, linkText, footerYear, number, accent',
  COMPARISON_CHART: 'COMPARISON_CHART: headline, subheadline, category, source, brand, accent(hex), bars:[{label,value(number),color(hex)}] (2-6 barres, la mise en évidence dominante en rouge)',
  STACKED_DATA: 'STACKED_DATA: headline, subheadline, source, brand, accent(hex), columns:[{label,color(hex)}], rows:[{sector,cells:[{value(number),label}]}] (2-5 colonnes, 2-6 lignes)',
  VOTE_TRACKER: 'VOTE_TRACKER: title, subtitle, subjectName, imageUrl(URL photo), variant(ex:"Fiche 1/3"), brand, accent(hex), colorPour(hex,défaut:#1A1C1C), colorContre(hex,défaut:#BC0100), colorAbst(hex,défaut:#888888), votes:[{law(texte de la loi),vote("POUR"|"CONTRE"|"ABST")}] (3-7 votes)',
  TERRITORY_RADAR: 'TERRITORY_RADAR: headline(≤30ch), subheadline, svgContent(""), legend:[{color(hex),label}] (2-5 zones), stats:[{label,value}] (2-4 stats), source, brand, accent(hex)',
  DECODING: 'DECODING: headline(≤40ch), jargonTerm(le mot barré), officialDef(version médias), realityCheck(la vérité sociale), brand, accent(hex)',
  CHRONO_LOCK: 'CHRONO_LOCK: headline, subheadline, timeline:[{date,event,impact}] (3-5 events), brand, accent(hex)',
  IMPACT_QUOTE: 'IMPACT_QUOTE: largeQuote(≤150ch,sans guillemets—AI les ajoute), author(NOM PRÉNOM en caps), context(≤50ch,ex:"Ministre X — date"), brand, accent(hex)',
  SOCIAL_COST: 'SOCIAL_COST: headline, targetAudience(ex:"ÉTUDIANTS BOURSIERS"), monthlyLoss(ex:"-87€"), annualImpact(ex:"-1 044€"), consequence(≤100ch), note(source courte), brand, accent(hex)',
  VIDEO_NOTE: 'VIDEO_NOTE: videoUrl(""), headline, annotation(≤120ch), brand, accent(hex)',
};

// Structural directives — shown only if the type is available
const SLIDE_ROLES: Record<string, string> = {
  COVER:     '- COVER (si disponible) : Utilisable comme première slide visuelle d\'accroche avec image.',
  NEWS:      '- NEWS : Obligatoire en Slide 1 si disponible. LE CROCHET (Hook). Titre choc, constat froid.',
  MANIFESTO: '- MANIFESTO : Idéal pour des comparaisons bi-colonne ou une thèse avec preuves.',
  MAXTEXT:   '- MAXTEXT : LE DÉMONTAGE. MINIMUM 2 slides si disponible. Analyse en profondeur du mécanisme.',
  GRANULAR:  '- GRANULAR : Slide de transition ou conclusion partielle. Corps court + Citation percutante.',
  BIG_NUM:   '- BIG_NUM : 1 chiffre qui tue. Seul sur sa page, accompagné d\'une phrase courte de contexte.',
  VERSUS:    '- VERSUS : Opposition radicale. Discours officiel VS Réalité. Idéal pour le démontage.',
  CHECKLIST: '- CHECKLIST : Slide d\'action. 4 choses que le lecteur peut faire CONCRÈTEMENT.',
  INFO:      '- INFO : Slide d\'alerte. Fait clé + bloc warning rouge pour frapper les esprits.',
  ANALYSIS:  '- ANALYSIS : 3 données chiffrées ou faits précis numérotés sur fond sombre.',
  OUTRO:     '- OUTRO : Obligatoire si disponible. CTA final + handle/lien. Toujours en dernière position.',
  COMPARISON_CHART: '- COMPARISON_CHART : Graphique en barres brutaliste. Idéal pour montrer une disproportion frappante entre partis/groupes. La barre dominante DOIT être dans accent rouge.',
  STACKED_DATA: '- STACKED_DATA : Matrice de données. Idéal pour montrer plusieurs types de discriminations ou d\'incidents sur plusieurs secteurs. Chaque cell contient un chiffre, la taille visuelle est proportionnelle.',
  VOTE_TRACKER: '- VOTE_TRACKER : Registre de votes lié à une personne (imageUrl) ou institution. Chaque vote a un verdict POUR/CONTRE/ABST. Particulièrement puissant pour démonter des élus ou décisions politiques.',
  TERRITORY_RADAR: '- TERRITORY_RADAR : Carte de rapport de force. Idéal pour les résultats électoraux ou cartographie d\'inégalités. Avec stats chiffrées à droite.',
  DECODING: '- DECODING : "Le Mécanicien" décortique un mot de novlangue. Le mot est barré en rouge. Officiel vs Réalité.',
  CHRONO_LOCK: '- CHRONO_LOCK : Ligne de temps verticale. Prouve qu\'un scandal ou une trahison politique s\'est construit sur la durée.',
  IMPACT_QUOTE: '- IMPACT_QUOTE : Citation massive occupant 80% de la slide. Minimalisme radical. Une phrase méprisante ou révélatrice, isolée.',
  SOCIAL_COST : '- SOCIAL_COST : La calculette de la précarité. Montre combien une loi coûte CONCRÈTEMENT à un groupe cible, en mois et en année.',
  VIDEO_NOTE: '- VIDEO_NOTE : Slide de document vidéo avec annotation éditoriale. videoUrl vide par défaut, l\'utilisateur ajoutera le lien.',
};

export async function POST(request: Request) {
  try {
    const { article, enabledTypes } = await request.json();
    if (!article?.trim())
      return NextResponse.json({ error: 'Article vide' }, { status: 400 });

    // Build dynamic schema from enabled types (fallback to all if not provided)
    const ALL_TYPES = ['COVER', 'NEWS', 'MANIFESTO', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'VERSUS', 'CHECKLIST', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'];
    const activeTypes: string[] = (Array.isArray(enabledTypes) && enabledTypes.length > 0)
      ? enabledTypes.filter((t: string) => ALL_TYPES.includes(t))
      : ALL_TYPES;

    if (activeTypes.length === 0)
      return NextResponse.json({ error: 'Aucun type de slide activé' }, { status: 400 });

    const dynamicSchema = activeTypes.map(t => SLIDE_SCHEMAS[t]).filter(Boolean).join('\n');
    const dynamicRoles = activeTypes.map(t => SLIDE_ROLES[t]).filter(Boolean).join('\n');

    const today = new Date().toLocaleDateString('fr-FR').replace(/\//g, '.');

    const prompt = `Tu es le rédacteur en chef de "L'Assez", un média d'éducation populaire et de décryptage politique.
Tu "démontres les rouages" du système. Ton style : froid, factuel, chirurgical, implacable. Télégraphique. Chaque mot compte.

ARTICLE SOURCE :
${article}

TYPES DISPONIBLES (utilise SEULEMENT ces types — respecte les clés JSON strictement) :
${dynamicSchema}

RÔLE DE CHAQUE TYPE :
${dynamicRoles}

RÈGLES STRICTES :
1. 5 à 8 slides minimum. Utilise intelligemment les types spécialisés si disponibles.
2. Phrases courtes (max 12-20 mots). Pas de jargon. Pas de "Cependant/Néanmoins".
3. HTML limité (max 20%) : chiffre → <span style="background:#000;color:#fff;font-weight:700;padding:0 4px">N%</span> | concept clé → <span style="color:#DC2626;font-weight:700">mot</span> | citation → <span style="background:#DC2626;color:#fff;padding:0 3px">«mot»</span>
4. BRAND toujours "L'ASSEZ", ACCENT toujours "#DC2626".

DIRECTIVES SPÉCIFIQUES pour les infographies :
- DECODING → identifie LE mot de novlangue utilisé dans l'article (ex: "réforme", "pédagogie", "modernisation"), et fracasse-le avec la réalité concrète.
- CHRONO_LOCK → extrait les dates RÉELLES de l'article pour construire la timeline. Si l'article n'en a pas, n'utilise pas ce type.
- IMPACT_QUOTE → utilise une citation VERBATIM d'un acteur politique/institutionnel mentionné dans l'article. Si pas de citation directe, n'utilise pas ce type.
- SOCIAL_COST → calcule un impact mensuel/annuel concret sur un groupe identifié dans l'article (ex: salarié, étudiant, retraité).
- TERRITORY_RADAR → utilise pour les articles électoraux/géographiques. svgContent doit toujours être "".
- VIDEO_NOTE → videoUrl doit toujours être "", l'utilisateur ajoutera le lien.
- COMPARISON_CHART → les bars.value doivent être des VRAIS chiffres (pas des estimations vagues). Utilise des % ou des €.
- VOTE_TRACKER → n'utilise que si l'article mentionne des votes parlementaires ou des positions politiques d'élus nommés.

DATE : ${today} | BRAND : L'ASSEZ | ACCENT : #DC2626

Réponds UNIQUEMENT avec un JSON valide :
{"deck":[{"type":"NEWS","state":{...}},{"type":"MAXTEXT","state":{...}}]}`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      tools: [{ googleSearchRetrieval: {} } as any],
      generationConfig: {
        temperature: 0.6,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in:', raw.slice(0, 400));
      return NextResponse.json({ error: 'Pas de JSON dans la réponse IA', raw: raw.slice(0, 400) }, { status: 500 });
    }

    let data: any;
    try { data = JSON.parse(jsonMatch[0]); }
    catch (e) {
      console.error('JSON parse failed:', jsonMatch[0].slice(0, 400));
      return NextResponse.json({ error: 'JSON invalide', raw: jsonMatch[0].slice(0, 400) }, { status: 500 });
    }

    if (!data.deck || !Array.isArray(data.deck) || data.deck.length === 0)
      return NextResponse.json({ error: 'Deck vide', raw: raw.slice(0, 400) }, { status: 500 });

    // Filter to only allowed types (safety check)
    const valid = data.deck.filter((s: any) =>
      activeTypes.includes(s.type) &&
      s.state && typeof s.state === 'object'
    );

    if (valid.length === 0)
      return NextResponse.json({ error: 'Types invalides retournés par IA', types: data.deck.map((s: any) => s.type) }, { status: 500 });

    return NextResponse.json({ deck: valid });

  } catch (error: any) {
    console.error('Studio AI Generate Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
