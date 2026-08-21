import { defineStore } from 'pinia'
import { ref } from 'vue'

// Store labo — valeurs par défaut = la VRAIE config qui tournait sur le VPS
// (radar.db 04/08/2026, voir docs/labo-bases-saines.md + daemon/config/config.yaml)

export interface WeeklySlot { day: string; time: string } // ex { day:'LUN', time:'20:08' }
export interface FormatItem { id: string; nom: string; actif: boolean; couleur: string; consigne: string }
export interface SourceItem {
  id: string
  url: string
  trust: 'high' | 'medium' | 'low'
  active: boolean
}

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
  return DEFAULT_RSS.map(url => ({ id: uid(), url, trust: detectTrust(url), active: true }))
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
    webSearchEnabled: true,
    consigneTri: '',
    criteresRejet: '',
    identite: '',
    mission: '',
    vocabulaire: '',
    consignesImages: '',
    consigneGlobale: '',
  })

  // ── Formats ──
  const formats = ref<FormatItem[]>([
    { id: 'ALERTE_INFO', nom: '🔴 ALERTE INFO !', actif: true, couleur: '#DC2626', consigne: '' },
    { id: 'FAIT_DU_JOUR', nom: '📌 LE FAIT DU JOUR', actif: false, couleur: '#111111', consigne: '' },
    { id: 'DECRYPTAGE', nom: '🔎 DÉCRYPTAGE', actif: false, couleur: '#7c3aed', consigne: '' },
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
    discordTestMode: true,
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

  function save() {
    dirty.value = false
    localStorage.setItem('labo-config-v2', JSON.stringify({
      atelier: atelier.value, positions: positions.value,
      sources: sources.value, filtres: filtres.value,
      ecriture: ecriture.value, formats: formats.value, partage: partage.value,
      planning: planning.value, media: media.value, video: video.value,
      systeme: systeme.value,
    }))
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
            active: s.active !== false,
          }))
      } else if (typeof saved.rss === 'string' && saved.rss.trim()) {
        // Migration v1 → v2 : l'ancienne clé `rss` (textarea) devient la liste structurée
        out.list = saved.rss.split('\n').map((u: string) => u.trim()).filter(Boolean)
          .map((url: string) => ({ id: uid(), url, trust: detectTrust(url), active: true }))
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
      save() // réécrit la config normalisée → le localStorage est guéri pour la suite
    } catch { /* config illisible → on garde les défauts, pas de page blanche */ }
  }
  load()

  return {
    atelier, positions, sources, filtres, ecriture, formats,
    partage, planning, media, video, systeme,
    dirty, markDirty, save,
  }
})

export { DAYS }
