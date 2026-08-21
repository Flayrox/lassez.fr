import { defineStore } from 'pinia'
import { ref } from 'vue'

// Store complet — reprend les 82 clés radar_settings mais avec des mots simples
// Plus de "pipelineGraphJson" ou "dedupLookbackHours" brut, tout est rangé par usage réel
export const useConfigStore = defineStore('config', () => {
  // 1. Chaîne de fabrication (6 étapes) — ex-pipelineGraphJson
  const atelier = ref([
    { type: 'ingestion', label: 'Collecte', enabled: true, desc: 'On récupère les nouveaux articles (RSS / Telegram)', order: 1 },
    { type: 'dedup', label: 'Anti-doublons', enabled: true, desc: 'On enlève les articles déjà vus', order: 2 },
    { type: 'research', label: 'Tri', enabled: true, desc: 'L’IA note l’intérêt du sujet (0-100)', order: 3 },
    { type: 'editor', label: 'Rédaction', enabled: true, desc: 'L’IA écrit le brouillon d’enquête', order: 4 },
    { type: 'validator', label: 'Vérification', enabled: true, desc: 'On vérifie les faits avant publication', order: 5 },
    { type: 'media', label: 'Image', enabled: true, desc: 'On ajoute une illustration', order: 6 },
  ])

  // 2. D'où viennent les infos
  const sources = ref({
    rss: `https://www.lemonde.fr/rss/une.xml
https://www.mediapart.fr/articles/feed
https://www.francetvinfo.fr/titres.rss
https://www.humanite.fr/rss
https://www.la-croix.com/RSS
https://www.blast-info.fr/rss.xml`,
    telegram: `brevesdepresse
AlertesInfos
mediavenir`,
    googleNews: ``,
    lookbackHours: 10, // regarder X heures en arrière
    concurrency: 5, // combien de flux en même temps
  })

  // 3. Ce qu'on garde ou pas
  const filtres = ref({
    motsCles: 'écologie, social, politique', // keywords
    motsInterdits: 'crypto, sport', // bannedKeywords
    seuilRessemblance: 45, // 0-100% (0.45)
    fenetreDoublonsHeures: 48, // dedupLookbackHours
    imagesAutorisees: true, // allowSourceImages
  })

  // 4. Comment l'IA écrit
  const ecriture = ref({
    modeleRapide: 'gemini-3-flash-preview', // aiModelFlash
    modeleRedaction: 'gemini-3.1-pro-preview', // aiModelPro
    modeleVerification: 'gemini-3-flash-preview', // aiModelValidator
    tachesEnMemeTempsRapide: 5,
    tachesEnMemeTempsRedaction: 3,
    scoreMini: 50, // sur 100 pour garder le sujet
    consigneTri: 'Tu es rédacteur en chef d’investigation. Trie la valeur journalistique.',
    criteresRejet: 'Rejeter faits divers mineurs, pub déguisée.',
    identite: 'Tu es rédacteur en chef de L’Assez. Style percutant, sans langue de bois.',
    mission: 'Transformer le brut en enquête étayée.',
    vocabulaire: 'Vocabulaire précis, incisif, factuel.',
    consignesImages: 'Mots-clés d’illustration sobres et évocateurs.',
    consigneGlobale: '', // customPromptModifier
  })

  // 5. Formats d'articles (ex-taxonomyTemplates)
  const formats = ref([
    { id: 'alerte', nom: '🔴 Alerte', actif: true, consigne: 'Format alerte brève', couleur: '#DC2626' },
    { id: 'decryptage', nom: '🔎 Décryptage', actif: true, consigne: 'Format analyse posée', couleur: '#7c3aed' },
  ])

  // 6. Où on publie
  const partage = ref({
    discord: true,
    qoe: true,
    x: false,
    bluesky: false,
    mastodon: false,
    discordMode: 'DIRECT' as 'DIRECT'|'SCHEDULED',
    qoeMode: 'DIRECT' as 'DIRECT'|'SCHEDULED',
    delaiMini: 60,
    delaiMaxi: 120,
    auto: true, // enableAutoPublish
  })

  // 7. Quand on publie
  const planning = ref({
    mode: 'hybrid' as 'pulse'|'calendar'|'hybrid',
    intervalleMinutes: 60,
    heures: '08:00, 18:00',
  })

  // 8. Santé (logs)
  const systeme = ref({
    niveauLogs: 'INFO' as 'DEBUG'|'INFO'|'WARN'|'ERROR',
    garderLogsJours: 7,
    miroirLogs: true,
  })

  const dirty = ref(false)
  function markDirty(){ dirty.value = true }
  function save(){
    dirty.value = false
    localStorage.setItem('labo-config', JSON.stringify({
      atelier: atelier.value, sources: sources.value, filtres: filtres.value,
      ecriture: ecriture.value, formats: formats.value, partage: partage.value,
      planning: planning.value, systeme: systeme.value
    }))
  }
  function load(){
    const raw = localStorage.getItem('labo-config')
    if(raw){ try{
      const o=JSON.parse(raw)
      atelier.value=o.atelier??atelier.value; sources.value=o.sources??sources.value
      filtres.value=o.filtres??filtres.value; ecriture.value=o.ecriture??ecriture.value
      formats.value=o.formats??formats.value; partage.value=o.partage??partage.value
      planning.value=o.planning??planning.value; systeme.value=o.systeme??systeme.value
    }catch{} }
  }
  load()
  return { atelier, sources, filtres, ecriture, formats, partage, planning, systeme, dirty, markDirty, save }
})
