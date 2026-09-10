// Registre des templates — transposition du `TemplateRegistry` legacy.
// V1 : noyau de 7 templates. Les metas (defaultState + schema) sont portées à
// l'identique ; seul le rendu change (SFC Vue + couches Tiptap).
import type { SlideType, TemplateMeta } from './types'

export const FALLBACK_IMAGE = 'https://picsum.photos/seed/lassez-default/1200/800'

const COVER: TemplateMeta = {
  id: 'COVER',
  name: 'Couverture Magazine',
  category: 'Éditorial',
  description: 'Template de couverture classique avec titre incliné.',
  icon: '🗞',
  defaultState: {
    bg: '#FFFFFF',
    accent: '#DC2626',
    imageUrl: '',
    zoom: 1,
    grayscale: 0,
    posX: 0,
    posY: 0,
    issueNum: '01',
    brand: "L'ASSEZ STUDIO",
    headline: 'LE NOUVEAU<br/>PARADIGME',
    readTime: '12 MIN',
    author: 'RÉDACTION',
    swipeLabel: "VOIR L'ANALYSE",
  },
  schema: [
    { key: 'bg', label: 'Couleur de Fond', type: 'color', group: 'Style' },
    { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
    { key: 'imageUrl', label: 'Image', type: 'image', group: 'Média' },
    { key: 'grayscale', label: 'Grisaille', type: 'number', group: 'Média', props: { min: 0, max: 100 } },
    { key: 'zoom', label: 'Zoom', type: 'number', group: 'Média', props: { min: 0.1, max: 3, step: 0.1 } },
    { key: 'headline', label: 'Titre', type: 'longtext', group: 'Contenu' },
    { key: 'issueNum', label: 'Numéro Issue', type: 'text', group: 'Infos' },
    { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
    { key: 'author', label: 'Auteur', type: 'text', group: 'Infos' },
    { key: 'readTime', label: 'Lecture', type: 'text', group: 'Infos' },
    { key: 'swipeLabel', label: 'Label Swipe', type: 'text', group: 'Infos' },
  ],
}

const NEWS: TemplateMeta = {
  id: 'NEWS',
  name: 'Actualités Flash',
  category: 'Éditorial',
  description: 'Rendu type "breaking news" avec une grande image en haut.',
  icon: '📰',
  defaultState: {
    accent: '#DC2626',
    brand: "L'ASSEZ",
    category: 'FLASH',
    imageUrl: '',
    zoom: 1,
    grayscale: 0,
    posX: 0,
    posY: 0,
    date: '03 MAI 2026',
    topic: 'ANALYSE DU JOUR',
    headline: 'DÉCRYPTAGE DU<br/>NOUVEAU SYSTÈME',
  },
  schema: [
    { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
    { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
    { key: 'category', label: 'Catégorie', type: 'text', group: 'Infos' },
    { key: 'imageUrl', label: 'Image', type: 'image', group: 'Média' },
    { key: 'grayscale', label: 'Grisaille', type: 'number', group: 'Média', props: { min: 0, max: 100 } },
    { key: 'zoom', label: 'Zoom', type: 'number', group: 'Média', props: { min: 0.1, max: 3, step: 0.1 } },
    { key: 'date', label: 'Date', type: 'text', group: 'Contenu' },
    { key: 'topic', label: 'Sujet', type: 'text', group: 'Contenu' },
    { key: 'headline', label: 'Titre', type: 'longtext', group: 'Contenu' },
  ],
}

const VERSUS: TemplateMeta = {
  id: 'VERSUS',
  name: 'Comparatif Versus',
  category: 'Analyse',
  description: 'Compare deux points de vue ou deux réalités contradictoires.',
  icon: '⚖️',
  defaultState: {
    headline: 'DISCOURS VS RÉALITÉ',
    leftTitle: "CE QU'ILS DISENT",
    leftBody: "La sobriété est l'affaire de tous les citoyens.",
    rightTitle: 'LA RÉALITÉ',
    rightBody: 'Les vols en jets privés ont augmenté de 20% cette année.',
    brand: "L'ASSEZ",
    accent: '#DC2626',
  },
  schema: [
    { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
    { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
    { key: 'headline', label: 'Bandeau Titre', type: 'text', group: 'Contenu' },
    { key: 'leftTitle', label: 'Titre Gauche', type: 'text', group: 'Gauche' },
    { key: 'leftBody', label: 'Texte Gauche', type: 'longtext', group: 'Gauche' },
    { key: 'rightTitle', label: 'Titre Droite', type: 'text', group: 'Droite' },
    { key: 'rightBody', label: 'Texte Droite', type: 'longtext', group: 'Droite' },
  ],
}

const BIG_NUM: TemplateMeta = {
  id: 'BIG_NUM',
  name: 'Chiffre Impact',
  category: 'Données',
  description: 'Affiche un grand nombre avec une unité et un sous-titre.',
  icon: '📊',
  defaultState: {
    accent: '#DC2626',
    dark: false,
    brand: "L'ASSEZ",
    headline: 'AUGMENTATION DU<br/>COÛT DE LA VIE',
    num: '42%',
    label: "D'AUGMENTATION",
    sub: "Basé sur les données de l'INSEE pour le premier trimestre 2026.",
  },
  schema: [
    { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
    { key: 'dark', label: 'Mode Sombre', type: 'boolean', group: 'Style' },
    { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
    { key: 'headline', label: 'Titre', type: 'longtext', group: 'Contenu' },
    { key: 'num', label: 'Nombre', type: 'text', group: 'Contenu' },
    { key: 'label', label: 'Unité/Label', type: 'text', group: 'Contenu' },
    { key: 'sub', label: 'Description', type: 'longtext', group: 'Contenu' },
  ],
}

const IMPACT_QUOTE: TemplateMeta = {
  id: 'IMPACT_QUOTE',
  name: "Citation d'Impact",
  category: 'Analyse',
  description: 'Une citation mise en valeur sur fond sombre pour un impact maximum.',
  icon: '💬',
  defaultState: {
    largeQuote: 'NOUS NE POUVONS PAS RESTER SPECTATEURS DE NOTRE PROPRE DÉPOSSESSION.',
    author: 'ANONYME',
    context: 'MANIFESTE POUR LA DIGNITÉ - 2024',
    brand: "L'ASSEZ",
    accent: '#BC0100',
  },
  schema: [
    { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
    { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
    { key: 'largeQuote', label: 'La Citation', type: 'longtext', group: 'Contenu' },
    { key: 'author', label: 'Auteur', type: 'text', group: 'Contenu' },
    { key: 'context', label: 'Contexte / Source', type: 'text', group: 'Contenu' },
  ],
}

const INFO: TemplateMeta = {
  id: 'INFO',
  name: 'Fiche Information',
  category: 'Analyse',
  description: 'Une fiche détaillée avec deux blocs de texte et un tag de catégorie.',
  icon: '🔥',
  defaultState: {
    headline: 'DÉCORTIQUER<br/>LE SYSTÈME',
    brand: "L'ASSEZ",
    accent: '#DC2626',
    tag: 'Flash Info',
    slideNum: '02',
    body: `L'audit confirme que plus de <span style="background:#000;color:#fff;padding:0 4px;text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px;font-weight:700">60% des promesses</span> sont restées lettre morte.`,
    bodyMono: "L'Show analyse montre que ce mécanisme d'opacité est délibérément intégré dans la loi pour protéger les profits au détriment du service public.",
    actionTitle: 'Action Requise Immédiate',
    actionMeta: 'Dossier #12.04 — Secteur 4',
    footerHandle: '@LASSEZmedia',
  },
  schema: [
    { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
    { key: 'brand', label: 'Marque', type: 'text', group: 'Meta' },
    { key: 'tag', label: 'Étiquette', type: 'text', group: 'Meta' },
    { key: 'slideNum', label: 'N° Slide', type: 'text', group: 'Meta' },
    { key: 'headline', label: 'Titre Principal', type: 'longtext', group: 'Contenu' },
    { key: 'body', label: 'Corps (Gras)', type: 'longtext', group: 'Contenu' },
    { key: 'bodyMono', label: 'Corps (Détail)', type: 'longtext', group: 'Contenu' },
    { key: 'actionTitle', label: 'Titre Alerte', type: 'text', group: 'Alerte' },
    { key: 'actionMeta', label: 'Meta Alerte', type: 'text', group: 'Alerte' },
    { key: 'footerHandle', label: 'Handle Footer', type: 'text', group: 'Meta' },
  ],
}

const OUTRO: TemplateMeta = {
  id: 'OUTRO',
  name: 'Call to Action / Outro',
  category: 'Fin',
  description: "Une slide de fin pour encourager à s'abonner ou suivre un lien.",
  icon: '🏁',
  defaultState: {
    headline: `<span class="block relative">S'A<span class="absolute -top-4 -right-4 text-4xl text-white font-grotesk animate-bounce">*</span></span><span class="block ml-12">BON</span><span class="block -ml-8">NER</span>`,
    brandHandle: '@L_ASSEZ_MEDIA',
    accent: '#DC2626',
    linkText: 'Lien en bio',
    footerYear: 'EST. 2024',
    number: '04',
  },
  schema: [
    { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
    { key: 'headline', label: 'Titre CTA', type: 'longtext', group: 'Contenu' },
    { key: 'brandHandle', label: 'Handle @', type: 'text', group: 'Infos' },
    { key: 'linkText', label: 'Texte Lien', type: 'text', group: 'Infos' },
    { key: 'footerYear', label: 'Année Footer', type: 'text', group: 'Meta' },
    { key: 'number', label: 'N° Outro', type: 'text', group: 'Meta' },
  ],
}

export const TemplateRegistry: Record<string, TemplateMeta> = {
  COVER,
  NEWS,
  VERSUS,
  BIG_NUM,
  IMPACT_QUOTE,
  INFO,
  OUTRO,
}

export function getTemplate(id: string): TemplateMeta | undefined {
  return TemplateRegistry[id]
}

export function getAllTemplates(): TemplateMeta[] {
  return Object.values(TemplateRegistry)
}

export function getTemplateGroups(): { name: string; templates: TemplateMeta[] }[] {
  const order = ['Éditorial', 'Données', 'Analyse', 'Fin']
  const groups = new Map<string, TemplateMeta[]>()
  for (const t of getAllTemplates()) {
    const g = t.category ?? 'Autre'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(t)
  }
  return [...groups.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([name, templates]) => ({ name, templates }))
}

/** Schéma résolu (le legacy autorise schema dynamique en fonction du state). */
export function resolveTemplateSchema(
  meta: TemplateMeta,
  state: Record<string, unknown>,
): import('./types').TemplateField[] {
  return typeof meta.schema === 'function'
    ? (meta.schema as (s: Record<string, unknown>) => import('./types').TemplateField[])(state)
    : meta.schema
}

/** Type inconnu (import JSON legacy, V2 future) → repli INFO. */
export function coerceSlideType(type: string): SlideType {
  if (type in TemplateRegistry) return type as SlideType
  return 'INFO'
}
