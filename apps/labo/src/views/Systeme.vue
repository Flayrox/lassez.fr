<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Système</h1>
      <p class="text-xs text-text-3 mt-0.5">Le labo en coulisses — simple et lisible</p>
    </div>

    <LCard title="Niveau de détail des journaux" description="DEBUG = tout · INFO = normal · WARN = alertes · ERROR = que les problèmes">
      <select v-model="store.systeme.niveauLogs" @change="store.markDirty()" class="w-full max-w-xs h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
        <option>DEBUG</option><option>INFO</option><option>WARN</option><option>ERROR</option>
      </select>
    </LCard>

    <div class="grid md:grid-cols-2 gap-4">
      <LCard title="Garder les journaux combien de jours" description="0 = pour toujours (déconseillé)">
        <input type="number" v-model.number="store.systeme.garderLogsJours" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60 max-w-[120px]" />
      </LCard>
      <LCard title="Envoyer les journaux au tableau de bord" description="Pour voir en direct si le robot tourne bien">
        <LToggle :model-value="store.systeme.miroirLogs" @update:model-value="(v: boolean) => { store.systeme.miroirLogs = v; store.markDirty() }" />
      </LCard>
    </div>

    <LCard title="Connexion qoe.fi" description="Là où partent les articles publiés">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="w-2 h-2 rounded-full bg-warning"></span>
          <div>
            <p class="text-sm font-medium">Mode test</p>
            <p class="text-[11px] text-text-3">Les envois sont simulés. Crée ta publication sur qoe.fi puis colle ta clé ici.</p>
          </div>
        </div>
        <LButton variant="secondary">Coller ma clé</LButton>
      </div>
    </LCard>

    <LCard title="Où tout est gardé">
      <ul class="text-xs text-text-2 space-y-1.5 font-mono">
        <li><span class="text-text-3">Config</span> daemon/config/config.yaml</li>
        <li><span class="text-text-3">Données locales</span> data/radar.db (signaux, archives, élections)</li>
        <li><span class="text-text-3">Articles publiés</span> api.qoe.fi (qoe.fi)</li>
      </ul>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LToggle from '../components/ui/LToggle.vue'
import LButton from '../components/ui/LButton.vue'

const store = useConfigStore()
</script>
