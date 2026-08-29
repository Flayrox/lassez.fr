<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold">Élections</h1>
        <p class="text-xs text-text-3 mt-0.5">Le front des résultats électoraux — un fichier SQLite par scrutin</p>
      </div>
      <LButton variant="secondary" :disabled="loading" @click="refresh">↻ Rafraîchir</LButton>
    </div>

    <div v-if="error" class="rounded-card border border-danger/40 bg-danger/10 text-xs text-danger px-3 py-2">
      daemon injoignable — impossible de lire le registre ({{ error }})
    </div>

    <LCard title="Scrutins" description="Chaque scrutin = data/elections/{slug}.db + une entrée du registre (registry.json). « Affiché » le rend visible sur le site, « Cible » = la page d'accueil des élections.">
      <div v-if="loading" class="text-xs text-text-3 py-4">Chargement…</div>
      <table v-else class="w-full text-left text-xs">
        <thead>
          <tr class="text-[10px] uppercase tracking-wider text-text-3 border-b border-border">
            <th class="py-2 pr-3 font-medium">Scrutin</th>
            <th class="py-2 pr-3 font-medium">Communes</th>
            <th class="py-2 pr-3 font-medium">Départements</th>
            <th class="py-2 pr-3 font-medium">Fichier</th>
            <th class="py-2 pr-3 font-medium">Affiché</th>
            <th class="py-2 pr-3 font-medium">Cible</th>
            <th class="py-2 pr-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in elections" :key="e.slug" class="border-b border-border/50">
            <td class="py-2.5 pr-3">
              <p class="font-medium text-text-1">{{ e.slug }}</p>
              <p v-if="!e.fileExists" class="text-[10px] text-warning">fichier absent — à créer</p>
            </td>
            <td class="py-2.5 pr-3 text-text-2">{{ e.communes > 0 ? e.communes.toLocaleString('fr-FR') : '—' }}</td>
            <td class="py-2.5 pr-3 text-text-2">{{ e.departments > 0 ? e.departments : '—' }}</td>
            <td class="py-2.5 pr-3 text-text-2">{{ e.fileExists ? (e.fileSizeKb / 1024).toFixed(1) + ' Mo' : '—' }}</td>
            <td class="py-2.5 pr-3">
              <LToggle :model-value="e.displayed" :disabled="busy" @update:model-value="(v: boolean) => setDisplay(e, v)" />
            </td>
            <td class="py-2.5 pr-3">
              <LBadge v-if="e.isTarget" variant="accent">Cible</LBadge>
              <LButton v-else variant="secondary" size="sm" :disabled="busy" @click="setTarget(e)">Définir</LButton>
            </td>
            <td class="py-2.5 pr-3 text-right">
              <LButton variant="danger" size="sm" :disabled="busy" @click="remove(e)">Supprimer</LButton>
            </td>
          </tr>
          <tr v-if="!elections.length">
            <td colspan="7" class="py-4 text-text-3">Aucun scrutin — crée le premier ci-dessous (il deviendra la cible).</td>
          </tr>
        </tbody>
      </table>
    </LCard>

    <LCard title="Ajouter un scrutin" description="Crée le fichier {slug}.db (schéma élection vide) + l'affiche sur le site. Les résultats officiels seront synchronisés depuis data.gouv.fr.">
      <div class="flex flex-wrap items-end gap-3">
        <LInput
          label="Identifiant (slug)"
          placeholder="presidentielles-2027"
          class="flex-1 min-w-[240px]"
          :model-value="newSlug"
          @update:model-value="newSlug = $event.toLowerCase().replace(/[^a-z0-9-]/g, '')"
          help="Lettres, chiffres et tirets — il devient l'URL /elections/{slug}"
        />
        <LButton :disabled="!canCreate || busy" @click="create">＋ Créer le scrutin</LButton>
      </div>
      <p v-if="createMsg" class="text-xs mt-2" :class="createMsg.ok ? 'text-accent' : 'text-danger'">{{ createMsg.ok ? '✓ ' + createMsg.text : '✗ ' + createMsg.text }}</p>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LInput from '../components/ui/LInput.vue'
import LToggle from '../components/ui/LToggle.vue'

interface Election {
  slug: string
  displayed: boolean
  isTarget: boolean
  fileExists: boolean
  fileSizeKb: number
  communes: number
  departments: number
}
interface Registry {
  displaySlugs: string[]
  targetSlug: string
}

const loading = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const elections = ref<Election[]>([])
const newSlug = ref('')
const createMsg = ref<{ ok: boolean; text: string } | null>(null)

const canCreate = computed(() => /^[a-z0-9-]{3,40}$/.test(newSlug.value.trim()))

onMounted(refresh)

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch('/api/elections')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const y = await res.json()
    elections.value = y?.elections ?? []
  } catch (e: any) {
    error.value = e?.message || String(e)
    elections.value = []
  } finally {
    loading.value = false
  }
}

async function api(method: string, body?: object) {
  busy.value = true
  error.value = null
  try {
    const res = await fetch('/api/elections', {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const y = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(y?.error || `HTTP ${res.status}`)
    await refresh()
    return y
  } catch (e: any) {
    error.value = e?.message || String(e)
    return null
  } finally {
    busy.value = false
  }
}

async function create() {
  if (!canCreate.value) return
  createMsg.value = null
  const y = await api('POST', { slug: newSlug.value.trim(), display: true })
  if (y) {
    newSlug.value = ''
    createMsg.value = { ok: true, text: `Scrutin « ${y.slug} » créé et affiché.` }
  } else {
    createMsg.value = { ok: false, text: error.value ?? 'échec inconnu' }
  }
}

async function setDisplay(e: Election, v: boolean) {
  const y = await api('PATCH', { slug: e.slug, display: v })
  if (y) e.displayed = v
}

async function setTarget(e: Election) {
  await api('PATCH', { slug: e.slug, target: true })
}

async function remove(e: Election) {
  if (!confirm(`Supprimer le scrutin « ${e.slug} » ?\nLe fichier ${e.slug}.db sera effacé (les données officielles sont re-synchronisables).`)) return
  const res = await fetch(`/api/elections?slug=${encodeURIComponent(e.slug)}`, { method: 'DELETE' })
  const y = await res.json().catch(() => ({}))
  if (!res.ok) {
    error.value = y?.error || `HTTP ${res.status}`
    return
  }
  await refresh()
}
</script>
