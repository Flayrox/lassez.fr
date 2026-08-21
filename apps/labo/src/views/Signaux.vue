<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-text-1">Signaux</h1>
        <p class="text-xs text-text-3 mt-0.5">Les articles collectés par le robot — valide, programme ou rejette</p>
      </div>
      <div class="flex gap-2">
        <LButton variant="secondary" @click="refresh">↻ Actualiser</LButton>
        <LButton @click="scanOpen = true">▶ Lancer un scan</LButton>
      </div>
    </div>

    <!-- Erreur -->
    <div v-if="store.error" class="bg-danger/10 border border-danger/40 text-danger rounded-card px-4 py-3 text-xs">
      Impossible de joindre le robot ({{ store.error }}). Lance le daemon : <code class="font-mono">RADAR_DB_PATH=../data/radar.db ./daemon</code>
    </div>

    <LCard :padding="false">
      <!-- Toolbar -->
      <div class="px-4 pt-3 space-y-3">
        <LTabs
          v-model="tab"
          :tabs="[
            { key: 'PENDING', label: 'En attente', count: store.counts.PENDING ?? 0 },
            { key: 'APPROVED', label: 'À valider', count: store.counts.APPROVED ?? 0 },
            { key: 'PUBLISHED', label: 'Publiés', count: store.counts.PUBLISHED ?? 0 },
            { key: 'IGNORED', label: 'Rejetés', count: store.counts.IGNORED ?? 0 },
          ]"
        />
        <div class="flex items-center gap-2 pb-3">
          <div class="flex items-center gap-2 h-8 px-2.5 rounded border border-border bg-bg flex-1 max-w-xs">
            <span class="text-text-3 text-xs">⌕</span>
            <input v-model="search" placeholder="Rechercher un titre, un tag…" class="bg-transparent outline-none text-xs text-text-1 placeholder:text-text-3 w-full" />
          </div>
          <div class="flex bg-bg border border-border rounded overflow-hidden">
            <button v-for="g in ['all', 'france', 'international']" :key="g" @click="geo = g"
              class="px-2.5 h-8 text-[11px] font-medium capitalize transition-colors"
              :class="geo === g ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">
              {{ g === 'all' ? 'Tout' : g }}
            </button>
          </div>
          <span class="ml-auto text-[11px] text-text-3">{{ filtered.length }} affichés{{ store.loading ? ' · chargement…' : '' }}</span>
        </div>
      </div>

      <!-- Table -->
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-y border-border text-[10px] uppercase tracking-wider text-text-3">
            <th class="w-10 px-4 py-2"><input type="checkbox" :checked="allSelected" @change="toggleAll" class="accent-accent" /></th>
            <th class="py-2 pr-3 font-medium">Titre</th>
            <th class="py-2 pr-3 font-medium hidden md:table-cell">Format</th>
            <th class="py-2 pr-3 font-medium">Zone</th>
            <th class="py-2 pr-3 font-medium hidden lg:table-cell">Fiabilité</th>
            <th class="py-2 pr-3 font-medium hidden sm:table-cell">Reçu</th>
            <th class="py-2 px-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="s in filtered" :key="s.id">
            <tr class="border-b border-border/50 hover:bg-surface-hover/60 transition-colors group" :class="{ 'bg-surface-hover': selected.includes(s.id) }">
              <td class="pl-4 py-2.5"><input type="checkbox" :checked="selected.includes(s.id)" @change="toggle(s.id)" class="accent-accent" /></td>
              <td class="py-2.5 pr-3 cursor-pointer max-w-md" @click="expanded = expanded === s.id ? null : s.id">
                <p class="text-xs font-medium text-text-1 line-clamp-1">{{ s.source_title }}</p>
                <p v-if="expanded !== s.id" class="text-[11px] text-text-3 line-clamp-1 mt-0.5">{{ s.flash_content }}</p>
                <p v-if="s.tags" class="text-[10px] text-accent mt-0.5">{{ s.tags.split(',').map(t => '#' + t.trim()).join(' ') }}</p>
              </td>
              <td class="py-2.5 pr-3 hidden md:table-cell"><LBadge :variant="formatVariant(s.type_ouverture)">{{ shortFormat(s.type_ouverture) }}</LBadge></td>
              <td class="py-2.5 pr-3"><span class="text-xs text-text-2">{{ s.geo === 'france' ? '🇫🇷' : '🌍' }}</span></td>
              <td class="py-2.5 pr-3 hidden lg:table-cell">
                <span class="inline-flex items-center gap-1.5 text-xs text-text-2 capitalize">
                  <span class="w-1.5 h-1.5 rounded-full" :class="dotFiabilite(s.fiabilite)"></span>{{ s.fiabilite }}
                </span>
              </td>
              <td class="py-2.5 pr-3 hidden sm:table-cell text-[11px] text-text-3 whitespace-nowrap">{{ timeAgo(s.created_at) }}</td>
              <td class="py-2.5 px-3">
                <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <LButton v-if="s.status === 'PENDING'" variant="ghost" @click.stop="bulk([s.id], 'APPROVED')" title="Valider">✓</LButton>
                  <LButton v-if="s.status !== 'IGNORED'" variant="ghost" @click.stop="bulk([s.id], 'IGNORED')" title="Rejeter">✕</LButton>
                  <LButton variant="ghost" @click.stop="delOne(s.id)" title="Supprimer">🗑</LButton>
                </div>
              </td>
            </tr>
            <!-- Expanded preview -->
            <tr v-if="expanded === s.id">
              <td colspan="7" class="bg-bg border-b border-border px-4 py-4">
                <div class="max-w-2xl ml-12 space-y-2">
                  <h4 class="text-sm font-medium text-text-1">{{ s.source_title }}</h4>
                  <p class="text-xs text-text-2 leading-relaxed whitespace-pre-line">{{ s.flash_content }}</p>
                  <a :href="s.source_url" target="_blank" rel="noopener" class="text-[11px] text-info hover:underline break-all">{{ s.source_url }}</a>
                  <div class="flex gap-2 pt-1">
                    <LButton @click="bulk([s.id], 'APPROVED')">Valider → à publier</LButton>
                    <LButton variant="danger" @click="bulk([s.id], 'IGNORED')">Rejeter</LButton>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <LEmpty v-if="!store.loading && filtered.length === 0" icon="▤" title="Aucun signal ici"
        description="Change d'onglet ou lance un scan pour collecter de nouveaux articles.">
        <template #action><LButton @click="scanOpen = true">Lancer un scan</LButton></template>
      </LEmpty>
    </LCard>

    <!-- Bulk bar -->
    <Teleport to="body">
      <Transition name="fadeup">
        <div v-if="selected.length > 0" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-surface border border-border rounded-card shadow-2xl px-4 py-2.5">
          <span class="text-xs text-text-1 mr-1">{{ selected.length }} sélectionné{{ selected.length > 1 ? 's' : '' }}</span>
          <LButton @click="bulk(selected, 'APPROVED')">Valider</LButton>
          <LButton variant="secondary" @click="bulk(selected, 'IGNORED')">Rejeter</LButton>
          <LButton variant="danger" @click="delSelected()">Supprimer</LButton>
          <button @click="selected = []" class="ml-1 text-text-3 hover:text-text-1 text-sm px-1">✕</button>
        </div>
      </Transition>
    </Teleport>

    <!-- Scan modal -->
    <LModal :open="scanOpen" title="Lancer un scan maintenant" @close="scanOpen = false">
      <p class="text-xs text-text-2 leading-relaxed">Le robot va parcourir tes sources (RSS, Telegram…) et ramener les nouveaux articles. Ça prend quelques secondes.</p>
      <template #footer>
        <LButton variant="secondary" @click="scanOpen = false">Annuler</LButton>
        <LButton @click="doScan">▶ Lancer</LButton>
      </template>
    </LModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSignalsStore } from '../stores/signals'
import LButton from '../components/ui/LButton.vue'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LTabs from '../components/ui/LTabs.vue'
import LModal from '../components/ui/LModal.vue'
import LEmpty from '../components/ui/LEmpty.vue'

const store = useSignalsStore()
const tab = ref('PENDING')
const geo = ref('all')
const search = ref('')
const selected = ref<number[]>([])
const expanded = ref<number | null>(null)
const scanOpen = ref(false)

function load() {
  store.fetchSignals(tab.value, geo.value, search.value)
}
onMounted(load)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 350) // debounce recherche
})
watch(tab, load)
watch(geo, load)

// Filtre local léger sur la page courante (l'API filtre déjà status+geo+q)
const filtered = computed(() => store.all)

const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(s => selected.value.includes(s.id)))

function toggle(id: number) {
  selected.value = selected.value.includes(id) ? selected.value.filter(i => i !== id) : [...selected.value, id]
}
function toggleAll() {
  selected.value = allSelected.value ? [] : filtered.value.map(s => s.id)
}
async function bulk(ids: number[], status: string) {
  await store.bulkUpdate(ids, status)
  selected.value = []
  expanded.value = null
  load()
}
async function delOne(id: number) {
  await store.remove([id])
  load()
}
async function delSelected() {
  await store.remove(selected.value)
  selected.value = []
  load()
}
function refresh() { load() }
function doScan() { scanOpen.value = false; refresh() }

function formatVariant(t: string): 'accent' | 'info' | 'warning' | 'neutral' {
  const u = t.toUpperCase()
  if (u.includes('ALERTE') || u.includes('URGENT') || u.includes('BREAKING')) return 'accent'
  if (u.includes('DÉCRYPTAGE') || u.includes('ENQUÊTE')) return 'info'
  if (u.includes('FLASH')) return 'warning'
  return 'neutral'
}
function shortFormat(t: string) {
  return t.replace(/📌|🔴|🔎|🚨|💅/g, '').trim() || t
}
function dotFiabilite(f: string) {
  return f === 'haute' ? 'bg-accent' : f === 'moyenne' ? 'bg-warning' : 'bg-danger'
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `il y a ${Math.max(1, m)} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
</script>

<style scoped>
.fadeup-enter-active,
.fadeup-leave-active {
  transition: all 150ms ease;
}
.fadeup-enter-from,
.fadeup-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
