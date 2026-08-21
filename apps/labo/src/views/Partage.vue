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

    <!-- Clés et connexions (jamais dans git — daemon/config/.secrets.yaml) -->
    <LCard title="Clés et connexions" description="Les secrets de chaque plateforme — stockés dans daemon/config/.secrets.yaml (jamais dans git, jamais dans le localStorage)">
      <div class="space-y-4">
        <div v-if="store.partage.discord" class="space-y-1.5">
          <p class="text-xs font-medium">Discord — URL du webhook</p>
          <LInput v-model="sec.discordWebhookUrl" placeholder="https://discord.com/api/webhooks/…" type="password" />
        </div>
        <div v-if="store.partage.x" class="grid md:grid-cols-2 gap-3">
          <div class="md:col-span-2"><p class="text-xs font-medium mb-1">X / Twitter — clés API</p></div>
          <LInput label="API Key" v-model="sec.xApiKey" type="password" />
          <LInput label="API Secret" v-model="sec.xApiSecret" type="password" />
          <LInput label="Access Token" v-model="sec.xAccessToken" type="password" />
          <LInput label="Access Secret" v-model="sec.xAccessSecret" type="password" />
        </div>
        <div v-if="store.partage.bluesky" class="grid md:grid-cols-2 gap-3">
          <div class="md:col-span-2"><p class="text-xs font-medium mb-1">Bluesky — identifiants</p></div>
          <LInput label="Identifiant" v-model="sec.blueskyIdentifier" placeholder="exemple.bsky.social" />
          <LInput label="App Password" v-model="sec.blueskyAppPassword" type="password" />
        </div>
        <div v-if="store.partage.mastodon" class="grid md:grid-cols-2 gap-3">
          <div class="md:col-span-2"><p class="text-xs font-medium mb-1">Mastodon — instance & token</p></div>
          <LInput label="Instance" v-model="sec.mastodonInstanceUrl" placeholder="https://mastodon.social" />
          <LInput label="Access Token" v-model="sec.mastodonAccessToken" type="password" />
        </div>
        <p v-if="!store.partage.discord && !store.partage.x && !store.partage.bluesky && !store.partage.mastodon" class="text-xs text-text-3">Active une plateforme ci-dessus pour configurer sa clé.</p>
      </div>
    </LCard>

    <div class="grid md:grid-cols-3 gap-4">
      <LCard title="Attendre au moins (minutes)" description="Délai mini entre 2 publications">
        <input type="number" v-model.number="store.partage.delaiMini" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
      </LCard>
      <LCard title="Attendre au plus (minutes)" description="Délai maxi (choisi au hasard entre les deux)">
        <input type="number" v-model.number="store.partage.delaiMaxi" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
      </LCard>
      <LCard>
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium">Publication auto</p>
            <p class="text-[10px] text-text-3">Publie sans validation (pilote auto)</p>
            <LToggle :model-value="store.partage.auto" @update:model-value="(v: boolean) => { store.partage.auto = v; store.markDirty() }" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium">Mode Fantôme</p>
            <p class="text-[10px] text-text-3">L’IA approuve sans modération</p>
            <LToggle :model-value="store.partage.autoApprove" @update:model-value="(v: boolean) => { store.partage.autoApprove = v; store.markDirty() }" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium">Mode test Discord</p>
            <LToggle :model-value="store.partage.discordTestMode" @update:model-value="(v: boolean) => { store.partage.discordTestMode = v; store.markDirty() }" />
          </div>
        </div>
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
              <input type="checkbox" :checked="store.matrix[f.id]?.[p]" @change="toggleMatrix(f.id, p)" class="accent-accent" />
            </td>
          </tr>
        </tbody>
      </table>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LToggle from '../components/ui/LToggle.vue'
import LInput from '../components/ui/LInput.vue'

const store = useConfigStore()

// Champs secrets → store.secrets + sauvegarde (PATCH /api/secrets).
// v-model exige une expression membre : on pré-construit un computed par clé.
const SEC_KEYS = ['discordWebhookUrl', 'xApiKey', 'xApiSecret', 'xAccessToken', 'xAccessSecret',
  'blueskyIdentifier', 'blueskyAppPassword', 'mastodonInstanceUrl', 'mastodonAccessToken'] as const
const sec: Record<string, ReturnType<typeof computed>> = {}
for (const k of SEC_KEYS) {
  sec[k] = computed({
    get: () => (store.secrets as any)[k] ?? '',
    set: (v: string) => { (store.secrets as any)[k] = v; store.markDirty() },
  })
}

const platforms = [
  { key: 'qoe', label: 'qoe.fi', modeKey: 'qoeMode', desc: 'Là où partent les enquêtes' },
  { key: 'discord', label: 'Discord', modeKey: 'discordMode', desc: 'Salon d’alerte' },
  { key: 'x', label: 'X / Twitter', modeKey: 'xMode', desc: '280 caractères' },
  { key: 'bluesky', label: 'Bluesky', modeKey: 'blueskyMode', desc: '300 caractères' },
  { key: 'mastodon', label: 'Mastodon', modeKey: 'mastodonMode', desc: '500 caractères' },
]

const matrixPlatforms = ['qoe', 'discord', 'x', 'bluesky', 'mastodon'] as const

function setMode(key: string, mode: 'DIRECT' | 'SCHEDULED') {
  store.partage[key] = mode
  store.markDirty()
}
function toggleMatrix(formatId: string, platform: string) {
  // matrice format → plateforme (social_targets_by_type_json) — persistée dans le YAML
  if (!store.matrix[formatId]) store.matrix[formatId] = {}
  store.matrix[formatId][platform] = !store.matrix[formatId]?.[platform]
  store.markDirty()
}
</script>
