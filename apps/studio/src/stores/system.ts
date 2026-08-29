import { defineStore } from 'pinia'
import { ref } from 'vue'

// Santé du système — télémétrie réelle du daemon (GET /api/system-health) :
// état de chaque brique du pipeline + infos daemon + compteurs réels.

export interface Brick {
  type: string
  label: string
  status: 'idle' | 'ok' | 'warning' | 'danger'
  lastRun?: string
  durationMs?: number
  lastError?: string
  errors?: number
}

export interface DaemonInfo {
  startedAt?: string
  uptimeSeconds: number
  lastCycleAt?: string
  lastCycleDurationMs?: number
  lastCycleError?: string
  cycleCount: number
  qoeMock: boolean
  qoePublicationId?: string
}

export interface CycleStep {
  type: string
  label: string
  status: 'ok' | 'error' | 'skipped'
  durationMs?: number
  error?: string
  detail?: string
}

export interface Cycle {
  id: number
  started_at: string
  ended_at?: string
  durationMs: number
  source: 'pipeline' | 'publisher'
  error?: string
  steps: CycleStep[]
}

export interface LogEntry {
  ts: string
  level: string
  node: string
  message: string
}

export const useSystemStore = defineStore('system', () => {
  const bricks = ref<Brick[]>([])
  const daemon = ref<DaemonInfo | null>(null)
  const counts = ref<Record<string, number>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const scanning = ref(false)
  const scanDone = ref(false)
  // Historique des cycles (mode « Suivi ») + journal du daemon (panneau logs).
  const cycles = ref<Cycle[]>([])
  const logs = ref<LogEntry[]>([])

  async function fetchHealth() {
    loading.value = true
    try {
      const res = await fetch('/api/system-health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const y = await res.json()
      bricks.value = y?.data?.bricks ?? []
      daemon.value = y?.data?.daemon ?? null
      counts.value = y?.data?.counts ?? {}
      error.value = null
    } catch (e: any) {
      error.value = e?.message || String(e)
      daemon.value = null
      bricks.value = []
    } finally {
      loading.value = false
    }
  }

  async function triggerScan() {
    scanning.value = true
    scanDone.value = false
    try {
      const res = await fetch('/api/scan', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      scanDone.value = true
    } catch (e: any) {
      error.value = e?.message || String(e)
    } finally {
      scanning.value = false
    }
  }

  async function fetchCycles() {
    try {
      const res = await fetch('/api/cycles?limit=12')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const y = await res.json()
      cycles.value = y?.data ?? []
    } catch { /* daemon down → historique vide */ }
  }

  async function fetchLogs() {
    try {
      const res = await fetch('/api/logs?limit=150')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const y = await res.json()
      logs.value = y?.data ?? []
    } catch { /* daemon down → journal vide */ }
  }

  return { bricks, daemon, counts, loading, error, scanning, scanDone, cycles, logs, fetchHealth, triggerScan, fetchCycles, fetchLogs }
})
