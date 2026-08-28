import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { FACTORY_PROMPTS, FACTORY_FORMATS } from './factory'

// Store labo — valeurs par défaut = la VRAIE config qui tournait sur le VPS
// (radar.db 04/08/2026, voir docs/labo-bases-saines.md + daemon/config/config.yaml)

export interface WeeklySlot { day: string; time: string } // ex { day:'LUN', time:'20:08' }
export interface FormatItem {
  id: string
  nom: string
  actif: boolean
  couleur: string
  description: string
  consigne: string      // formatInstructions — envoyées à l'IA de rédaction
  exemples: string[]    // few-shot learning — des posts d'exemple à recopier
  schema: string        // outputSchemaJson — le schéma JSON de sortie attendu
}
export interface SourceItem {
  id: string
  url: string
  trust: 'high' | 'medium' | 'low'
  bias: string
  allowImages: boolean
  active: boolean
}

// Les 9 biais de l'ancienne table sources (source_bias)
export const BIAS_VALUES = ['Extrême-Gauche', 'Gauche', 'Centre-Gauche', 'Centre', 'Centre-Droit', 'Droite', 'Extrême-Droite', 'Service Public', 'Indépendant']

const DAYS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']

// ── Trust map réelle du VPS (source_trust_map) ──
const TRUST_KEYWORDS = {
  high: ['mediapart', 'humanite', 'humanité', 'blast', 'reporterre', 'basta', 'politis', 'arretsurimages', 'arrêt sur images', '972mag', 'amnesty', 'hrw', 'btselem', 'fidh', 'phr', 'palestinechronicle', 'wafa', 'palinfo', 'maannews', 'franceinsoumise', 'jlmelenchon', 'mathildepanot', 'rimahas', 'manuel_bompard', 'impactmediafr'],
  medium: ['france24', 'rfi', 'francetvinfo', 'lemonde', 'leparisien', 'lacroix', 'la-croix', 'rtl', 'nouvelobs', 'globalvoices', 'thenewhumanitarian', 'theconversation', 'chathamhouse', 'haaretz', 'un.org', 'brevesdepresse', 'alertesinfos', 'mediavenir'],
  low: ['lefigaro', 'figaro', 'cnews', 'cnews_fr', 'bfmtv', 'bfm', 'freedomhouse'],
} as const

export function detectTrust(url: string): SourceItem['trust'] {
  const h = url.toLowerCase()
  for (const level of ['high', 'medium', 'low'] as const)
    if (TRUST_KEYWORDS[level].some(k => h.includes(k))) return level
  return 'medium'
}
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
function uid() { return Math.random().toString(36).slice(2, 9) }

const DEFAULT_RSS = [
  'https://www.france24.com/en/rss',
  'https://www.rfi.fr/en/rss',
  'https://www.lemonde.fr/rss/une.xml',
  'https://www.mediapart.fr/articles/feed',
  'https://www.francetvinfo.fr/titres.rss',
  'https://www.humanite.fr/rss',
  'https://www.la-croix.com/RSS',
  'http://tempsreel.nouvelobs.com/rss.xml',
  'https://www.blast-info.fr/rss.xml',
  'https://basta.media/spip.php?page=backend',
  'https://reporterre.net/spip.php?page=backend',
]

function defaultSources(): SourceItem[] {
  return DEFAULT_RSS.map(url => ({ id: uid(), url, trust: detectTrust(url), bias: 'Indépendant', allowImages: true, active: true }))
}

export const useConfigStore = defineStore('config', () => {
  // ── Atelier ──
  const atelier = ref([
    { type: 'ingestion', label: 'Collecte', enabled: true, desc: 'On récupère les nouveaux articles', order: 1 },
    { type: 'dedup', label: 'Anti-doublons', enabled: true, desc: 'Similarité 65%, fenêtre 10 h', order: 2 },
    { type: 'research', label: 'Tri', enabled: true, desc: 'Gemini Flash note 0–100', order: 3 },
    { type: 'editor', label: 'Rédaction', enabled: true, desc: 'Gemini Pro écrit l’enquête', order: 4 },
    { type: 'validator', label: 'Vérification', enabled: true, desc: 'Auto-pilote désactivé pour l’instant', order: 5 },
    { type: 'media', label: 'Image', enabled: true, desc: 'Overlay 50%, box 78%', order: 6 },
  ])

  // Positions sauvegardées du graphe (type → x/y) — sinon reposition auto
  const positions = ref<Record<string, { x: number; y: number }>>({})

  // ── Sources structurées (trust par source, comme l'ancien admin mais mieux) ──
  const sources = ref({
    list: defaultSources(),
    telegram: '',
    xAccounts: ['JLMelenchon', 'MathildePanot', 'RimaHas', 'Manuel_Bompard', 'FranceInsoumise', 'ImpactMediaFR'].join('\n'),
    googleNews: '',
    lookbackHours: 10,
    maxArticlesPerScan: 20,
    concurrency: 5,
    bridgeUrl: 'http://localhost:3300', // RSS-Bridge pour les comptes X
    // Canaux d'ingestion activables/désactivables un par un (le daemon reçoit
    // une liste vide quand un canal est coupé).
    telegramEnabled: true,
    xEnabled: true,
    googleNewsEnabled: true,
    rssBridgeEnabled: true,
  })

  // ── Filtres ──
  const filtres = ref({
    motsCles: '',
    motsInterdits: '',
    seuilRessemblance: 65,
    fenetreDoublonsHeures: 10,
    imagesAutorisees: true,
  })

  // ── Écriture ──
  const ecriture = ref({
    // Répartition niveau gratuit : le Tri et la Vérification sur Flash Lite
    // (volume, léger), la Rédaction sur Flash (gemini-3.7-flash, le meilleur
    // rapport qualité/coût de la série Gemini 3).
    modeleRapide: 'Gemini 3.5 Flash Lite',
    modeleRedaction: 'Gemini 3.7 Flash',
    modeleVerification: 'Gemini 3.5 Flash Lite',
    tachesEnMemeTempsRapide: 5,
    tachesEnMemeTempsRedaction: 3,
    scoreMini: 50,
    // Recherche web : un seul interrupteur global — l'IA de rédaction vérifie
    // les sujets sur le web pour TOUS les types d'articles. Il alimente aussi
    // les anciennes clés par type (google_search_*_enabled) pour compat.
    webSearchEnabled: true,
    // Modèle par format (modeleParFormat : id du format → modèle). Les valeurs
    // ci-dessous = le mapping réel du VPS (ai_model_breaking/standard/decrypt),
    // transposé sur les formats actuels. Un format sans entrée utilise modeleRedaction.
    modeleParFormat: {
      // La rédaction passe par le Flash (gemini-3.7-flash) quel que soit le
      // format — pas de Pro (hors budget du niveau gratuit).
      FLASH: 'Gemini 3.7 Flash',
      CITATION: 'Gemini 3.7 Flash',
      ALERTE: 'Gemini 3.7 Flash',
      DECRYPTAGE: 'Gemini 3.7 Flash',
      INFO: 'Gemini 3.7 Flash',
    },
    // Le grand prompt éditorial (ai_prompt) — la ligne éditoriale complète.
    // Les blocs ci-dessous portent le DNA factory de L'Assez (identité "Le
    // Mécanicien", vocabulaire, méthode des 3 tirs…) — éditables dans le labo.
    promptEditorial: '',
    consigneTri: FACTORY_PROMPTS.consigneTri,
    criteresRejet: FACTORY_PROMPTS.criteresRejet,
    identite: FACTORY_PROMPTS.identite,
    mission: FACTORY_PROMPTS.mission,
    vocabulaire: FACTORY_PROMPTS.vocabulaire,
    consignesImages: FACTORY_PROMPTS.consignesImages,
    consigneGlobale: '',
  })

  // ── Registry des modèles IA (label UI + value API) — alimente tous les selects.
  // Niveau gratuit : seuls les Flash / Flash Lite sont proposés (les Pro ne
  // sont pas dans le quota gratuit — Gemini 3.7 Flash = le nouveau Flash,
  // Gemini 3.5 Flash Lite = le Flash léger de la série Gemini 3).
  const modelRegistry = ref<{ label: string; value: string }[]>([
    { label: 'Gemini 3.7 Flash', value: 'gemini-3.7-flash' },
    { label: 'Gemini 3.5 Flash Lite', value: 'gemini-3.5-flash-lite' },
    { label: 'Gemini 2.5 Flash (ancien)', value: 'gemini-2.5-flash' },
  ])
  function normalizeRegistry(saved: unknown) {
    if (!Array.isArray(saved)) return modelRegistry.value
    const out = saved.filter((m: any) => m && typeof m.label === 'string' && typeof m.value === 'string')
      .map((m: any) => ({ label: m.label, value: m.value }))
    return out.length ? out : modelRegistry.value
  }

  // ── Formats (les "Formats de News" de l'ancien labo : instructions de
  // format + exemples few-shot + schéma JSON de sortie par type d'info) ──
  const formats = ref<FormatItem[]>(FACTORY_FORMATS.map(x => ({ ...x, actif: true, exemples: [...x.exemples] })))

  // ── Partage ──
  const partage = ref({
    discord: true,
    qoe: true,
    x: false,
    bluesky: false,
    mastodon: false,
    discordMode: 'DIRECT' as 'DIRECT' | 'SCHEDULED',
    qoeMode: 'DIRECT' as 'DIRECT' | 'SCHEDULED',
    xMode: 'DIRECT' as 'DIRECT' | 'SCHEDULED',
    blueskyMode: 'DIRECT' as 'DIRECT' | 'SCHEDULED',
    mastodonMode: 'DIRECT' as 'DIRECT' | 'SCHEDULED',
    delaiMini: 1,
    delaiMaxi: 2,
    auto: false,               // auto_pilot_enabled = false sur le VPS
    autoApprove: false,        // auto_approve_enabled — Mode Fantôme (l'IA approuve sans modération)
    autoApproveMedia: true,    // mode fantôme : garder l'enrichissement média (false = PENDING direct)
    discordTestMode: true,
  })

  // ── Secrets plateformes — JAMAIS dans localStorage, ni dans config.yaml versionné.
  // Écrits dans daemon/config/.secrets.yaml (gitignoré) via /api/secrets.
  const secrets = ref({
    discordWebhookUrl: '',
    xApiKey: '', xApiSecret: '', xAccessToken: '', xAccessSecret: '',
    blueskyIdentifier: '', blueskyAppPassword: '',
    mastodonInstanceUrl: '', mastodonAccessToken: '',
    // qoe.fi — la clé d'API + l'id de publication (jamais dans git)
    qoeApiKey: '',
    qoePublicationId: '',
    qoeBaseUrl: 'https://api.qoe.fi/v1',
    // Gemini — la clé qui fait tourner les nœuds IA du pipeline (Tri /
    // Rédaction / Vérification). Écrite dans .secrets.yaml, jamais dans git.
    geminiApiKey: '',
    // Vertex AI (secours) — compte de service Google Cloud : utilisé
    // automatiquement quand la clé AI Studio est épuisée ou invalide.
    vertexServiceAccount: '',
    vertexRegion: 'global',
    // Recherche d'images officielle Google (Custom Search JSON API) — 100
    // requêtes/jour gratuites. Optionnelle : sans elle, le nœud média
    // retombe sur Wikimedia Commons. Clés dans .secrets.yaml, jamais dans git.
    googleCseApiKey: '',
    googleCseId: '',
  })

  // ── Planning (réel : tous les jours à 20:08, Europe/Paris) ──
  const planning = ref({
    mode: 'calendar' as 'pulse' | 'calendar' | 'hybrid',
    intervalleMinutes: 6,
    timezone: 'Europe/Paris',
    weeklySlots: DAYS.map(d => ({ day: d, time: '20:08' })) as WeeklySlot[],
  })

  // ── Image / média (image_overlay_*, image_box_scale_*) ──
  const media = ref({
    overlayEnabled: true,      // pourcentages entiers pour les sliders
    overlayOpacity: 50,        // image_overlay_opacity = 0.5
    boxScale169: 78,           // image_box_scale_169 = 0.78
    boxScale11: 78,            // image_box_scale_11
  })

  // ── Vidéo Telegram (video_*) ──
  const video = ref({
    ingestEnabled: false,
    prefilterModel: 'gemini-2.0-flash',
    transcribeModel: 'gemini-2.0-flash',
    prefilterPrompt: 'Ce message Telegram parle-t-il de politique, de mouvements sociaux, de justice ou d un evenement d interet public ? Reponds uniquement par OUI ou NON.',
    prefilterMinChars: 20,     // video_prefilter_min_chars
    maxAudioMb: 20,
  })

  // ── Système + communication (maintenance + popup don) ──
  const systeme = ref({
    niveauLogs: 'INFO',
    garderLogsJours: 7,
    miroirLogs: true,
    maintenanceMode: false,
    maintenanceMessage: 'L’Assez fait peau neuve. Nous revenons dans quelques instants.',
    popupEnabled: false,       // popup_enabled
    popupTitle: 'Soutenez L’Assez !',
    popupText: 'Votre média indépendant a besoin de vous pour continuer ses enquêtes sans concession. Soutenez-nous par un don.',
    popupLinkLabel: 'Faire un don',
    popupLinkUrl: '/soutenir',
  })

  // ── État de sauvegarde (indicateur visible dans la topbar) ──
  const saveState = ref<'clean' | 'saving' | 'saved' | 'error'>('clean')
  const lastSavedAt = ref<Date | null>(null)
  // Une sauvegarde a échoué (daemon éteint) mais la config est en localStorage :
  // on retentera automatiquement jusqu'à ce que config.yaml soit à jour.
  const configPending = ref(false)

  // ── Modèles référencés par NOM (label), pas par valeur API ──
  // Tous les champs « modèle » du store gardent le label affiché ; à la
  // sauvegarde, le label est résolu vers la valeur API courante du registry.
  // Modifier la valeur (ID API) d'un modèle déjà sélectionné ne casse donc
  // plus aucune sélection — les sélections suivent le nom.
  function modelLabelOf(v: string): string {
    if (!v) return v
    const m = modelRegistry.value.find(x => x.value === v)
    return m ? m.label : v
  }
  function modelValueOf(l: string): string {
    if (!l) return l
    const m = modelRegistry.value.find(x => x.label === l)
    return m ? m.value : l
  }
  function normalizeModelFields() {
    // Un modèle inconnu (vieille config, valeur hors registry) est ajouté au
    // registry pour que le select ne reste jamais vide au chargement.
    const ensure = (raw: string): string => {
      const label = modelLabelOf(raw)
      const hasLabel = modelRegistry.value.some(m => m.label === label)
      const hasValue = modelRegistry.value.some(m => m.value === raw)
      if (!hasLabel && !hasValue && raw.trim()) modelRegistry.value.push({ label, value: raw })
      return label
    }
    ecriture.value.modeleRapide = ensure(ecriture.value.modeleRapide)
    ecriture.value.modeleRedaction = ensure(ecriture.value.modeleRedaction)
    ecriture.value.modeleVerification = ensure(ecriture.value.modeleVerification)
    const mbf: Record<string, string> = {}
    for (const k of Object.keys(ecriture.value.modeleParFormat)) mbf[k] = ensure(ecriture.value.modeleParFormat[k])
    ecriture.value.modeleParFormat = mbf
    video.value.prefilterModel = ensure(video.value.prefilterModel)
    video.value.transcribeModel = ensure(video.value.transcribeModel)
  }

  // Garde-fous de l'autosave : pendant qu'on hydrate (localStorage / daemon),
  // on ne veut pas marquer le store « sale ».
  const hydrating = ref(false)
  let baseline = ''
  function stateSnapshot() {
    return JSON.stringify([
      atelier.value, positions.value, sources.value, filtres.value, ecriture.value,
      formats.value, partage.value, planning.value, media.value, video.value,
      systeme.value, matrix.value, modelRegistry.value,
    ])
  }

  const dirty = ref(false)
  function markDirty() { dirty.value = true }

  // ── API du daemon (config.yaml) — source de vérité quand le robot tourne ──
  const apiOk = ref(false)
  const apiError = ref<string | null>(null)

  // Santé réelle des sources — remplie par GET /api/sources-health (le daemon
  // l'enregistre à chaque scan dans daemon_source_health).
  const sourceHealth = ref<Record<string, {
    url: string; type: string; source_name: string
    consecutive_failures: number; last_status: string; last_error: string
    status: 'HEALTHY' | 'DEGRADED' | 'DISABLED'; last_ok_at: string; last_check_at: string
  }>>({})

  async function loadSourceHealth() {
    try {
      const res = await fetch('/api/sources-health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const y = await res.json()
      const out: typeof sourceHealth.value = {}
      if (Array.isArray(y?.data)) {
        for (const h of y.data) if (h && typeof h.url === 'string') out[h.url] = h
      }
      sourceHealth.value = out
    } catch { /* daemon down → santé inconnue, la vue reste en repli */ }
  }

  // Matrice format → plateformes (persistée dans publisher.targetsByType du YAML)
  const matrix = ref<Record<string, Record<string, boolean>>>(defaultMatrix())
  function defaultMatrix() {
    return Object.fromEntries(formats.value.map(f => [f.id, { qoe: true, discord: f.nom.includes('Alerte'), x: false, bluesky: false, mastodon: false }]))
  }
  function normalizeMatrix(saved: unknown) {
    const base = defaultMatrix()
    if (!isObj(saved)) return base
    for (const f of formats.value) {
      const m = saved[f.id]
      if (isObj(m)) base[f.id] = { ...base[f.id], ...pick(base[f.id], m) }
    }
    return base
  }

  // Helpers de mapping store ↔ YAML
  const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
  const round2 = (n: number) => Math.round(n * 100) / 100
  const sOr = (v: any, def: string) => (typeof v === 'string' && v ? v : def)
  const boolOr = (v: any, def: boolean) => (typeof v === 'boolean' ? v : def)
  const numOr = (v: any, def: number) => (typeof v === 'number' ? v : def)
  const pctOf = (v: any, def: number) => (typeof v === 'number' ? Math.round(v * 100) : def)
  // editorial.modelByType (legacy, objet {alerte, standard, decrypt}) → transcrit
  // sur les formats actuels, pour migrer une vieille config.yaml.
  const LEGACY_SLOT_TO_FORMAT: Record<string, string> = { alerte: 'ALERTE', standard: 'INFO', decrypt: 'DECRYPTAGE' }
  const legacyModels = (editorial: any): Record<string, string> => {
    if (!isObj(editorial) || !isObj(editorial.modelByType)) return {}
    const mbt = editorial.modelByType
    const out: Record<string, string> = {}
    for (const [slot, fmtId] of Object.entries(LEGACY_SLOT_TO_FORMAT)) {
      if (typeof mbt[slot] === 'string' && mbt[slot]) out[fmtId] = mbt[slot]
    }
    return out
  }
  // Modèles par format : modelByFormat (nouveau) prime ; sinon legacy modelByType ;
  // sinon les défauts du store. Les champs vides ne sont jamais pris.
  function normalizeModelByFormat(saved: unknown, legacy: Record<string, string>, def: Record<string, string>) {
    const out: Record<string, string> = { ...def }
    if (isObj(saved)) {
      for (const k of Object.keys(saved)) if (typeof saved[k] === 'string' && saved[k]) out[k] = saved[k]
    } else {
      for (const k of Object.keys(legacy)) if (legacy[k]) out[k] = legacy[k]
    }
    return out
  }

  // Le store → structure imbriquée de config.yaml (sections gérées par le labo)
  function toYamlConfig(): Record<string, any> {
    const targetsByType: Record<string, Record<string, boolean>> = {}
    for (const f of formats.value) {
      const m = matrix.value[f.id] ?? {}
      targetsByType[f.id] = {
        qoe: m.qoe !== false,
        discord: m.discord !== false,
        x: m.x === true,
        bluesky: m.bluesky === true,
        mastodon: m.mastodon === true,
      }
    }
    return {
      ingestion: {
        timeWindowHours: sources.value.lookbackHours,
        maxArticlesPerScan: sources.value.maxArticlesPerScan,
        concurrency: sources.value.concurrency,
        // Un canal coupé dans le labo → liste vide côté daemon (il n'aspire rien).
        sources: {
          rss: sources.value.list.filter(s => s.active).map(s => s.url),
          telegram: sources.value.telegramEnabled ? lines(sources.value.telegram) : [],
          xAccounts: sources.value.xEnabled ? lines(sources.value.xAccounts) : [],
          googleNews: sources.value.googleNewsEnabled ? lines(sources.value.googleNews) : [],
        },
        // RSS-Bridge : l'URL de base sert au daemon pour convertir les comptes X
        // en flux Atom (TwitterBridge). Vide si le canal est coupé → le daemon
        // ignore les comptes X (il ne peut pas les convertir).
        rssBridgeUrl: sources.value.rssBridgeEnabled ? sources.value.bridgeUrl : '',
        // État des canaux (section labo — le daemon l'ignore).
        channels: {
          telegram: sources.value.telegramEnabled,
          x: sources.value.xEnabled,
          googleNews: sources.value.googleNewsEnabled,
          rssBridge: sources.value.rssBridgeEnabled,
        },
      },
      // Métadonnées par source (biais, fiabilité, images, actif) — le daemon lit
      // ingestion.sources.rss (URLs actives) ; cette section est pour le labo.
      sourcesMeta: sources.value.list.map(s => ({ url: s.url, trust: s.trust, bias: s.bias, allowImages: s.allowImages, active: s.active })),
      dedup: {
        similarityThreshold: round2(filtres.value.seuilRessemblance / 100),
        lookbackHours: filtres.value.fenetreDoublonsHeures,
      },
      filters: {
        keywords: lines(filtres.value.motsCles),
        bannedKeywords: lines(filtres.value.motsInterdits),
        allowSourceImages: filtres.value.imagesAutorisees,
      },
      research: {
        aiModelFlash: modelValueOf(ecriture.value.modeleRapide),
        aiModelDecrypt: modelValueOf(ecriture.value.modeleRedaction),
        maxConcurrentTasks: ecriture.value.tachesEnMemeTempsRapide,
        scoreThreshold: ecriture.value.scoreMini,
        // Un seul interrupteur global ; les anciennes clés par type restent
        // écrites à l'identique pour être lisibles par les vieux daemons.
        webSearchEnabled: ecriture.value.webSearchEnabled,
        googleSearchBreaking: ecriture.value.webSearchEnabled,
        googleSearchStandard: ecriture.value.webSearchEnabled,
        googleSearchDecrypt: ecriture.value.webSearchEnabled,
        systemPrompt: ecriture.value.consigneTri,
        rejectCriteria: ecriture.value.criteresRejet,
        customPromptModifier: ecriture.value.consigneGlobale,
      },
      editorial: {
        aiModelPro: modelValueOf(ecriture.value.modeleRedaction),
        aiModelVerification: modelValueOf(ecriture.value.modeleVerification),
        maxConcurrentTasks: ecriture.value.tachesEnMemeTempsRedaction,
        aiPrompt: ecriture.value.promptEditorial,
        modelByFormat: Object.fromEntries(
          Object.entries(ecriture.value.modeleParFormat).map(([k, v]) => [k, modelValueOf(v)])
        ),
        // Clés legacy (alerte/standard/decrypt) conservées pour compat — le
        // daemon lit modelByFormat (par id de format) depuis cette version.
        modelByType: {
          alerte: modelValueOf(ecriture.value.modeleParFormat['ALERTE'] ?? ecriture.value.modeleRedaction),
          standard: modelValueOf(ecriture.value.modeleParFormat['INFO'] ?? ecriture.value.modeleRedaction),
          decrypt: modelValueOf(ecriture.value.modeleParFormat['DECRYPTAGE'] ?? ecriture.value.modeleRedaction),
        },
        baseIdentity: ecriture.value.identite,
        researchMission: ecriture.value.mission,
        vocabularyRules: ecriture.value.vocabulaire,
        imageRules: ecriture.value.consignesImages,
        customModifier: ecriture.value.consigneGlobale,
      },
      modelRegistry: modelRegistry.value,
      formats: formats.value.map(f => ({
        id: f.id, nom: f.nom, actif: f.actif, couleur: f.couleur,
        description: f.description, consigne: f.consigne,
        exemples: f.exemples, schema: f.schema,
      })),
      publisher: {
        enableDiscord: partage.value.discord,
        discordTestMode: partage.value.discordTestMode,
        enableQoe: partage.value.qoe,
        enableX: partage.value.x,
        enableBluesky: partage.value.bluesky,
        enableMastodon: partage.value.mastodon,
        discordPublishMode: partage.value.discordMode,
        qoePublishMode: partage.value.qoeMode,
        xPublishMode: partage.value.xMode,
        blueskyPublishMode: partage.value.blueskyMode,
        mastodonPublishMode: partage.value.mastodonMode,
        minDelayMinutes: partage.value.delaiMini,
        maxDelayMinutes: partage.value.delaiMaxi,
        enableAutoPublish: partage.value.auto,
        enableAutoApprove: partage.value.autoApprove, // Mode Fantôme
        enableAutoApproveMedia: partage.value.autoApproveMedia, // média en mode fantôme
        targetsByType,
      },
      scheduling: {
        mode: planning.value.mode,
        scrapingIntervalMinutes: planning.value.intervalleMinutes,
        weeklySlots: planning.value.weeklySlots,
        timezone: planning.value.timezone,
      },
      media: {
        overlayEnabled: media.value.overlayEnabled,
        overlayOpacity: round2(media.value.overlayOpacity / 100),
        boxScale169: round2(media.value.boxScale169 / 100),
        boxScale11: round2(media.value.boxScale11 / 100),
      },
      video: {
        ingestEnabled: video.value.ingestEnabled,
        prefilterModel: modelValueOf(video.value.prefilterModel),
        transcribeModel: modelValueOf(video.value.transcribeModel),
        prefilterPrompt: video.value.prefilterPrompt,
        prefilterMinChars: video.value.prefilterMinChars,
        maxAudioMb: video.value.maxAudioMb,
      },
      system: {
        logLevel: systeme.value.niveauLogs,
        logRetentionDays: systeme.value.garderLogsJours,
        logMirrorEnabled: systeme.value.miroirLogs,
        maintenanceMode: systeme.value.maintenanceMode,
        maintenanceMessage: systeme.value.maintenanceMessage,
        popupEnabled: systeme.value.popupEnabled,
        popupTitle: systeme.value.popupTitle,
        popupText: systeme.value.popupText,
        popupLinkLabel: systeme.value.popupLinkLabel,
        popupLinkUrl: systeme.value.popupLinkUrl,
      },
      pipeline: {
        // Le daemon lit pipeline.graphJson (string) pour savoir quels nœuds tourner
        graphJson: JSON.stringify({ nodes: atelier.value.map(n => ({ type: n.type, enabled: n.enabled })) }),
      },
    }
  }

  // config.yaml (JSON) → store
  function applyFromYaml(y: any) {
    if (!isObj(y)) return
    const ing = isObj(y.ingestion) ? y.ingestion : {}
    const src = isObj(ing.sources) ? ing.sources : {}

    // Sources — on préfère sourcesMeta (biais/confiance/images) quand elle existe,
    // sinon on reconstruit depuis la liste d'URLs ingestion.sources.rss.
    const metaByUrl = new Map<string, any>()
    if (Array.isArray(y.sourcesMeta)) {
      for (const m of y.sourcesMeta) if (m && typeof m.url === 'string') metaByUrl.set(m.url, m)
    }
    const list: SourceItem[] = []
    if (Array.isArray(src.rss)) {
      for (const u of src.rss) {
        if (typeof u !== 'string' || !u.trim()) continue
        const prev = sources.value.list.find(s => s.url === u)
        const meta = metaByUrl.get(u) ?? {}
        list.push(prev ?? {
          id: uid(), url: u,
          trust: meta.trust === 'high' || meta.trust === 'medium' || meta.trust === 'low' ? meta.trust : detectTrust(u),
          bias: typeof meta.bias === 'string' && BIAS_VALUES.includes(meta.bias) ? meta.bias : 'Indépendant',
          allowImages: meta.allowImages !== false,
          active: meta.active !== false,
        })
      }
    }
    if (list.length > 0) sources.value.list = list
    sources.value.telegram = Array.isArray(src.telegram) ? src.telegram.join('\n') : sources.value.telegram
    sources.value.xAccounts = Array.isArray(src.xAccounts) ? src.xAccounts.join('\n') : sources.value.xAccounts
    sources.value.googleNews = Array.isArray(src.googleNews) ? src.googleNews.join('\n') : sources.value.googleNews
    sources.value.lookbackHours = numOr(ing.timeWindowHours, sources.value.lookbackHours)
    sources.value.maxArticlesPerScan = numOr(ing.maxArticlesPerScan, sources.value.maxArticlesPerScan)
    sources.value.concurrency = numOr(ing.concurrency, sources.value.concurrency)
    if (typeof ing.rssBridgeUrl === 'string' && ing.rssBridgeUrl) sources.value.bridgeUrl = ing.rssBridgeUrl
    if (isObj(ing.channels)) {
      // Le bloc channels fait foi quand il existe.
      sources.value.telegramEnabled = boolOr(ing.channels.telegram, true)
      sources.value.xEnabled = boolOr(ing.channels.x, true)
      sources.value.googleNewsEnabled = boolOr(ing.channels.googleNews, true)
      sources.value.rssBridgeEnabled = boolOr(ing.channels.rssBridge, true)
    } else {
      // Ancienne config sans bloc channels → tous les canaux sont activés.
      // Évite qu'un localStorage périmé (daemon éteint) désactive tout et vide
      // les listes (comptes X…) au prochain enregistrement.
      sources.value.telegramEnabled = true
      sources.value.xEnabled = true
      sources.value.googleNewsEnabled = true
      sources.value.rssBridgeEnabled = true
    }

    // Filtres
    const dedup = isObj(y.dedup) ? y.dedup : {}
    filtres.value = {
      ...filtres.value,
      seuilRessemblance: pctOf(dedup.similarityThreshold, filtres.value.seuilRessemblance),
      fenetreDoublonsHeures: numOr(dedup.lookbackHours, filtres.value.fenetreDoublonsHeures),
      ...(isObj(y.filters) ? {
        motsCles: (Array.isArray(y.filters.keywords) ? y.filters.keywords : []).join(', '),
        motsInterdits: (Array.isArray(y.filters.bannedKeywords) ? y.filters.bannedKeywords : []).join(', '),
        imagesAutorisees: boolOr(y.filters.allowSourceImages, filtres.value.imagesAutorisees),
      } : {}),
    }

    // Écriture
    const research = isObj(y.research) ? y.research : {}
    const editorial = isObj(y.editorial) ? y.editorial : {}
    ecriture.value = {
      ...ecriture.value,
      modeleRapide: sOr(research.aiModelFlash, ecriture.value.modeleRapide),
      modeleRedaction: sOr(editorial.aiModelPro, sOr(research.aiModelDecrypt, ecriture.value.modeleRedaction)),
      modeleVerification: sOr(editorial.aiModelVerification, ecriture.value.modeleVerification),
      tachesEnMemeTempsRapide: numOr(research.maxConcurrentTasks, ecriture.value.tachesEnMemeTempsRapide),
      tachesEnMemeTempsRedaction: numOr(editorial.maxConcurrentTasks, ecriture.value.tachesEnMemeTempsRedaction),
      scoreMini: numOr(research.scoreThreshold, ecriture.value.scoreMini),
      consigneTri: sOr(research.systemPrompt, ecriture.value.consigneTri),
      criteresRejet: sOr(research.rejectCriteria, ecriture.value.criteresRejet),
      identite: sOr(editorial.baseIdentity, ecriture.value.identite),
      mission: sOr(editorial.researchMission, ecriture.value.mission),
      vocabulaire: sOr(editorial.vocabularyRules, ecriture.value.vocabulaire),
      consignesImages: sOr(editorial.imageRules, ecriture.value.consignesImages),
      consigneGlobale: sOr(editorial.customModifier, sOr(research.customPromptModifier, ecriture.value.consigneGlobale)),
      // Recherche web globale + modèles par format + grand prompt éditorial
      webSearchEnabled: boolOr(research.webSearchEnabled, boolOr(research.googleSearchBreaking, boolOr(research.googleSearchStandard, boolOr(research.googleSearchDecrypt, ecriture.value.webSearchEnabled)))),
      modeleParFormat: normalizeModelByFormat(editorial.modelByFormat, legacyModels(editorial), ecriture.value.modeleParFormat),
      promptEditorial: sOr(editorial.aiPrompt, ecriture.value.promptEditorial),
    }
    if (Array.isArray(y.modelRegistry) && y.modelRegistry.length > 0) {
      modelRegistry.value = normalizeRegistry(y.modelRegistry)
    }

    // Formats — les 5 rubriques de l'ancienne DB restent TOUJOURS présentes
    // avec leurs instructions/exemples/schéma (factory) ; un champ vide dans
    // la config sauvegardée retombe sur le template au lieu de l'effacer.
    if (Array.isArray(y.formats)) {
      formats.value = mergeFormats(y.formats)
    }

    // Partage + matrice
    const pub = isObj(y.publisher) ? y.publisher : {}
    partage.value = {
      ...partage.value,
      discord: boolOr(pub.enableDiscord, partage.value.discord),
      qoe: boolOr(pub.enableQoe, partage.value.qoe),
      x: boolOr(pub.enableX, partage.value.x),
      bluesky: boolOr(pub.enableBluesky, partage.value.bluesky),
      mastodon: boolOr(pub.enableMastodon, partage.value.mastodon),
      discordTestMode: boolOr(pub.discordTestMode, partage.value.discordTestMode),
      discordMode: sOr(pub.discordPublishMode, partage.value.discordMode) as 'DIRECT' | 'SCHEDULED',
      qoeMode: sOr(pub.qoePublishMode, partage.value.qoeMode) as 'DIRECT' | 'SCHEDULED',
      xMode: sOr(pub.xPublishMode, partage.value.xMode) as 'DIRECT' | 'SCHEDULED',
      blueskyMode: sOr(pub.blueskyPublishMode, partage.value.blueskyMode) as 'DIRECT' | 'SCHEDULED',
      mastodonMode: sOr(pub.mastodonPublishMode, partage.value.mastodonMode) as 'DIRECT' | 'SCHEDULED',
      delaiMini: numOr(pub.minDelayMinutes, partage.value.delaiMini),
      delaiMaxi: numOr(pub.maxDelayMinutes, partage.value.delaiMaxi),
      auto: boolOr(pub.enableAutoPublish, partage.value.auto),
      autoApprove: boolOr(pub.enableAutoApprove, partage.value.autoApprove),
      autoApproveMedia: boolOr(pub.enableAutoApproveMedia, partage.value.autoApproveMedia),
    }
    if (isObj(pub.targetsByType)) {
      matrix.value = defaultMatrix()
      for (const f of formats.value) {
        const t = pub.targetsByType[f.id]
        if (isObj(t)) {
          matrix.value[f.id] = {
            qoe: t.qoe !== false,
            discord: t.discord !== false,
            x: t.x === true,
            bluesky: t.bluesky === true,
            mastodon: t.mastodon === true,
          }
        }
      }
    }

    // Planning
    const sched = isObj(y.scheduling) ? y.scheduling : {}
    planning.value = normalizePlanning({
      mode: sched.mode,
      intervalleMinutes: sched.scrapingIntervalMinutes,
      timezone: sched.timezone,
      weeklySlots: Array.isArray(sched.weeklySlots) ? sched.weeklySlots : undefined,
    })

    // Media / vidéo / système
    const med = isObj(y.media) ? y.media : {}
    media.value = {
      ...media.value,
      overlayEnabled: boolOr(med.overlayEnabled, media.value.overlayEnabled),
      overlayOpacity: pctOf(med.overlayOpacity, media.value.overlayOpacity),
      boxScale169: pctOf(med.boxScale169, media.value.boxScale169),
      boxScale11: pctOf(med.boxScale11, media.value.boxScale11),
    }
    const vid = isObj(y.video) ? y.video : {}
    video.value = {
      ...video.value,
      ingestEnabled: boolOr(vid.ingestEnabled, video.value.ingestEnabled),
      prefilterModel: sOr(vid.prefilterModel, video.value.prefilterModel),
      transcribeModel: sOr(vid.transcribeModel, video.value.transcribeModel),
      prefilterPrompt: sOr(vid.prefilterPrompt, video.value.prefilterPrompt),
      prefilterMinChars: numOr(vid.prefilterMinChars, video.value.prefilterMinChars),
      maxAudioMb: numOr(vid.maxAudioMb, video.value.maxAudioMb),
    }
    const sys = isObj(y.system) ? y.system : {}
    systeme.value = {
      ...systeme.value,
      niveauLogs: sOr(sys.logLevel, systeme.value.niveauLogs),
      garderLogsJours: numOr(sys.logRetentionDays, systeme.value.garderLogsJours),
      miroirLogs: boolOr(sys.logMirrorEnabled, systeme.value.miroirLogs),
      maintenanceMode: boolOr(sys.maintenanceMode, systeme.value.maintenanceMode),
      maintenanceMessage: sOr(sys.maintenanceMessage, systeme.value.maintenanceMessage),
      popupEnabled: boolOr(sys.popupEnabled, systeme.value.popupEnabled),
      popupTitle: sOr(sys.popupTitle, systeme.value.popupTitle),
      popupText: sOr(sys.popupText, systeme.value.popupText),
      popupLinkLabel: sOr(sys.popupLinkLabel, systeme.value.popupLinkLabel),
      popupLinkUrl: sOr(sys.popupLinkUrl, systeme.value.popupLinkUrl),
    }

    // Atelier (nœuds actifs depuis pipeline.graphJson)
    if (isObj(y.pipeline) && typeof y.pipeline.graphJson === 'string' && y.pipeline.graphJson.trim()) {
      try {
        const g = JSON.parse(y.pipeline.graphJson)
        if (Array.isArray(g.nodes)) {
          const enabledByType: Record<string, boolean> = {}
          for (const n of g.nodes) if (n && typeof n.type === 'string') enabledByType[n.type] = n.enabled !== false
          atelier.value = atelier.value.map(n => ({ ...n, enabled: enabledByType[n.type] ?? n.enabled }))
        }
      } catch { /* graphe corrompu → on garde l'existant */ }
    }
  }

  // ── Chargement robuste : on ne fait JAMAIS confiance au localStorage. ──
  // Une config d'une ancienne version (forme différente) doit retomber sur les
  // défauts au lieu de faire planter les vues (pages blanches).
  function isObj(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
  }
  // Merge d'un objet plat : chaque clé manquante côté saved retombe sur le défaut.
  function pick<T extends Record<string, any>>(def: T, saved: unknown): T {
    const out: Record<string, any> = { ...def }
    if (isObj(saved)) for (const k of Object.keys(def)) if (saved[k] !== undefined) out[k] = saved[k]
    return out as T
  }
  // Variante pour la section Écriture : une chaîne VIDE ne doit JAMAIS écraser
  // le défaut — les blocs de prompts (identité, tri…) ont pour convention
  // « vide = texte par défaut du code » (c'était le comportement de l'ancienne
  // DB, où tous les ai_prompt_* étaient vides). Une vieille config ne peut
  // donc plus vider les blocs par accident.
  function pickEcriture(def: any, saved: unknown) {
    const out: Record<string, any> = { ...def }
    if (!isObj(saved)) return out
    for (const k of Object.keys(def)) {
      const v = saved[k]
      if (v === undefined) continue
      if (typeof v === 'string' && v.trim() === '') continue
      out[k] = v
    }
    return out
  }
  function normalizeAtelier(saved: unknown) {
    const def = atelier.value
    if (!Array.isArray(saved) || saved.length === 0) return def
    const byType = new Map(def.map(n => [n.type, n]))
    return saved
      .filter((n: any) => n && typeof n.type === 'string')
      .map((n: any) => {
        const d = byType.get(n.type)
        return {
          type: n.type,
          label: typeof n.label === 'string' ? n.label : (d?.label ?? n.type),
          enabled: n.enabled !== false,
          desc: typeof n.desc === 'string' ? n.desc : (d?.desc ?? ''),
          order: typeof n.order === 'number' ? n.order : (d?.order ?? 0),
        }
      })
  }
  // Les 4 anciens formats par défaut (avant le portage de l'ancienne DB) :
  // ils sont remplacés par les 5 rubriques factory, sans consigne à migrer.
  const LEGACY_DEFAULT_FORMAT_IDS = ['ALERTE_INFO', 'FAIT_DU_JOUR', 'A_VENIR']
  function mergeFormats(saved: unknown): FormatItem[] {
    // On part TOUJOURS des 5 rubriques de l'ancienne DB (factory) : instructions
    // de format + exemples few-shot + schéma de sortie. C'est le défaut.
    const out: FormatItem[] = FACTORY_FORMATS.map(x => ({ ...x, actif: true, exemples: [...x.exemples] }))
    if (!Array.isArray(saved)) return out
    const byId = new Map<string, any>()
    for (const f of saved) {
      if (f && typeof f === 'object' && typeof f.id === 'string' && !LEGACY_DEFAULT_FORMAT_IDS.includes(f.id)) byId.set(f.id, f)
    }
    // 1) Les rubriques factory : un champ vide dans la config sauvegardée
    //    retombe sur le template (jamais d'instructions effacées par une
    //    vieille config ou un localStorage périmé).
    for (const base of out) {
      const s = byId.get(base.id)
      if (!s) continue
      base.nom = typeof s.nom === 'string' && s.nom ? s.nom : base.nom
      base.actif = s.actif !== false
      base.couleur = typeof s.couleur === 'string' && s.couleur ? s.couleur : base.couleur
      base.description = typeof s.description === 'string' && s.description ? s.description : base.description
      base.consigne = typeof s.consigne === 'string' && s.consigne ? s.consigne : base.consigne
      base.exemples = Array.isArray(s.exemples) && s.exemples.length > 0 ? s.exemples.filter((e: any) => typeof e === 'string') : base.exemples
      base.schema = typeof s.schema === 'string' && s.schema ? s.schema : base.schema
      byId.delete(base.id)
    }
    // 2) Les formats créés par l'utilisateur (ids hors factory) sont gardés.
    for (const [, s] of byId) {
      out.push({
        id: s.id,
        nom: typeof s.nom === 'string' && s.nom ? s.nom : 'Format',
        actif: s.actif !== false,
        couleur: typeof s.couleur === 'string' && s.couleur ? s.couleur : '#3ecf8e',
        description: typeof s.description === 'string' ? s.description : '',
        consigne: typeof s.consigne === 'string' ? s.consigne : '',
        exemples: Array.isArray(s.exemples) ? s.exemples.filter((e: any) => typeof e === 'string') : [],
        schema: typeof s.schema === 'string' ? s.schema : '',
      })
    }
    return out
  }
  function normalizeFormats(saved: unknown) { return mergeFormats(saved) }
  function normalizeSources(saved: unknown) {
    const def = sources.value
    const out: any = { ...def }
    if (isObj(saved)) {
      for (const k of ['telegram', 'xAccounts', 'googleNews', 'lookbackHours', 'maxArticlesPerScan', 'concurrency', 'bridgeUrl', 'telegramEnabled', 'xEnabled', 'googleNewsEnabled', 'rssBridgeEnabled'])
        if (saved[k] !== undefined) out[k] = saved[k]
      if (Array.isArray(saved.list) && saved.list.length > 0) {
        out.list = saved.list
          .filter((s: any) => s && typeof s.url === 'string')
          .map((s: any) => ({
            id: typeof s.id === 'string' ? s.id : uid(),
            url: s.url,
            trust: s.trust === 'high' || s.trust === 'medium' || s.trust === 'low' ? s.trust : detectTrust(s.url),
            bias: typeof s.bias === 'string' && BIAS_VALUES.includes(s.bias) ? s.bias : 'Indépendant',
            allowImages: s.allowImages !== false,
            active: s.active !== false,
          }))
      } else if (typeof saved.rss === 'string' && saved.rss.trim()) {
        // Migration v1 → v2 : l'ancienne clé `rss` (textarea) devient la liste structurée
        out.list = saved.rss.split('\n').map((u: string) => u.trim()).filter(Boolean)
          .map((url: string) => ({ id: uid(), url, trust: detectTrust(url), bias: 'Indépendant', allowImages: true, active: true }))
      }
    }
    return out
  }
  function normalizePlanning(saved: unknown) {
    const def = planning.value
    let weeklySlots = def.weeklySlots
    let mode = def.mode
    let intervalleMinutes = def.intervalleMinutes
    let timezone = def.timezone
    if (isObj(saved)) {
      if (saved.mode === 'pulse' || saved.mode === 'calendar' || saved.mode === 'hybrid') mode = saved.mode
      if (typeof saved.intervalleMinutes === 'number') intervalleMinutes = saved.intervalleMinutes
      if (typeof saved.timezone === 'string') timezone = saved.timezone
      if (Array.isArray(saved.weeklySlots)) {
        weeklySlots = saved.weeklySlots
          .filter((s: any) => s && typeof s === 'object' && DAYS.includes(s.day) && typeof s.time === 'string')
          .map((s: any) => ({ day: s.day, time: s.time }))
      } else if (Array.isArray(saved.times)) {
        // Ancienne forme : `times: ['20:08']` = tous les jours à ces heures
        const times = saved.times.filter((t: any) => typeof t === 'string' && t.trim())
        weeklySlots = times.flatMap((t: string) => DAYS.map(d => ({ day: d, time: t })))
      }
    }
    return { mode, intervalleMinutes, timezone, weeklySlots }
  }
  function load() {
    hydrating.value = true
    const raw = localStorage.getItem('labo-config-v2')
    if (raw) {
      try {
        const o = JSON.parse(raw)
        if (o && typeof o === 'object') {
          atelier.value = normalizeAtelier(o.atelier)
          positions.value = isObj(o.positions) ? o.positions : {}
          sources.value = normalizeSources(o.sources)
          filtres.value = pick(filtres.value, o.filtres)
          ecriture.value = pickEcriture(ecriture.value, o.ecriture)
          formats.value = normalizeFormats(o.formats)
          partage.value = pick(partage.value, o.partage)
          planning.value = normalizePlanning(o.planning)
          media.value = pick(media.value, o.media)
          video.value = pick(video.value, o.video)
          systeme.value = pick(systeme.value, o.systeme)
          matrix.value = normalizeMatrix(o.matrix)
          modelRegistry.value = normalizeRegistry(o.modelRegistry)
        }
      } catch { /* config illisible → on garde les défauts, pas de page blanche */ }
    }
    hydrating.value = false
    normalizeModelFields()
    baseline = stateSnapshot()
    persistLocal() // réécrit la config normalisée → le localStorage est guéri pour la suite
  }
  load()

  function persistLocal() {
    // Note : les secrets ne sont jamais écrits ici — uniquement .secrets.yaml via le daemon.
    localStorage.setItem('labo-config-v2', JSON.stringify({
      atelier: atelier.value, positions: positions.value,
      sources: sources.value, filtres: filtres.value,
      ecriture: ecriture.value, formats: formats.value, partage: partage.value,
      planning: planning.value, media: media.value, video: video.value,
      systeme: systeme.value, matrix: matrix.value, modelRegistry: modelRegistry.value,
    }))
  }

  // Sauvegarde complète : localStorage (backup local) + config.yaml + secrets via le daemon.
  async function save() {
    saveState.value = 'saving'
    dirty.value = false
    persistLocal()
    await pushToDaemon()
    await pushSecretsToDaemon()
    lastSavedAt.value = new Date()
    if (apiError.value) {
      // Daemon injoignable : rien n'est perdu (localStorage OK), la config.yaml
      // sera rattrapée automatiquement dès que le daemon répond.
      configPending.value = true
      saveState.value = 'error'
    } else {
      configPending.value = false
      saveState.value = 'saved'
    }
  }

  // Rattrapage automatique : tant qu'une sauvegarde est en attente, on retente
  // un push toutes les 15 s — dès que le daemon revient, la config.yaml est à jour.
  setInterval(async () => {
    if (!configPending.value) return
    await pushToDaemon()
    if (!apiError.value) {
      configPending.value = false
      lastSavedAt.value = new Date()
      saveState.value = 'saved'
    }
  }, 15_000)

  // Pousse la config vers le daemon → écrit daemon/config/config.yaml.
  async function pushToDaemon() {
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toYamlConfig()),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await res.json()
      apiOk.value = true
      apiError.value = null
    } catch (e: any) {
      apiOk.value = false
      apiError.value = e?.message || String(e)
      console.warn('[labo] config non envoyée au daemon :', apiError.value)
    }
  }

  // ── Secrets plateformes → daemon/config/.secrets.yaml (jamais dans git) ──
  async function loadSecretsFromDaemon() {
    try {
      const res = await fetch('/api/secrets')
      if (!res.ok) return
      const y = await res.json()
      if (isObj(y) && isObj(y.publisher)) {
        const s = y.publisher
        for (const k of Object.keys(secrets.value)) if (typeof s[k] === 'string') (secrets.value as any)[k] = s[k]
      }
    } catch { /* daemon down → champs secrets vides */ }
  }
  async function pushSecretsToDaemon() {
    try {
      const res = await fetch('/api/secrets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publisher: secrets.value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await res.json()
    } catch (e: any) {
      console.warn('[labo] secrets non envoyés au daemon :', e?.message || e)
    }
  }

  // Au démarrage : si le daemon répond, sa config.yaml fait foi sur le localStorage.
  async function loadFromDaemon() {
    hydrating.value = true
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const y = await res.json()
      applyFromYaml(y)
      apiOk.value = true
      apiError.value = null
    } catch (e: any) {
      apiOk.value = false
      apiError.value = e?.message || String(e)
    }
    hydrating.value = false
    normalizeModelFields()
    baseline = stateSnapshot()
    persistLocal()
    await loadSecretsFromDaemon()
    await loadSourceHealth()
  }
  loadFromDaemon()

  // Autosave debouncé : toute modification d'une vue déclenche la sauvegarde
  // (localStorage + config.yaml via le daemon) sans bouton à cliquer.
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(dirty, (d) => {
    if (!d) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { save() }, 600)
  })

  // Watcher profond : rattrape les v-model directs qui n'appellent pas
  // markDirty() — TOUT changement d'état est détecté et marqué à sauver,
  // donc rien ne se perd même sans bouton « Enregistrer ».
  watch([atelier, positions, sources, filtres, ecriture, formats, partage, planning, media, video, systeme, matrix, modelRegistry], () => {
    if (hydrating.value) return
    const s = stateSnapshot()
    if (s !== baseline) {
      baseline = s
      dirty.value = true
    }
  }, { deep: true })
  baseline = stateSnapshot()

  return {
    atelier, positions, sources, filtres, ecriture, formats,
    partage, planning, media, video, systeme, matrix, modelRegistry, secrets,
    sourceHealth, dirty, markDirty, save, saveState, lastSavedAt, apiOk, apiError, loadFromDaemon,
    pushSecretsToDaemon, loadSourceHealth, configPending,
  }
})

export { DAYS }
