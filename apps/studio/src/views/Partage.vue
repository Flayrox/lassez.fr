<!-- Diffusion → Plateformes : cartes par plateforme, réglages dans une popup (⚙), le reste compact. -->
<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Plateformes</h1>
      <p class="text-xs text-text-3 mt-0.5">Où partent tes articles — active une plateforme, puis ouvre ses réglages (⚙)</p>
    </div>

    <!-- Cartes plateformes -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="p in platforms"
        :key="p.key"
        class="bg-surface border rounded-card p-4 flex flex-col gap-3 transition-colors"
        :class="store.partage[p.key] ? 'border-accent/40' : 'border-border'"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" :class="store.partage[p.key] ? 'bg-accent-muted' : 'bg-surface-hover'">{{ p.icon }}</span>
            <div class="min-w-0">
              <p class="text-xs font-medium text-text-1">{{ p.label }}</p>
              <p class="text-[11px] text-text-3 line-clamp-1">{{ p.desc }}</p>
            </div>
          </div>
          <LToggle :model-value="store.partage[p.key]" @update:model-value="(v: boolean) => { store.partage[p.key] = v; store.markDirty() }" />
        </div>
        <div class="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
          <span class="text-[11px] text-text-3" :class="store.partage[p.key] ? '' : 'italic'">{{ modeLabel(p) }}</span>
          <LButton size="sm" variant="secondary" @click="openSettings(p.key)">⚙ Réglages</LButton>
        </div>
      </div>
    </div>

    <!-- Comportement -->
    <div class="grid md:grid-cols-2 gap-4">
      <LCard title="Espacement des envois" description="Délai au hasard entre 2 publications (anti-spam)">
        <div class="flex items-end gap-3">
          <label class="flex-1">
            <span class="text-[11px] text-text-3 block mb-1">Au moins (min)</span>
            <input type="number" v-model.number="store.partage.delaiMini" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
          </label>
          <span class="text-text-3 text-xs pb-2.5">→</span>
          <label class="flex-1">
            <span class="text-[11px] text-text-3 block mb-1">Au plus (min)</span>
            <input type="number" v-model.number="store.partage.delaiMaxi" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60" />
          </label>
        </div>
      </LCard>

      <LCard title="Autonomie" description="Deux décisions distinctes : ce qui part, puis l'envoi">
        <div class="space-y-2.5">
          <label class="flex items-center justify-between gap-2 border border-border/50 rounded px-3 py-2">
            <span class="min-w-0">
              <span class="text-xs font-medium block text-text-1">Mode Fantôme</span>
              <span class="text-[10px] text-text-3 block">L'IA valide à ta place : tu n'as plus à cliquer « Valider » dans Signaux</span>
            </span>
            <LToggle :model-value="store.partage.autoApprove" @update:model-value="(v: boolean) => { store.partage.autoApprove = v; store.markDirty() }" />
          </label>
          <label class="flex items-center justify-between gap-2 border border-border/50 rounded px-3 py-2">
            <span class="min-w-0">
              <span class="text-xs font-medium block text-text-1">Publication auto</span>
              <span class="text-[10px] text-text-3 block">Le robot envoie tout seul sur les plateformes cochées (pilote auto)</span>
            </span>
            <LToggle :model-value="store.partage.auto" @update:model-value="(v: boolean) => { store.partage.auto = v; store.markDirty() }" />
          </label>
          <label class="flex items-center justify-between gap-2 border border-border/50 rounded px-3 py-2">
            <span class="min-w-0">
              <span class="text-xs font-medium block text-text-1">Mode Fantôme — images</span>
              <span class="text-[10px] text-text-3 block">Les sujets auto-approuvés passent quand même par le nœud Image</span>
            </span>
            <LToggle :model-value="store.partage.autoApproveMedia" :disabled="!store.partage.autoApprove" @update:model-value="(v: boolean) => { store.partage.autoApproveMedia = v; store.markDirty() }" />
          </label>
        </div>
      </LCard>
    </div>

    <!-- Où part chaque format -->
    <LCard title="Où part chaque format" description="Ex : seules les Alertes partent sur Discord">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-[10px] uppercase tracking-wider text-text-3 border-b border-border">
            <th class="py-2 pr-3 font-medium">Format</th>
            <th v-for="p in matrixPlatforms" :key="p" class="py-2 px-2 font-medium text-center">{{ p }}</th>
          </tr>
        </thead>
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

    <!-- Modal : réglages d'une plateforme -->
    <LModal :open="!!settingsFor" :title="settingsFor ? `Réglages — ${labelOf(settingsFor)}` : ''" @close="settingsFor = null">
      <div v-if="settingsFor" class="space-y-5">
        <div>
          <p class="text-xs font-medium text-text-1 mb-1.5">Quand publier</p>
          <div class="flex bg-bg border border-border rounded overflow-hidden w-fit">
            <button
              @click="setMode(modeKeyOf(settingsFor), 'DIRECT')"
              class="px-3 h-8 text-[11px] font-medium transition-colors"
              :class="modeOf(settingsFor) === 'DIRECT' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'"
            >Tout de suite</button>
            <button
              @click="setMode(modeKeyOf(settingsFor), 'SCHEDULED')"
              class="px-3 h-8 text-[11px] font-medium transition-colors"
              :class="modeOf(settingsFor) === 'SCHEDULED' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'"
            >Petit à petit</button>
          </div>
          <p class="text-[11px] text-text-3 mt-1.5">« Tout de suite » publie à la réception · « Petit à petit » espace les envois selon les délais réglés.</p>
        </div>

        <template v-for="f in fieldsFor(settingsFor)" :key="f.key">
          <LInput :label="f.label" :type="f.type ?? 'text'" :model-value="sec[f.key]?.value ?? ''" @update:model-value="(v: string) => setField(f.key, v)" :placeholder="f.placeholder" />
        </template>

        <label v-if="settingsFor === 'discord'" class="flex items-center justify-between gap-2 border border-border/50 rounded px-3 py-2">
          <span class="min-w-0">
            <span class="text-xs font-medium block text-text-1">Mode test Discord</span>
            <span class="text-[10px] text-text-3 block">N'envoie pas réellement dans le salon</span>
          </span>
          <LToggle :model-value="store.partage.discordTestMode" @update:model-value="(v: boolean) => { store.partage.discordTestMode = v; store.markDirty() }" />
        </label>

        <p v-if="fieldsFor(settingsFor).length === 0" class="text-[11px] text-text-3 italic">Aucune clé à configurer pour cette plateforme.</p>
        <p class="text-[10px] text-text-3">Les clés restent dans daemon/config/.secrets.yaml — jamais dans git, jamais dans le localStorage.</p>
      </div>
    </LModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LToggle from '../components/ui/LToggle.vue'
import LInput from '../components/ui/LInput.vue'
import LButton from '../components/ui/LButton.vue'
import LModal from '../components/ui/LModal.vue'

const store = useConfigStore()

// Champs secrets → store.secrets + sauvegarde (PATCH /api/secrets).
// Proxies computed : la popup les lit/écrit via sec[key].value (jamais de
// v-model direct sur une propriété, qui écraserait le computed).
const SEC_KEYS = ['discordWebhookUrl', 'xApiKey', 'xApiSecret', 'xAccessToken', 'xAccessSecret',
  'blueskyIdentifier', 'blueskyAppPassword', 'mastodonInstanceUrl', 'mastodonAccessToken',
  'qoeApiKey', 'qoePublicationId'] as const
const sec: Record<string, ReturnType<typeof computed>> = {}
for (const k of SEC_KEYS) {
  sec[k] = computed({
    get: () => (store.secrets as any)[k] ?? '',
    set: (v: string) => { (store.secrets as any)[k] = v; store.markDirty() },
  })
}
function setField(key: string, v: string) { sec[key]!.value = v }

const platforms = [
  { key: 'qoe', label: 'qoe.fi', icon: '◈', modeKey: 'qoeMode', desc: "Là où partent les enquêtes" },
  { key: 'discord', label: 'Discord', icon: '◉', modeKey: 'discordMode', desc: 'Salon d’alerte' },
  { key: 'x', label: 'X / Twitter', icon: '𝕏', modeKey: 'xMode', desc: '280 caractères' },
  { key: 'bluesky', label: 'Bluesky', icon: '☁', modeKey: 'blueskyMode', desc: '300 caractères' },
  { key: 'mastodon', label: 'Mastodon', icon: '🐘', modeKey: 'mastodonMode', desc: '500 caractères' },
]

const settingsFor = ref<string | null>(null)
function openSettings(key: string) { settingsFor.value = key }
function labelOf(key: string) { return platforms.find(p => p.key === key)?.label ?? key }
function modeKeyOf(key: string) { return platforms.find(p => p.key === key)?.modeKey ?? key + 'Mode' }
function modeOf(key: string) { return store.partage[modeKeyOf(key)] }
function modeLabel(p: { key: string; modeKey: string }) {
  if (!store.partage[p.key]) return 'Désactivée'
  return store.partage[p.modeKey] === 'DIRECT' ? 'Tout de suite' : 'Petit à petit'
}
function setMode(modeKey: string, mode: 'DIRECT' | 'SCHEDULED') {
  store.partage[modeKey] = mode
  store.markDirty()
}

interface SecretField { label: string; key: string; type?: string; placeholder?: string }
const platformFields: Record<string, SecretField[]> = {
  qoe: [
    { label: 'Clé API qoe.fi', key: 'qoeApiKey', type: 'password', placeholder: 'Clé commençant par sk_…' },
    { label: 'ID de publication', key: 'qoePublicationId', placeholder: 'L’id de la publication côté qoe.fi' },
  ],
  discord: [
    { label: 'URL du webhook', key: 'discordWebhookUrl', type: 'password', placeholder: 'https://discord.com/api/webhooks/…' },
  ],
  x: [
    { label: 'API Key', key: 'xApiKey', type: 'password' },
    { label: 'API Secret', key: 'xApiSecret', type: 'password' },
    { label: 'Access Token', key: 'xAccessToken', type: 'password' },
    { label: 'Access Secret', key: 'xAccessSecret', type: 'password' },
  ],
  bluesky: [
    { label: 'Identifiant', key: 'blueskyIdentifier', placeholder: 'exemple.bsky.social' },
    { label: 'App Password', key: 'blueskyAppPassword', type: 'password' },
  ],
  mastodon: [
    { label: 'Instance', key: 'mastodonInstanceUrl', placeholder: 'https://mastodon.social' },
    { label: 'Access Token', key: 'mastodonAccessToken', type: 'password' },
  ],
}
function fieldsFor(key: string) { return platformFields[key] ?? [] }

const matrixPlatforms = ['qoe', 'discord', 'x', 'bluesky', 'mastodon'] as const
function toggleMatrix(formatId: string, platform: string) {
  // matrice format → plateforme (social_targets_by_type_json) — persistée dans le YAML
  if (!store.matrix[formatId]) store.matrix[formatId] = {}
  store.matrix[formatId][platform] = !store.matrix[formatId]?.[platform]
  store.markDirty()
}
</script>
