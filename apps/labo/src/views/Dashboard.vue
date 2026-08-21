<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold text-text-1">Vue d'ensemble</h1>
      <p class="text-xs text-text-3 mt-0.5">Ton atelier en un coup d'œil</p>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <LCard v-for="c in cards" :key="c.label">
        <p class="text-[11px] text-text-3">{{ c.label }}</p>
        <p class="text-xl font-semibold mt-1" :class="c.class">{{ c.value }}</p>
        <p class="text-[11px] text-text-3 mt-1">{{ c.sub }}</p>
      </LCard>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <!-- Prochain scan -->
      <LCard title="Prochain passage" description="Le robot parcourt tes sources automatiquement">
        <div class="flex items-center gap-4">
          <div class="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="70 30" stroke-linecap="round" />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-xs font-semibold">72%</span>
          </div>
          <div class="space-y-1 min-w-0">
            <p class="text-sm font-medium">{{ planningLabel }}</p>
            <p class="text-[11px] text-text-3">Intervalle {{ store.planning.intervalleMinutes }} min · {{ rssCount }} sources RSS · {{ tgCount }} Telegram</p>
            <router-link to="/planning" class="text-[11px] text-accent hover:underline inline-block">Modifier le planning →</router-link>
          </div>
        </div>
      </LCard>

      <!-- Chaîne -->
      <LCard title="Chaîne de fabrication" :description="`${activeCount} étapes sur 6 actives`">
        <div class="flex flex-wrap items-center gap-1">
          <template v-for="(n, i) in store.atelier" :key="n.type">
            <div class="flex items-center gap-1">
              <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px]"
                :class="n.enabled ? 'border-accent/40 bg-accent-muted text-accent' : 'border-border text-text-3'">
                <span class="w-1.5 h-1.5 rounded-full" :class="n.enabled ? 'bg-accent' : 'bg-border'"></span>{{ n.label }}
              </span>
              <span v-if="i < store.atelier.length - 1" class="text-text-3">→</span>
            </div>
          </template>
        </div>
        <router-link to="/atelier" class="text-[11px] text-accent hover:underline inline-block mt-3">Gérer l'atelier →</router-link>
      </LCard>

      <!-- Sources -->
      <LCard title="Sources en difficulté" description="Flux qui ont échoué au dernier passage">
        <div v-if="failedSources.length === 0" class="text-xs text-text-3 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-accent"></span> Tout va bien, aucune erreur</div>
        <ul v-else class="space-y-2">
          <li v-for="s in failedSources" :key="s.url" class="text-xs flex justify-between gap-3">
            <span class="text-text-2 truncate font-mono">{{ s.url }}</span>
            <LBadge variant="danger">{{ s.error }}</LBadge>
          </li>
        </ul>
        <router-link to="/sources" class="text-[11px] text-accent hover:underline inline-block mt-3">Voir les sources →</router-link>
      </LCard>

      <!-- Activité -->
      <LCard title="Derniers signaux" description="Ce que le robot vient de ramener">
        <ul class="space-y-2.5">
          <li v-for="s in recentSignals" :key="s.id" class="text-xs flex items-start gap-2">
            <LBadge :variant="s.type_ouverture.includes('ALERTE') ? 'accent' : 'neutral'" class="shrink-0 mt-0.5">{{ s.type_ouverture.replace('📌 ', '') }}</LBadge>
            <span class="text-text-2 line-clamp-1">{{ s.source_title }}</span>
          </li>
        </ul>
        <router-link to="/signaux" class="text-[11px] text-accent hover:underline inline-block mt-3">Tous les signaux →</router-link>
      </LCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfigStore, DAYS } from '../stores/config'
import { useSignalsStore } from '../stores/signals'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'

const store = useConfigStore()
const signals = useSignalsStore()

const activeCount = computed(() => store.atelier.filter(p => p.enabled).length)
const rssCount = computed(() => store.sources.rss.split('\n').filter(s => s.trim()).length)
const tgCount = computed(() => store.sources.telegram.split('\n').filter(s => s.trim()).length)

const failedSources = [
  { url: 'https://www.rtl.fr/actu/rss', error: '404' },
  { url: 'https://www.fidh.org/en/rss', error: '404' },
  { url: 'https://www.amnesty.org/en/feed/', error: '403' },
]

const recentSignals = signals.all.slice(0, 4)

const cards = computed(() => [
  { label: 'Robot', value: '● En marche', sub: 'Binaire Go', class: 'text-accent' },
  { label: 'Atelier', value: `${activeCount.value}/6`, sub: 'étapes actives', class: 'text-text-1' },
  { label: 'En attente', value: String(signals.counts.pending), sub: 'signaux à traiter', class: 'text-warning' },
  { label: 'Publication', value: 'Test', sub: 'qoe.fi non branché', class: 'text-text-2' },
])

const planningLabel = computed(() => {
  const slots = store.planning.weeklySlots
  if (store.planning.mode === 'pulse') return `Toutes les ${store.planning.intervalleMinutes} min`
  if (slots.length === 0) return 'Aucun créneau configuré'
  // Groupe par heure pour un résumé court : "tous les jours à 20:08" / "LUN, MAR à 08:00"
  const times = [...new Set(slots.map(s => s.time))]
  const daysByTime = times.map(t => ({ t, days: slots.filter(s => s.time === t).map(s => s.day) }))
  const allDays = DAYS.length === daysByTime[0]?.days.length && times.length === 1
    ? true
    : false
  if (allDays) return `Tous les jours à ${times[0]}`
  return prefix + daysByTime.map(({ t, days }) => `${days.join(', ')} à ${t}`).join(' · ')
})
const prefix = computed(() => (store.planning.mode === 'hybrid' ? `+ intervalle ${store.planning.intervalleMinutes} min : ` : ''))
</script>
