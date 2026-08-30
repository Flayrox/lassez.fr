import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useConfigStore, type PipelineInfo, type WeeklySlot } from './config'
import { pipelineApiBase } from '../lib/api'

// État partagé multi-pipelines : planning (mode/interval/créneaux) et
// publications de CHAQUE instance du registre. Consommé par la page Calendrier
// (accueil) et le picker de pipelines de la topbar — une seule source, un seul
// rafraîchissement.

export interface PipelineSchedule {
  mode: 'hybrid' | 'pulse' | 'calendar'
  intervalleMinutes: number
  weeklySlots: WeeklySlot[]
}

const DAY_INDEX: Record<string, number> = { DIM: 0, LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6 }

export const usePipelinesStore = defineStore('pipelines', () => {
  const cfg = useConfigStore()
  const schedules = ref<Record<string, PipelineSchedule>>({})
  const publications = ref<any[]>([])
  const lastRefresh = ref(0)
  const refreshing = ref(false)
  // Instances dont un scan manuel est en cours (Spinner sur les pills du calendrier).
  const scanning = ref<Set<string>>(new Set())

  const sched = (p: PipelineInfo) => schedules.value[p.id]

  function slotCount(p: PipelineInfo) {
    return sched(p)?.weeklySlots?.length ?? 0
  }

  // ── Chargement : config + publications de chaque instance ──
  async function refresh(force = false) {
    if (refreshing.value) return
    if (!force && Date.now() - lastRefresh.value < 10_000) return
    refreshing.value = true
    try {
      const scheds: Record<string, PipelineSchedule> = {}
      const pubs: any[] = []
      await Promise.all(cfg.pipelines.map(async (p) => {
        const base = pipelineApiBase(p.port)
        try {
          const [cfgRes, pubRes] = await Promise.all([
            fetch(base + '/api/config'),
            fetch(base + '/api/publications?limit=200'),
          ])
          if (cfgRes.ok) {
            const y = await cfgRes.json()
            const sc = y?.scheduling ?? {}
            scheds[p.id] = {
              mode: sc.mode === 'pulse' || sc.mode === 'calendar' || sc.mode === 'hybrid' ? sc.mode : 'hybrid',
              intervalleMinutes: typeof sc.scrapingIntervalMinutes === 'number' ? sc.scrapingIntervalMinutes : 60,
              weeklySlots: Array.isArray(sc.weeklySlots) ? sc.weeklySlots : [],
            }
          }
          if (pubRes.ok) {
            const py = await pubRes.json()
            if (Array.isArray(py?.data)) {
              for (const pub of py.data) pubs.push({ ...pub, pipelineId: p.id, pipelineName: p.name, pipelineColor: p.color })
            }
          }
        } catch { /* instance injoignable → on passe */ }
      }))
      schedules.value = scheds
      publications.value = pubs
      lastRefresh.value = Date.now()
    } finally {
      refreshing.value = false
    }
  }

  // ── Prochain passage, libellé humain (pour pills + picker) ──
  function nextRunLabel(p: PipelineInfo): string {
    const s = schedules.value[p.id]
    if (!s) return '…'
    if (s.mode === 'pulse') return `↻ toutes les ${s.intervalleMinutes} min`
    const slots = s.weeklySlots ?? []
    if (!slots.length) return s.mode === 'hybrid' ? `↻ toutes les ${s.intervalleMinutes} min` : 'aucun créneau'
    const now = new Date()
    const nowDay = now.getDay()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    let best: { mins: number; day: string; time: string } | null = null
    for (const sl of slots) {
      const [h, m] = String(sl.time ?? '').split(':').map(Number)
      if (Number.isNaN(h) || Number.isNaN(m)) continue
      const dayIdx = DAY_INDEX[sl.day] ?? 0
      let diff = (dayIdx - nowDay + 7) % 7
      if (diff === 0 && h * 60 + m <= nowMin) diff = 7
      const mins = diff * 24 * 60 + (h * 60 + m) - nowMin
      if (!best || mins < best.mins) best = { mins, day: sl.day, time: sl.time }
    }
    if (!best) return '—'
    const when = best.mins < 24 * 60 ? `aujourd'hui ${best.time}` : `${best.day.toLowerCase()} ${best.time}`
    const h = Math.floor(best.mins / 60)
    const m = best.mins % 60
    const dans = h >= 24 ? `dans ${Math.floor(h / 24)} j` : h > 0 ? `dans ${h} h${m ? ` ${m} min` : ''}` : `dans ${m} min`
    return `${when} · ${dans}`
  }

  // ── Scan manuel sur une instance précise ──
  async function scan(p: PipelineInfo) {
    scanning.value = new Set(scanning.value).add(p.id)
    try {
      await fetch(pipelineApiBase(p.port) + '/api/scan', { method: 'POST' })
    } catch { /* instance injoignable */ }
    // Le cycle tourne en arrière-plan : on rafraîchit tôt puis un peu après.
    setTimeout(() => { refresh(true) }, 2500)
    setTimeout(() => { refresh(true) }, 9000)
    setTimeout(() => {
      const next = new Set(scanning.value)
      next.delete(p.id)
      scanning.value = next
    }, 8000)
  }

  return { schedules, publications, lastRefresh, refreshing, sched, slotCount, refresh, nextRunLabel, scan, scanning }
})
