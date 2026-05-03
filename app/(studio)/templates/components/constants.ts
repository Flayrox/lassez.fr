'use client';

import { SlideType } from "./StudioContext";

export const DC = {
    headline: "LE SILENCE<br/>EST UNE<br/>ARME", brand: "L'ASSEZ", accent: "#DC2626", bg: "#fff",
    imageUrl: "https://picsum.photos/seed/lassez-default/1200/800",
    zoom: 1.2, posX: 0, posY: 0, grayscale: 100,
    issueNum: "042", readTime: "3 min", author: "L'Assez", swipeLabel: "Glisser",
};

export const DN = {
    headline: "L'accord sur le<br/><em style=\"color:#DC2626\">Climat</em> s'effondre", brand: "L'ASSEZ", accent: "#DC2626",
    imageUrl: DC.imageUrl, zoom: 1.2, posX: 0, posY: 0, grayscale: 100,
    category: "FLASH", date: "24.10.2023", topic: "Actualité",
};

export const DM = {
    headline: "L'Illusion<br/>du Choix", brand: "L'ASSEZ", accent: "#DC2626",
    docNum: "Dossier-02", titleSize: 40,
    bodyLeft: "On nous présente les options A et B — mais <strong>l'infrastructure</strong> qui les soutient reste inchangée. Ce n'est pas un accident ; c'est une caractéristique de conception du système.",
    bodyRight: "La promesse de réforme est <span style=\"text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:4px\">l'opium du peuple</span> à l'ère numérique. Nous scrollons, nous cliquons, nous nous pensons informés.",
    metaLeft: "ÉCHEC CRITIQUE", metaRight: "Ne détournez pas le regard.", actionLabel: "Action Requise",
};

export const DMX = {
    headline: "Révélations sur les failles systémiques de l'audit", brand: "L'ASSEZ", accent: "#DC2626",
    tag: "Enquête", date: "12.04.2023", source: "Fuite interne #892",
    leadParagraph: `Les audits récents ont révélé une tendance inquiétante. Plus de <span style="background:#000;color:#fff;padding:0 3px;font-weight:700">60%</span> des fonds de secours n'ont jamais atteint les populations concernées. Ces ressources ont été absorbées par des coûts administratifs opaques.`,
    bodyParagraph: "Il ne s'agit pas de simple inefficacité bureaucratique, mais d'un mechanism structurel conçu pour masquer les responsabilités au plus haut niveau de décision.",
    quote: '"On nous a promis des infrastructures. On nous a donné des communiqués."',
    quoteAuthor: "— Porte-parole, Quartier Sud-Est",
    showQuote: true, showDate: true, showSource: true,
};

export const DGS = {
    headline: "ÉCHEC<br/>SYSTÉMIQUE", brand: "L'ASSEZ", accent: "#DC2626",
    tag: "Flash Info", slideNum: "02",
    body: `Les nouvelles données révèlent que plus de <span style="background:#000;color:#fff;padding:0 3px;font-weight:700">60% des fonds</span> n'ont jamais atteint les populations.`,
    bodyMono: "Malgré les engagements publics, la traçabilité s'arrête net aux frais administratifs. Ce n'est pas une erreur, c'est le fonctionnement normal du système.",
    quote: '"Ils ont signé les papiers alors que tout brûlait encore. Personne ne comptait reconstruire."',
    footerHandle: "@LASSEZmedia",
    dark: false,
};

export const DIS = {
    headline: "DÉCORTIQUER<br/>LE SYSTÈME", brand: "L'ASSEZ", accent: "#DC2626",
    tag: "Flash Info", slideNum: "02",
    body: `L'audit confirme que plus de <span style="background:#000;color:#fff;padding:0 4px;text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px;font-weight:700">60% des promesses</span> sont restées lettre morte.`,
    bodyMono: "L'Show analyse montre que ce mécanisme d'opacité est délibérément intégré dans la loi pour protéger les profits au détriment du service public.",
    actionTitle: "Action Requise Immédiate",
    actionMeta: "Dossier #12.04 — Secteur 4",
    footerHandle: "@LASSEZmedia",
};

export const DAN = {
    headline: "L'Assez Analysis", brand: "L'ASSEZ", accent: "#DC2626",
    refCode: "Ref: 24-0B // V.02", slideNum: "02", totalSlides: "10",
    item1Num: "01", item1Title: "Redondance Systémique", item1Text: "L'architecture actuelle priorise des protocoles obsolètes.",
    item2Num: "02", item2Title: "Biais Algorithmique", item2Text: "Les flux d'information sont bridés par des gardiens opaques.",
    item3Num: "03", item3Title: "Extraction des Ressources", item3Text: "L'attention est la matière première principale.",
    imageUrl: DC.imageUrl, zoom: 1.0, posX: 0, posY: 0, grayscale: 100,
};

export const DOU = {
    headline: `<span class="block relative">S'A<span class="absolute -top-4 -right-4 text-4xl text-white dark:text-black font-grotesk animate-bounce">*</span></span><span class="block ml-12">BON</span><span class="block -ml-8">NER</span>`,
    brandHandle: "@L_ASSEZ_MEDIA", accent: "#DC2626",
    linkText: "Lien en bio", footerYear: "EST. 2024", number: "04",
};

export const DEFAULTS: Record<string, any> = {
    COVER: DC, NEWS: DN, MANIFESTO: DM, MAXTEXT: DMX, GRANULAR: DGS,
    BIG_NUM: { headline: "L'IMPACT EN CHIFFRES", num: "80%", label: "DES PROFITS", sub: "absorbés par les 1% les plus riches en 2023.", brand: "L'ASSEZ", accent: "#DC2626", dark: true },
    VERSUS: { headline: "DISCOURS VS RÉALITÉ", leftTitle: "CE QU'ILS DISENT", leftBody: "La sobriété est l'affaire de tous les citoyens.", rightTitle: "LA RÉALITÉ", rightBody: "Les vols en jets privés ont augmenté de 20% cette année.", brand: "L'ASSEZ", accent: "#DC2626" },
    CHECKLIST: { headline: "COMMENT AGIR ?", item1: "Désamorcer le récit officiel", item2: "Soutenir les médias indépendants", item3: "Rejoindre un collectif local", item4: "Partager l'information", check1: true, check2: false, check3: false, check4: false, brand: "L'ASSEZ", accent: "#DC2626" },
    INFO: DIS, ANALYSIS: DAN, OUTRO: DOU,
    COMPARISON_CHART: {
        headline: "INFRACTIONS & CANDIDATS", subheadline: "COMPARATIF BRUTAL : PARTIS & PROPOS SIGNALÉS",
        category: "L'ASSEZ INVESTIGATION",
        bars: [
            { label: "AUTRES PARTIS*", value: 0, color: "#888" },
            { label: "DIVERS DROITE", value: 1, color: "#555" },
            { label: "DIVERS GAUCHE", value: 4, color: "#333" },
            { label: "RASSEMBLEMENT NATIONAL", value: 139, color: "#BC0100" },
        ],
        source: "Source : Analyse brute L'Assez & Bon Pote (Villes Futures), Mediapart, Libé.",
        brand: "L'ASSEZ", accent: "#BC0100",
    },
    STACKED_DATA: {
        headline: "L'INFOGRAPHIE BRUTE DES DISCRIMINATIONS SYSTÉMIQUES",
        subheadline: "ANALYSE DES INCIDENTS SIGNALÉS ET DES RÉPONSES INSTITUTIONNELLES (2023-2024)",
        columns: [
            { label: "RACISME", color: "#BC0100" },
            { label: "ANTISÉMITISME", color: "#7A0000" },
            { label: "SEXISME / HOMOPHOBIE", color: "#1A1A1A" },
            { label: "VIOLENCES / HARCÈLEMENT", color: "#555" },
            { label: "DISCRIMINATION", color: "#999" },
        ],
        rows: [
            { sector: "SECTEUR PUBLIC", cells: [{ value: 512, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
            { sector: "ENTREPRISES PRIVÉES", cells: [{ value: 408, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
            { sector: "ÉDUCATION", cells: [{ value: 366, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 276, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 79, label: "DISCRIMINATION" }] },
            { sector: "LOGEMENT SOCIAL", cells: [{ value: 446, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
        ],
        source: "SOURCE: L'ASSEZ ENQUÊTES & DONNÉES BRUTES. TOUS DROITS RÉSERVÉS. ÉDITION 2024.",
        brand: "L'ASSEZ", accent: "#BC0100",
    },
    VOTE_TRACKER: {
        title: "VOTE TRACKER", subtitle: "L'ASSEZ MEDIA — REGISTRE DES VOTES",
        subjectName: "SUJET POLITIQUE",
        imageUrl: DC.imageUrl,
        votes: [
            { law: "Loi sur la transparence financière des élus (Amendement 45B)", vote: "CONTRE" },
            { law: "Réforme des retraites : recul de l'âge légal à 65 ans", vote: "CONTRE" },
            { law: "Augmentation des budgets de la défense nationale", vote: "CONTRE" },
            { law: "Protection renforcée des lanceurs d'alerte", vote: "CONTRE" },
            { law: "Réduction des aides sociales pour les plus précaires", vote: "POUR" },
        ],
        variant: "Fiche 1 / 3",
        brand: "L'ASSEZ", accent: "#BC0100",
        colorPour: "#1A1C1C", colorContre: "#BC0100", colorAbst: "#888888",
    },
    TERRITORY_RADAR: {
        headline: "CARTE DU RAPPORT DE FORCE",
        subheadline: "RÉSULTATS PREMIER TOUR — COMMUNES > 10 000 HABITANTS",
        svgContent: '',
        legend: [
            { color: "#BC0100", label: "GAUCHE / NFP" },
            { color: "#1A1C1C", label: "ABSTENTION" },
            { color: "#555", label: "DROITE / RN" },
            { color: "#888", label: "CENTRE" },
        ],
        stats: [
            { label: "Part. nationale", value: "61.4%" },
            { label: "Abstention", value: "38.6%" },
            { label: "Communes RN", value: "892" },
            { label: "Communes NFP", value: "445" },
        ],
        source: "Source: Ministère de l'Intérieur — Données brutes 2024",
        brand: "L'ASSEZ", accent: "#BC0100",
    },
    DECODING: {
        headline: "LE MÉCANICIEN DÉCORTIQUE",
        jargonTerm: "PÉDAGOGIE",
        officialDef: "« Réexpliquer la réforme aux Français qui n'ont pas compris. »",
        realityCheck: "Un gouvernement qui répète le même mensonge plus fort espère que la répétition le rend vrai. La pédagogie du pouvoir n'informe pas — elle soumet.",
        brand: "L'ASSEZ", accent: "#BC0100",
    },
    CHRONO_LOCK: {
        headline: "LA MÉCANIQUE DE LA TRAHISON",
        subheadline: "RETRACE L'HISTORIQUE — RIEN N'EST UN HASARD",
        timeline: [
            { date: "JANV. 2022", event: "Promesse officielle de ne pas toucher aux retraites", impact: "Déclaration télévisée, 18M téléspectateurs" },
            { date: "MARS 2022", event: "Réélection sur ce programme", impact: "+4pts d'écart grâce à cet engagement" },
            { date: "JAN. 2023", event: "Projet de loi retraites présenté", impact: "Recul âge légal à 64 ans" },
            { date: "MARS 2023", event: "49.3 — Loi adoptée sans vote", impact: "Déni démocratique complet" },
        ],
        brand: "L'ASSEZ", accent: "#BC0100",
    },
    IMPACT_QUOTE: {
        largeQuote: "« Les Français doivent apprendre à se serrer la ceinture. »",
        author: "BRUNO LE MAIRE",
        context: "Ministre de l'Économie — 3 jours après une note de frais de 12 400€",
        brand: "L'ASSEZ", accent: "#BC0100",
    },
    SOCIAL_COST: {
        headline: "COMBIEN ÇA VOUS COÛTE VRAIMENT ?",
        targetAudience: "ÉTUDIANTS BOURSIERS",
        monthlyLoss: "-87€",
        annualImpact: "-1 044€",
        consequence: "Suppression partielle des APL + gel des bourses = niveau de vie en-dessous du seuil de pauvreté pour 2,3M d'étudiants.",
        note: "Calcul L'Assez basé sur les données CNAF 2024",
        brand: "L'ASSEZ", accent: "#BC0100",
    },
    VIDEO_NOTE: {
        videoUrl: "",
        annotation: "⚠️ Cette vidéo a été supprimée 3 fois. Archivez-la.",
        headline: "DOCUMENT VIDÉO",
        brand: "L'ASSEZ", accent: "#BC0100",
        videoZoom: 1.0,
        videoX: 0,
        videoY: 0,
    },
};

export const ICONS: Record<string, string> = {
    COVER: '🗞', NEWS: '📰', MANIFESTO: '📜', MAXTEXT: '📝', GRANULAR: '⚡', BIG_NUM: '📊', VERSUS: '⚖️', CHECKLIST: '✅', INFO: '🔥', ANALYSIS: '🔍', OUTRO: '🏁',
    COMPARISON_CHART: '📈', STACKED_DATA: '🟥', VOTE_TRACKER: '🗳',
    TERRITORY_RADAR: '🗺', DECODING: '🔓', CHRONO_LOCK: '⏱', IMPACT_QUOTE: '💬', SOCIAL_COST: '💸', VIDEO_NOTE: '🎬',
};

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Inter:wght@400;500;600;700;900&family=Space+Mono:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

/* ── FONT ALIASES ─────────────────────────────────── */
.sg{font-family:'Space Grotesk',sans-serif}
.pd{font-family:'Playfair Display',serif}
.ab{font-family:'Archivo Black',sans-serif}
.ir{font-family:'Inter',sans-serif}
.sm{font-family:'Space Mono',monospace}

/* ── EDIT ZONES (template canvas interaction) ─────── */
.edit-zone{position:relative}
.edit-overlay{position:absolute;inset:0;border:1px dashed rgba(255,255,255,0.18);opacity:0;pointer-events:none;z-index:50;transition:opacity .12s ease}
.edit-zone:hover .edit-overlay,.edit-zone:focus-within .edit-overlay{opacity:1}
.edit-zone:focus-within .edit-overlay{border-style:solid;border-color:rgba(255,255,255,0.35)}
.edit-sticker{position:absolute;background:#09090b;color:#71717a;padding:1px 4px;font-family:'Space Mono',monospace;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:3px;z-index:60;border:1px solid #27272a;cursor:pointer;opacity:0;pointer-events:none;transition:all .15s ease}
.edit-zone:hover .edit-sticker,.edit-zone:focus-within .edit-sticker{opacity:1;pointer-events:auto}
.edit-sticker:hover{background:#18181b;color:#a1a1aa;border-color:#3f3f46}
.edit-zone:focus-within .edit-sticker{background:#DC2626;color:#fff;border-color:#DC2626;opacity:1;pointer-events:auto}
.edit-zone:focus-within .edit-sticker:hover{background:#b91c1c;color:#fff}
[contenteditable]{outline:none}

/* ── FLOATING TEXT TOOLBAR ────────────────────────── */
.brut-tb{position:fixed;transform:translateX(-50%);background:#09090b;border:1px solid #27272a;display:flex;align-items:center;height:32px;z-index:9999;white-space:nowrap}
.brut-tb::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:4px solid transparent;border-top-color:#27272a}
.tb-btn{height:100%;padding:0 9px;background:transparent;border:none;border-right:1px solid #1c1c1e;color:#71717a;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .1s ease;font-family:'Space Mono',monospace;font-size:10px;font-weight:700}
.tb-btn:last-child{border-right:none}
.tb-btn:hover{background:#18181b;color:#e4e4e7}
.tb-sel{height:100%;padding:0 7px;background:#09090b;border:none;border-right:1px solid #1c1c1e;color:#71717a;font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;outline:none}

/* ── SCROLLBAR ────────────────────────────────────── */
.sb::-webkit-scrollbar{width:2px}
.sb::-webkit-scrollbar-track{background:transparent}
.sb::-webkit-scrollbar-thumb{background:#27272a}
.sb::-webkit-scrollbar-thumb:hover{background:#3f3f46}

/* ── FORM INPUTS ──────────────────────────────────── */
.si{width:100%;background:#09090b;border:1px solid #1e1e20;color:#e4e4e7;font-size:11px;padding:6px 8px;outline:none;transition:border-color .12s ease;font-family:'Space Mono',monospace;border-radius:0}
.si:focus{border-color:#3f3f46}

/* ── RANGE INPUT ──────────────────────────────────── */
input[type=range]{-webkit-appearance:none;appearance:none;background:#18181b;height:2px;border-radius:0;outline:none;width:100%}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;height:10px;width:3px;background:#71717a;border:none;border-radius:0;cursor:pointer;transition:background .1s ease}
input[type=range]::-webkit-slider-thumb:hover{background:#e4e4e7}

/* ── MISC ─────────────────────────────────────────── */
.noise-overlay{position:absolute;inset:0;pointer-events:none;z-index:40;opacity:0.08;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAGFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/HlFvAAAABnRSTlMAf0D/2t91y7UCAAAAfklEQVQ4y2NgQAX8DIwgwsDAwMgAkkLUA0QhSoEUgyIjyEAQxagIVw2imKxAMphqEMVMCpC0M1QxSCxIM0gxyFIIZpCokGZwaRCwAqkGiQkJK+BSyMogxSDNICEh0QBRDKYaxKQQzCBRIdUgmEFiQZpBqkH8AhgIqQUAP/1l+9b3w9YAAAAASUVORK5CYII=");background-repeat:repeat;background-size:64px 64px;}
.split-bg{background:linear-gradient(to right,#fff 50%,#e5e5e5 50%)}
.maxtext-body ul,.maxtext-body ol{list-style:none;padding-left:0;margin:4px 0}
.maxtext-body li::before{content:'—';color:#DC2626;font-weight:700;margin-right:6px}
body.resizing * { cursor: col-resize !important; }
`;
