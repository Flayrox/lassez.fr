<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Partage</h1>
      <p class="text-xs text-text-3 mt-0.5">Où partent tes articles — coche ce que tu veux</p>
    </div>

    <!-- Plateformes -->
    <LCard :padding="false" title="Plateformes" description="« Tout de suite » publie à la réception · « Petit à petit » espace les envois pour ne pas spammer">
      <table class="w-full text-left">
        <tbody>
          <tr v-for="p in platforms" :key="p.key" class="border-t border-border/60 hover:bg-surface-hover/40 transition-colors">
            <td class="px-4 py-3 flex items-center gap-3">
              <LToggle :model-value="store.partage[p.key]" @update:model-value="(v: boolean) => { store.partage[p.key] = v; store.markDirty() }" />
              <div>
                <p class="text-xs font-medium">{{ p.label }}</p>
                <p class="text-[11px] text-text-3">{{ p.desc }}</p>
              </div>
            </td>
            <td class="px-4 py-3 w-56">
              <div v-if="store.partage[p.key]" class="flex bg-bg border border-border rounded overflow-hidden">
                <button @click="setMode(p.modeKey, 'DIRECT')" class="flex-1 h-7 text-[11px] font-medium transition-colors"
                  :class="store.partage[p.modeKey] === 'DIRECT' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">Tout de suite</button>
                <button @click="setMode(p.modeKey, 'SCHEDULED')" class="flex-1 h-7 text-[11px] font-medium transition-colors"
                  :class="store.partage[p.modeKey] === 'SCHEDULED' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">Petit à petit</button>
              </div>
              <span v-else class="text-[11px] text-text-3 italic">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </LCard>

    <div class="grid md:grid-cols-3 gap-4">
      <LCard title="Attendre au moins (minutes)" description="Délai mini entre 2 publications">
        <input type="number" v-model.number="store.partage.delaiMini" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
      </LCard>
      <LCard title="Attendre au plus (minutes)" description="Délai maxi (choisi au hasard entre les deux)">
        <input type="number" v-model.number="store.partage.delaiMaxi" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
      </LCard>
      <LCard title="Publication automatique" description="Si off : l'IA prépare mais ne publie pas">
        <LToggle :model-value="store.partage.auto" @update:model-value="(v: boolean) => { store.partage.auto = v; store.markDirty() }" />
      </LCard>
    </div>

    <!-- Matrice par format -->
    <LCard title="Par type d'article" description="Ex : seules les Alertes partent sur Discord">
      <table class="w-full text-left text-xs">
        <thead><tr class="text-[10px] uppercase tracking-wider text-text-3 border-b border-border">
          <th class="py-2 pr-3 font-medium">Format</th>
          <th v-for="p in matrixPlatforms" :key="p" class="py-2 px-2 font-medium text-center">{{ p }}</th>
        </tr></thead>
        <tbody>
          <tr v-for="f in store.formats" :key="f.id" class="border-b border-border/50">
            <td class="py-2 pr-3 font-medium text-text-1">{{ f.nom }}</td>
            <td v-for="p in matrixPlatforms" :key="p" class="py-2 px-2 text-center">
              <input type="checkbox" :checked="matrix[f.id]?.[p]" @change="toggleMatrix(f.id, p)" class="accent-accent" />
            </td>
          </tr>
        </tbody>
      </table>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LToggle from '../components/ui/LToggle.vue'

const store = useConfigStore()

const platforms = [
  { key: 'qoe', label: 'qoe.fi', modeKey: 'qoeMode', desc: 'Là où partent les enquêtes' },
  { key: 'discord', label: 'Discord', modeKey: 'discordMode', desc: 'Salon d’alerte' },
  { key: 'x', label: 'X / Twitter', modeKey: 'xMode', desc: '280 caractères' },
  { key: 'bluesky', label: 'Bluesky', modeKey: 'blueskyMode', desc: '300 caractères' },
  { key: 'mastodon', label: 'Mastodon', modeKey: 'mastodonMode', desc: '500 caractères' },
]

const matrixPlatforms = ['qoe', 'discord', 'x', 'bluesky', 'mastodon'] as const

// matrice format → plateforme (reprend social_targets_by_type_json de l'ancienne DB)
const matrix = reactive<Record<string, Record<string, boolean>>>(
  Object.fromEntries(store.formats.map(f => [f.id, { qoe: true, discord: f.nom.includes('Alerte'), x: false, bluesky: false, mastodon: false }]))
)

function setMode(key: string, mode: 'DIRECT' | 'SCHEDULED') {
  store.partage[key] = mode
  store.markDirty()
}
function toggleMatrix(formatId: string, platform: string) {
  if (!matrix[formatId]) matrix[formatId] = {}
  matrix[formatId][platform] = !matrix[formatId]?.[platform]
  store.markDirty()
}
</script>
