import { defineStore } from 'pinia'
import { ref } from 'vue'

// Signaux — données réelles depuis l'API du daemon Go (:2506, proxifiée en dev).
export interface Signal {
  id: number
  source_title: string
  flash_content: string
  source_url: string
  status: string
  geo: 'france' | 'international'
  type_ouverture: string
  fiabilite: string
  tags: string
  created_at: string
}

export const useSignalsStore = defineStore('signals', () => {
  const all = ref<Signal[]>([])
  const counts = ref<Record<string, number>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSignals(status = tabToStatus('PENDING'), geo = 'all', q = '') {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams({ status, geo })
      if (q.trim()) params.set('q', q.trim())
      params.set('limit', '100')
      const res = await fetch(`/api/signals?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      all.value = json.data ?? []
      counts.value = json.counts ?? {}
    } catch (e: any) {
      error.value = e.message
      all.value = []
    } finally {
      loading.value = false
    }
  }

  async function bulkUpdate(ids: number[], status: string) {
    await fetch('/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status }),
    })
  }
  async function remove(ids: number[]) {
    await fetch('/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, delete: true }),
    })
  }

  return { all, counts, loading, error, fetchSignals, bulkUpdate, remove }
})

// Le labo affiche des tabs "humains", l'API attend les statuts SQLite
function tabToStatus(tab: string): string {
  return tab // mêmes valeurs : PENDING / APPROVED / PUBLISHED / IGNORED
}
