<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Formats</h1>
        <p class="text-xs text-text-3 mt-0.5">Chaque type d'article a son style — comme les rubriques d'un journal</p>
      </div>
      <LButton @click="addFormat">+ Nouveau format</LButton>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      <div v-for="f in store.formats" :key="f.id" class="bg-surface border border-border rounded-card overflow-hidden flex">
        <div class="w-1 shrink-0" :style="{ background: f.couleur }"></div>
        <div class="flex-1 p-4 space-y-3 min-w-0">
          <div class="flex items-center gap-2">
            <input v-model="f.nom" @input="store.markDirty()" class="flex-1 bg-transparent text-sm font-medium text-text-1 outline-none focus:bg-bg rounded px-1 -ml-1" />
            <LToggle v-model="f.actif" @update:model-value="store.markDirty()" />
            <button @click="removeFormat(f.id)" class="text-text-3 hover:text-danger transition-colors px-1">🗑</button>
          </div>
          <LTextarea :model-value="f.consigne" @update:model-value="(v: string) => { f.consigne = v; store.markDirty() }" rows="2" placeholder="Consigne pour ce format…" />
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-[11px] text-text-3 cursor-pointer">
              Couleur
              <input type="color" v-model="f.couleur" @input="store.markDirty()" class="w-6 h-6 rounded border border-border bg-transparent cursor-pointer p-0" />
            </label>
            <LBadge :variant="f.actif ? 'accent' : 'neutral'">{{ f.actif ? 'Actif' : 'En pause' }}</LBadge>
          </div>
        </div>
      </div>
    </div>

    <LEmpty v-if="store.formats.length === 0" icon="▭" title="Aucun format" description="Crée ta première rubrique : Alerte, Décryptage, Flash…">
      <template #action><LButton @click="addFormat">+ Nouveau format</LButton></template>
    </LEmpty>
  </div>
</template>

<script setup lang="ts">
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LToggle from '../components/ui/LToggle.vue'
import LTextarea from '../components/ui/LTextarea.vue'
import LEmpty from '../components/ui/LEmpty.vue'

const store = useConfigStore()

function addFormat() {
  store.formats.push({ id: Date.now().toString(), nom: 'Nouveau format', actif: true, consigne: '', couleur: '#3ecf8e' })
  store.markDirty()
}
function removeFormat(id: string) {
  store.formats = store.formats.filter(f => f.id !== id)
  store.markDirty()
}
</script>
