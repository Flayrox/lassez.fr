import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// Store labo — valeurs par défaut = la VRAIE config qui tournait sur le VPS
// (radar.db 04/08/2026, voir docs/labo-bases-saines.md + daemon/config/config.yaml)

export interface WeeklySlot { day: string; time: string } // ex { day:'LUN', time:'20:08' }
export interface FormatItem { id: string; nom: string; actif: boolean; couleur: string; consigne: string }
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
    modeleRapide: 'gemini-3-flash-preview',
    modeleRedaction: 'gemini-2.5-pro',
    modeleVerification: 'gemini-3-flash-preview',
    tachesEnMemeTempsRapide: 5,
    tachesEnMemeTempsRedaction: 3,
    scoreMini: 50,
    // Recherche web PAR TYPE d'article (google_search_*_enabled de l'ancienne DB)
    webSearchBreaking: true,
    webSearchStandard: true,
    webSearchDecrypt: true,
    // Modèle par type d'article (ai_model_main/breaking/standard/decrypt)
    modeleAlerte: 'gemini-3.1-pro-preview',
    modeleStandard: 'gemini-2.5-flash',
    modeleDecryptage: 'gemini-2.5-pro',
    // Le grand prompt éditorial (ai_prompt) — la ligne éditoriale complète
    promptEditorial: '',
    consigneTri: '',
    criteresRejet: '',
    identite: '',
    mission: '',
    vocabulaire: '',
    consignesImages: '',
    consigneGlobale: '',
  })

  // ── Registry des modèles IA (label UI + value API) — alimente tous les selects ──
  const modelRegistry = ref<{ label: string; value: string }[]>([
    { label: 'Gemini 3.1 Pro (le plus fort)', value: 'gemini-3.1-pro-preview' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 3 Flash (rapide)', value: 'gemini-3-flash-preview' },
    { label: 'Gemini 2.0 Flash (léger)', value: 'gemini-2.0-flash' },
  ])
  function normalizeRegistry(saved: unknown) {
    if (!Array.isArray(saved)) return modelRegistry.value
    const out = saved.filter((m: any) => m && typeof m.label === 'string' && typeof m.value === 'string')
      .map((m: any) => ({ label: m.label, value: m.value }))
    return out.length ? out : modelRegistry.value
  }

  // ── Formats (4 tags obligatoires du prompt éditorial) ──
  const formats = ref<FormatItem[]>([
    { id: 'ALERTE_INFO', nom: '🔴 ALERTE INFO !', actif: true, couleur: '#DC2626', consigne: '' },
    { id: 'FAIT_DU_JOUR', nom: '📌 LE FAIT DU JOUR', actif: false, couleur: '#111111', consigne: '' },
    { id: 'DECRYPTAGE', nom: '🔎 DÉCRYPTAGE', actif: false, couleur: '#7c3aed', consigne: '' },
    { id: 'A_VENIR', nom: '🗓️ À VENIR', actif: false, couleur: '#2563eb', consigne: '' },
  ])

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
    discordTestMode: true,
  })

  // ── Secrets plateformes — JAMAIS dans localStorage, ni dans config.yaml versionné.
  // Écrits dans daemon/config/.secrets.yaml (gitignoré) via /api/secrets.
  const secrets = ref({
    discordWebhookUrl: '',
    xApiKey: '', xApiSecret: '', xAccessToken: '', xAccessSecret: '',
    blueskyIdentifier: '', blueskyAppPassword: '',
    mastodonInstanceUrl: '', mastodonAccessToken: '',
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
  // editorial.modelByType est soit un objet {alerte, standard, decrypt}, soit la valeur directe
  const modelByType = (editorial: any, slot: string) => {
    if (!editorial) return ''
    if (typeof editorial === 'string') return editorial
    if (isObj(editorial.modelByType)) return editorial.modelByType[slot]
    return ''
  }

  // Le store → structure imbriquée de config.yaml (sections gérées par le labo)
  function toYamlConfig(): Record<string, any> {
    const targetsByType: Record<string, Record<string, boolean>> = {}
    for (const f of formats.value) {
      const m = matrix.value[f.id] ?? {}
      targetsByType[f.nom] = {
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
        sources: {
          rss: sources.value.list.filter(s => s.active).map(s => s.url),
          telegram: lines(sources.value.telegram),
          xAccounts: lines(sources.value.xAccounts),
          googleNews: lines(sources.value.googleNews),
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
        aiModelFlash: ecriture.value.modeleRapide,
        aiModelDecrypt: ecriture.value.modeleRedaction,
        maxConcurrentTasks: ecriture.value.tachesEnMemeTempsRapide,
        scoreThreshold: ecriture.value.scoreMini,
        googleSearchBreaking: ecriture.value.webSearchBreaking,
        googleSearchStandard: ecriture.value.webSearchStandard,
        googleSearchDecrypt: ecriture.value.webSearchDecrypt,
        webSearchEnabled: ecriture.value.webSearchBreaking || ecriture.value.webSearchStandard || ecriture.value.webSearchDecrypt,
        systemPrompt: ecriture.value.consigneTri,
        rejectCriteria: ecriture.value.criteresRejet,
        customPromptModifier: ecriture.value.consigneGlobale,
      },
      editorial: {
        aiModelPro: ecriture.value.modeleRedaction,
        aiModelVerification: ecriture.value.modeleVerification,
        maxConcurrentTasks: ecriture.value.tachesEnMemeTempsRedaction,
        aiPrompt: ecriture.value.promptEditorial,
        modelByType: {
          alerte: ecriture.value.modeleAlerte,
          standard: ecriture.value.modeleStandard,
          decrypt: ecriture.value.modeleDecryptage,
        },
        baseIdentity: ecriture.value.identite,
        researchMission: ecriture.value.mission,
        vocabularyRules: ecriture.value.vocabulaire,
        imageRules: ecriture.value.consignesImages,
        customModifier: ecriture.value.consigneGlobale,
      },
      modelRegistry: modelRegistry.value,
      formats: formats.value.map(f => ({ id: f.id, nom: f.nom, actif: f.actif, couleur: f.couleur, consigne: f.consigne })),
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
        prefilterModel: video.value.prefilterModel,
        transcribeModel: video.value.transcribeModel,
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
      webSearchEnabled: boolOr(research.webSearchEnabled, ecriture.value.webSearchEnabled),
      consigneTri: sOr(research.systemPrompt, ecriture.value.consigneTri),
      criteresRejet: sOr(research.rejectCriteria, ecriture.value.criteresRejet),
      identite: sOr(editorial.baseIdentity, ecriture.value.identite),
      mission: sOr(editorial.researchMission, ecriture.value.mission),
      vocabulaire: sOr(editorial.vocabularyRules, ecriture.value.vocabulaire),
      consignesImages: sOr(editorial.imageRules, ecriture.value.consignesImages),
      consigneGlobale: sOr(editorial.customModifier, sOr(research.customPromptModifier, ecriture.value.consigneGlobale)),
      // Recherche web par type + modèles par type + grand prompt éditorial
      webSearchBreaking: boolOr(research.googleSearchBreaking, boolOr(research.webSearchEnabled, ecriture.value.webSearchBreaking)),
      webSearchStandard: boolOr(research.googleSearchStandard, boolOr(research.webSearchEnabled, ecriture.value.webSearchStandard)),
      webSearchDecrypt: boolOr(research.googleSearchDecrypt, boolOr(research.webSearchEnabled, ecriture.value.webSearchDecrypt)),
      modeleAlerte: sOr(modelByType(editorial, 'alerte'), sOr(research.aiModelDecrypt, ecriture.value.modeleAlerte)),
      modeleStandard: sOr(modelByType(editorial, 'standard'), sOr(research.aiModelFlash, ecriture.value.modeleStandard)),
      modeleDecryptage: sOr(modelByType(editorial, 'decrypt'), sOr(research.aiModelDecrypt, ecriture.value.modeleDecryptage)),
      promptEditorial: sOr(editorial.aiPrompt, ecriture.value.promptEditorial),
    }
    if (Array.isArray(y.modelRegistry) && y.modelRegistry.length > 0) {
      modelRegistry.value = normalizeRegistry(y.modelRegistry)
    }

    // Formats
    if (Array.isArray(y.formats) && y.formats.length > 0) {
      formats.value = y.formats
        .filter((f: any) => f && typeof f.id === 'string')
        .map((f: any) => ({
          id: f.id,
          nom: typeof f.nom === 'string' ? f.nom : 'Format',
          actif: f.actif !== false,
          couleur: typeof f.couleur === 'string' ? f.couleur : '#3ecf8e',
          consigne: typeof f.consigne === 'string' ? f.consigne : '',
        }))
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
    }
    if (isObj(pub.targetsByType)) {
      matrix.value = defaultMatrix()
      for (const f of formats.value) {
        const t = pub.targetsByType[f.nom]
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
  function normalizeFormats(saved: unknown) {
    if (!Array.isArray(saved)) return formats.value
    return saved
      .filter((f: any) => f && typeof f.id === 'string')
      .map((f: any) => ({
        id: f.id,
        nom: typeof f.nom === 'string' ? f.nom : 'Format',
        actif: f.actif !== false,
        couleur: typeof f.couleur === 'string' ? f.couleur : '#3ecf8e',
        consigne: typeof f.consigne === 'string' ? f.consigne : '',
      }))
  }
  function normalizeSources(saved: unknown) {
    const def = sources.value
    const out: any = { ...def }
    if (isObj(saved)) {
      for (const k of ['telegram', 'xAccounts', 'googleNews', 'lookbackHours', 'maxArticlesPerScan', 'concurrency', 'bridgeUrl'])
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
    const raw = localStorage.getItem('labo-config-v2')
    if (!raw) return
    try {
      const o = JSON.parse(raw)
      if (!o || typeof o !== 'object') return
      atelier.value = normalizeAtelier(o.atelier)
      positions.value = isObj(o.positions) ? o.positions : {}
      sources.value = normalizeSources(o.sources)
      filtres.value = pick(filtres.value, o.filtres)
      ecriture.value = pick(ecriture.value, o.ecriture)
      formats.value = normalizeFormats(o.formats)
      partage.value = pick(partage.value, o.partage)
      planning.value = normalizePlanning(o.planning)
      media.value = pick(media.value, o.media)
      video.value = pick(video.value, o.video)
      systeme.value = pick(systeme.value, o.systeme)
      matrix.value = normalizeMatrix(o.matrix)
      modelRegistry.value = normalizeRegistry(o.modelRegistry)
      persistLocal() // réécrit la config normalisée → le localStorage est guéri pour la suite
    } catch { /* config illisible → on garde les défauts, pas de page blanche */ }
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
    dirty.value = false
    persistLocal()
    await pushToDaemon()
    await pushSecretsToDaemon()
  }

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
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const y = await res.json()
      applyFromYaml(y)
      apiOk.value = true
      apiError.value = null
      persistLocal()
    } catch (e: any) {
      apiOk.value = false
      apiError.value = e?.message || String(e)
    }
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

  return {
    atelier, positions, sources, filtres, ecriture, formats,
    partage, planning, media, video, systeme, matrix, modelRegistry, secrets,
    sourceHealth, dirty, markDirty, save, apiOk, apiError, loadFromDaemon,
    pushSecretsToDaemon, loadSourceHealth,
  }
})

export { DAYS }
