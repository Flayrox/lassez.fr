import { defineStore } from 'pinia'
import { ref } from 'vue'

// Store labo — valeurs par défaut = la VRAIE config qui tournait sur le VPS
// (radar.db 04/08/2026, voir docs/labo-bases-saines.md + daemon/config/config.yaml)

export interface WeeklySlot { day: string; time: string } // ex { day:'LUN', time:'20:08' }
export interface FormatItem { id: string; nom: string; actif: boolean; couleur: string; consigne: string }

const DAYS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']

export const useConfigStore = defineStore('config', () => {
  // ── Atelier (chaîne de fabrication) ──
  const atelier = ref([
    { type: 'ingestion', label: 'Collecte', enabled: true, desc: 'On récupère les nouveaux articles', order: 1 },
    { type: 'dedup', label: 'Anti-doublons', enabled: true, desc: 'Similarité 65%, fenêtre 10 h', order: 2 },
    { type: 'research', label: 'Tri', enabled: true, desc: 'Gemini Flash note 0–100', order: 3 },
    { type: 'editor', label: 'Rédaction', enabled: true, desc: 'Gemini Pro écrit l’enquête', order: 4 },
    { type: 'validator', label: 'Vérification', enabled: true, desc: 'Auto-pilote désactivé pour l’instant', order: 5 },
    { type: 'media', label: 'Image', enabled: true, desc: 'Overlay 50%, box 78%', order: 6 },
  ])

  // ── Sources (les 11 flux RSS réellement actifs + comptes X via bridge) ──
  const sources = ref({
    rss: [
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
    ].join('\n'),
    telegram: '',
    xAccounts: ['JLMelenchon', 'MathildePanot', 'RimaHas', 'Manuel_Bompard', 'FranceInsoumise', 'ImpactMediaFR'].join('\n'),
    googleNews: '',
    lookbackHours: 10,
    maxArticlesPerScan: 20,
    concurrency: 5,
  })

  // ── Filtres (valeurs réelles) ──
  const filtres = ref({
    motsCles: '',
    motsInterdits: '',
    seuilRessemblance: 65,       // dedup_similarity_threshold
    fenetreDoublonsHeures: 10,   // dedup_recent_hours
    imagesAutorisees: true,
  })

  // ── Écriture (prompts vides dans la DB → fallback code ; modèles réels) ──
  const ecriture = ref({
    modeleRapide: 'gemini-3-flash-preview',
    modeleRedaction: 'gemini-2.5-pro',
    modeleVerification: 'gemini-3-flash-preview',
    tachesEnMemeTempsRapide: 5,
    tachesEnMemeTempsRedaction: 3,
    scoreMini: 50,
    webSearchEnabled: true,      // google_search_*_enabled x3
    consigneTri: '',
    criteresRejet: '',
    identite: '',
    mission: '',
    vocabulaire: '',
    consignesImages: '',
    consigneGlobale: '',         // customPromptModifier
  })

  // ── Formats (types d’ouverture réellement utilisés) ──
  const formats = ref<FormatItem[]>([
    { id: 'ALERTE_INFO', nom: '🔴 ALERTE INFO !', actif: true, couleur: '#DC2626', consigne: '' },
    { id: 'FAIT_DU_JOUR', nom: '📌 LE FAIT DU JOUR', actif: false, couleur: '#111111', consigne: '' },
    { id: 'DECRYPTAGE', nom: '🔎 DÉCRYPTAGE', actif: false, couleur: '#7c3aed', consigne: '' },
  ])

  // ── Partage (réel : Discord seul + test mode, pilote auto OFF) ──
  const partage = ref({
    discord: true,
    qoe: true,
    x: false,
    bluesky: false,
    mastodon: false,
    discordMode: 'DIRECT' as 'DIRECT' | 'SCHEDULED',
    qoeMode: 'DIRECT' as 'DIRECT' | 'SCHEDULED',
    delaiMini: 1,   // min_delay_min
    delaiMaxi: 2,   // max_delay_min
    auto: false,    // auto_pilot_enabled = false
    discordTestMode: true,
  })

  // ── Planning (calendrier réel : tous les jours à 20:08, Europe/Paris) ──
  const planning = ref({
    mode: 'calendar' as 'pulse' | 'calendar' | 'hybrid',
    intervalleMinutes: 6,        // scan_interval_hours = 0.1 h
    timezone: 'Europe/Paris',
    weeklySlots: DAYS.map(d => ({ day: d, time: '20:08' })) as WeeklySlot[],
  })

  // ── Système ──
  const systeme = ref({
    niveauLogs: 'INFO',
    garderLogsJours: 7,
    miroirLogs: true,
    maintenanceMode: false,
    maintenanceMessage: 'L’Assez fait peau neuve. Nous revenons dans quelques instants.',
  })

  const dirty = ref(false)
  function markDirty() { dirty.value = true }

  function save() {
    dirty.value = false
    localStorage.setItem('labo-config-v2', JSON.stringify({
      atelier: atelier.value, sources: sources.value, filtres: filtres.value,
      ecriture: ecriture.value, formats: formats.value, partage: partage.value,
      planning: planning.value, systeme: systeme.value,
    }))
  }
  function load() {
    const raw = localStorage.getItem('labo-config-v2')
    if (raw) {
      try {
        const o = JSON.parse(raw)
        atelier.value = o.atelier ?? atelier.value
        sources.value = o.sources ?? sources.value
        filtres.value = o.filtres ?? filtres.value
        ecriture.value = o.ecriture ?? ecriture.value
        formats.value = o.formats ?? formats.value
        partage.value = o.partage ?? partage.value
        planning.value = o.planning ?? planning.value
        systeme.value = o.systeme ?? systeme.value
      } catch {}
    }
  }
  load()

  return { atelier, sources, filtres, ecriture, formats, partage, planning, systeme, dirty, markDirty, save }
})

export { DAYS }
