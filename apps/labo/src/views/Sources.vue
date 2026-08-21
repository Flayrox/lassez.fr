<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Sources</h1>
        <p class="text-xs text-text-3 mt-0.5">D'où viennent les infos — ajoute ou retire des journaux d'un clic</p>
      </div>
      <LButton variant="secondary" @click="importOpen = true">⤓ Importer CSV</LButton>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <LCard title="Journaux et sites" description="Adresses RSS, 1 par ligne">
        <textarea v-model="store.sources.rss" rows="12" class="w-full bg-bg border border-border rounded px-3 py-2 text-xs font-mono text-text-1 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
        <p class="text-[11px] text-text-3 mt-2">{{ rssCount }} sources actives</p>
      </LCard>

      <div class="space-y-4">
        <LCard title="Chaînes Telegram" description="Sans @, 1 par ligne">
          <textarea v-model="store.sources.telegram" rows="6" class="w-full bg-bg border border-border rounded px-3 py-2 text-xs font-mono text-text-1 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
          <p class="text-[11px] text-text-3 mt-2">{{ tgCount }} chaînes</p>
        </LCard>
        <LCard title="Recherches Google News" description="Un mot-clé par ligne (optionnel)">
          <textarea v-model="store.sources.googleNews" rows="3" placeholder="ex : climat" class="w-full bg-bg border border-border rounded px-3 py-2 text-xs font-mono text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
        </LCard>
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      <LCard title="Regarder combien d'heures en arrière" description="10 h = on ne prend que le très récent">
        <input type="number" v-model.number="store.sources.lookbackHours" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
      </LCard>
      <LCard title="Charger combien de sources à la fois" description="5 = rapide sans surcharger les serveurs">
        <input type="number" v-model.number="store.sources.concurrency" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
      </LCard>
    </div>

    <!-- Santé des sources -->
    <LCard title="Santé des sources" description="Flux en échec au dernier passage">
      <table class="w-full text-left text-xs">
        <thead><tr class="text-[10px] uppercase tracking-wider text-text-3 border-b border-border">
          <th class="py-2 pr-3 font-medium">Adresse</th><th class="py-2 pr-3 font-medium">Statut</th><th class="py-2 pr-3 font-medium">Erreur</th><th></th>
        </tr></thead>
        <tbody>
          <tr v-for="(f, i) in failedSources" :key="i" class="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
            <td class="py-2 pr-3 font-mono text-text-2 truncate max-w-xs">{{ f.url }}</td>
            <td class="py-2 pr-3"><LBadge variant="danger">En échec</LBadge></td>
            <td class="py-2 pr-3 text-text-3">{{ f.error }}</td>
            <td class="py-2"><LButton variant="ghost" @click="">Réessayer</LButton></td>
          </tr>
        </tbody>
      </table>
    </LCard>

    <!-- Import CSV modal -->
    <LModal :open="importOpen" title="Importer des sources depuis un CSV" @close="importOpen = false">
      <p class="text-xs text-text-2 mb-3">Colle une liste d'URLs (une par ligne). Elles seront ajoutées aux sources existantes.</p>
      <LTextarea v-model="csvPaste" :rows="8" placeholder="https://exemple.com/rss&#10;https://autre.fr/feed" />
      <template #footer>
        <LButton variant="secondary" @click="importOpen = false">Annuler</LButton>
        <LButton @click="doImport">Importer {{ csvLines }} URL{{ csvLines > 1 ? 's' : '' }}</LButton>
      </template>
    </LModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LModal from '../components/ui/LModal.vue'
import LTextarea from '../components/ui/LTextarea.vue'

const store = useConfigStore()
const importOpen = ref(false)
const csvPaste = ref('')
const csvLines = computed(() => csvPaste.value.split('\n').filter(s => s.trim()).length)

const rssCount = computed(() => store.sources.rss.split('\n').filter(s => s.trim()).length)
const tgCount = computed(() => store.sources.telegram.split('\n').filter(s => s.trim()).length)

const failedSources = [
  { url: 'https://www.rtl.fr/actu/rss', error: 'HTTP 404' },
  { url: 'https://www.fidh.org/en/rss', error: 'HTTP 404' },
  { url: 'https://www.amnesty.org/en/feed/', error: 'HTTP 403' },
]

function doImport() {
  const urls = csvPaste.value.split('\n').map(s => s.trim()).filter(Boolean)
  const existing = new Set(store.sources.rss.split('\n').map(s => s.trim()))
  const added = urls.filter(u => !existing.has(u))
  if (added.length) {
    store.sources.rss = [...store.sources.rss.split('\n').filter(s => s.trim()), ...added].join('\n')
    store.markDirty()
  }
  csvPaste.value = ''
  importOpen.value = false
}
</script>
