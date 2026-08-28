<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Formats</h1>
        <p class="text-xs text-text-3 mt-0.5">Chaque type d'info a ses instructions de format, ses exemples à recopier et son schéma de sortie — l'IA s'en sert à chaque rédaction</p>
      </div>
      <LButton @click="addFormat">+ Nouveau format</LButton>
    </div>

    <div class="space-y-3">
      <div v-for="f in store.formats" :key="f.id" class="bg-surface border border-border rounded-card overflow-hidden"
        :class="f.actif ? '' : 'opacity-70'">
        <!-- Header -->
        <div class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover/50 transition-colors" @click="expanded = expanded === f.id ? null : f.id">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: f.couleur }"></span>
          <input v-model="f.nom" @click.stop @input="store.markDirty()" class="bg-transparent text-sm font-medium text-text-1 outline-none focus:bg-bg rounded px-1 -ml-1 flex-1 min-w-0" />
          <code class="text-[10px] font-mono text-text-3 bg-bg border border-border rounded px-1.5 py-0.5 shrink-0">{{ f.id }}</code>
          <LBadge :variant="f.actif ? 'accent' : 'neutral'" class="shrink-0">{{ f.actif ? 'Actif' : 'En pause' }}</LBadge>
          <LToggle :model-value="f.actif" @click.stop @update:model-value="(v: boolean) => { f.actif = v; store.markDirty() }" class="shrink-0" />
          <button @click.stop="removeFormat(f.id)" class="text-text-3 hover:text-danger transition-colors px-1 shrink-0" title="Supprimer">🗑</button>
          <span class="text-text-3 text-xs shrink-0">{{ expanded === f.id ? '−' : '+' }}</span>
        </div>

        <!-- Editor -->
        <div v-if="expanded === f.id" class="border-t border-border p-4 space-y-4">
          <div class="space-y-1.5">
            <p class="text-[11px] font-medium text-text-2 uppercase tracking-wider">Description — aide le robot à reconnaître quand utiliser ce format, au moment du tri</p>
            <input v-model="f.description" @input="store.markDirty()" placeholder="Quand utiliser ce format…" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-xs focus:outline-none focus:border-accent/60" />
          </div>

          <div class="space-y-1.5">
            <p class="text-[11px] font-medium text-text-2 uppercase tracking-wider">Instructions de format — envoyées à l'IA de rédaction</p>
            <LTextarea :model-value="f.consigne" @update:model-value="(v: string) => { f.consigne = v; store.markDirty() }" :rows="7" placeholder="La structure exacte du post : lignes, MAJUSCULES, tacles…" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-[11px] font-medium text-text-2 uppercase tracking-wider">Exemples (few-shot) — l'IA imite le style</p>
              <LButton variant="secondary" @click="addExample(f)">+ Exemple</LButton>
            </div>
            <div v-for="(ex, i) in f.exemples" :key="i" class="relative">
              <span class="absolute top-2.5 left-2.5 text-[9px] font-bold text-text-3 uppercase">#{{ i + 1 }}</span>
              <LTextarea :model-value="ex" @update:model-value="(v: string) => { f.exemples[i] = v; store.markDirty() }" :rows="3"
                class="!pl-8 !pr-8 !bg-surface" placeholder="Un post d'exemple complet…" />
              <button @click="removeExample(f, i)" class="absolute top-2.5 right-2.5 text-text-3 hover:text-danger transition-colors" title="Retirer">✕</button>
            </div>
            <p v-if="f.exemples.length === 0" class="text-[11px] text-text-3 italic">Aucun exemple — l'IA se reposera uniquement sur les instructions.</p>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <p class="text-[11px] font-medium text-text-2 uppercase tracking-wider">Schéma JSON de sortie attendu</p>
              <button v-if="!isValidJson(f.schema)" class="text-[10px] text-warning">JSON invalide</button>
              <span v-else class="text-[10px] text-accent">JSON valide ✓</span>
            </div>
            <LTextarea :model-value="f.schema" @update:model-value="(v: string) => { f.schema = v; store.markDirty() }" :rows="8"
              class="!font-mono !bg-surface" placeholder="{ &quot;taxonomie&quot;: &quot;…&quot;, &quot;geo&quot;: …, &quot;tags&quot;: […], &quot;headline&quot;: …, &quot;body&quot;: …, &quot;image_search_queries&quot;: […], &quot;metadata&quot;: {…} }" />
          </div>

          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-[11px] text-text-3 cursor-pointer">
              Couleur
              <input type="color" v-model="f.couleur" @input="store.markDirty()" class="w-6 h-6 rounded border border-border bg-transparent cursor-pointer p-0" />
            </label>
            <span class="text-[10px] font-mono text-text-3">{{ f.consigne.length }} chars instructions · {{ f.exemples.length }} exemples</span>
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
import { ref } from 'vue'
import { useConfigStore, type FormatItem } from '../stores/config'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LToggle from '../components/ui/LToggle.vue'
import LTextarea from '../components/ui/LTextarea.vue'
import LEmpty from '../components/ui/LEmpty.vue'

const store = useConfigStore()
const expanded = ref<string | null>(null)

function addFormat() {
  store.formats.push({ id: 'FORMAT_' + Date.now().toString().slice(-6), nom: 'Nouveau format', actif: true, couleur: '#3ecf8e', description: '', consigne: '', exemples: [], schema: '' })
  store.markDirty()
}
function removeFormat(id: string) {
  store.formats = store.formats.filter(f => f.id !== id)
  store.markDirty()
}
function addExample(f: FormatItem) {
  f.exemples.push('')
  store.markDirty()
}
function removeExample(f: FormatItem, i: number) {
  f.exemples.splice(i, 1)
  store.markDirty()
}
function isValidJson(s: string) {
  if (!s.trim()) return true // vide = l'IA sort le schéma par défaut
  try { JSON.parse(s); return true } catch { return false }
}
</script>
