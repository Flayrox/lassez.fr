<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Filtres</h1>
      <p class="text-xs text-text-3 mt-0.5">On garde quoi, on enlève quoi — tout est expliqué simplement</p>
    </div>

    <LCard title="Mots à suivre" description="On garde les articles qui contiennent ces mots">
      <div class="flex flex-wrap gap-1.5 mb-3">
        <span v-for="(k, i) in keywords" :key="i" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent-muted text-accent text-xs">
          {{ k }}<button @click="removeKeyword(i)" class="opacity-60 hover:opacity-100">✕</button>
        </span>
        <input v-model="newKeyword" @keydown.enter="addKeyword" placeholder="Ajouter un mot… Entrée" class="flex-1 min-w-[140px] h-7 bg-transparent outline-none text-xs text-text-1 placeholder:text-text-3" />
      </div>
    </LCard>

    <LCard title="Mots à ignorer" description="On enlève ceux qui contiennent ça">
      <div class="flex flex-wrap gap-1.5 mb-3">
        <span v-for="(k, i) in banned" :key="i" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-danger/10 text-danger text-xs">
          {{ k }}<button @click="removeBanned(i)" class="opacity-60 hover:opacity-100">✕</button>
        </span>
        <input v-model="newBanned" @keydown.enter="addBanned" placeholder="Ajouter un mot… Entrée" class="flex-1 min-w-[140px] h-7 bg-transparent outline-none text-xs text-text-1 placeholder:text-text-3" />
      </div>
    </LCard>

    <div class="grid lg:grid-cols-2 gap-4">
      <LCard title="Ressemblance maximum avant doublon" :description="`${store.filtres.seuilRessemblance}% — au-delà, l'article est considéré comme déjà vu`">
        <input type="range" min="10" max="90" v-model.number="store.filtres.seuilRessemblance" class="w-full accent-accent" />
        <div class="flex justify-between text-[10px] text-text-3 mt-1"><span>10% strict</span><span>90% permissif</span></div>
      </LCard>
      <LCard title="Fenêtre anti-doublons" description="On compare avec les articles de combien d'heures en arrière ?">
        <input type="number" v-model.number="store.filtres.fenetreDoublonsHeures" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
      </LCard>
    </div>

    <LCard>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">Autoriser les images des sources</p>
          <p class="text-[11px] text-text-3 mt-0.5">Si décoché, le robot génère une illustration neutre à la place</p>
        </div>
        <LToggle v-model="store.filtres.imagesAutorisees" />
      </div>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LToggle from '../components/ui/LToggle.vue'

const store = useConfigStore()
const keywords = ref(store.filtres.motsCles.split(',').map(s => s.trim()).filter(Boolean))
const banned = ref(store.filtres.motsInterdits.split(',').map(s => s.trim()).filter(Boolean))
const newKeyword = ref('')
const newBanned = ref('')

function syncKeywords() {
  store.filtres.motsCles = keywords.value.join(', ')
  store.markDirty()
}
function addKeyword() {
  const k = newKeyword.value.trim()
  if (k && !keywords.value.includes(k)) { keywords.value.push(k); syncKeywords() }
  newKeyword.value = ''
}
function removeKeyword(i: number) { keywords.value.splice(i, 1); syncKeywords() }
function syncBanned() {
  store.filtres.motsInterdits = banned.value.join(', ')
  store.markDirty()
}
function addBanned() {
  const k = newBanned.value.trim()
  if (k && !banned.value.includes(k)) { banned.value.push(k); syncBanned() }
  newBanned.value = ''
}
function removeBanned(i: number) { banned.value.splice(i, 1); syncBanned() }
</script>
