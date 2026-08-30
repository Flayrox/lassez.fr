<!-- Diffusion — ce qui sort du pipeline : où et quand publier. Cartes par
     plateforme (réglages dans une popup), comportement, matrice format ×
     plateforme. Refait avec shadcn-vue. -->
<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Diffusion</h1>
      <p class="text-muted-foreground mt-0.5 text-xs">Où partent tes articles — active une plateforme, puis ouvre ses réglages (⚙). Le planning vit dans « Emploi du temps ».</p>
    </div>

    <!-- Cartes plateformes -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="p in platforms"
        :key="p.key"
        class="gap-3 py-4"
        :class="store.partage[p.key] ? 'border-accent/40' : ''"
      >
        <div class="flex items-start justify-between gap-2 px-4">
          <div class="flex min-w-0 items-center gap-2.5">
            <span class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-base">{{ p.icon }}</span>
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ p.label }}</p>
              <p class="text-muted-foreground line-clamp-1 text-xs">{{ p.desc }}</p>
            </div>
          </div>
          <Switch :model-value="store.partage[p.key]" @update:model-value="(v: boolean) => { store.partage[p.key] = v; store.markDirty() }" />
        </div>
        <div class="border-t px-4 pt-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-foreground text-[11px]" :class="store.partage[p.key] ? '' : 'italic'">{{ modeLabel(p) }}</span>
            <Button variant="outline" size="sm" @click="openSettings(p.key)"><SettingsIcon data-icon="inline-start" /> Réglages</Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Comportement -->
    <div class="grid gap-4 md:grid-cols-2">
      <Card class="gap-0 py-0">
        <CardHeader class="border-b px-4 py-3">
          <CardTitle class="text-sm">Espacement des envois</CardTitle>
          <CardDescription class="text-xs">Délai au hasard entre 2 publications (anti-spam)</CardDescription>
        </CardHeader>
        <CardContent class="flex items-end gap-3 p-4">
          <div class="flex-1 space-y-1">
            <span class="text-muted-foreground block text-[11px]">Au moins (min)</span>
            <Input type="number" :model-value="store.partage.delaiMini" @update:model-value="(v) => { store.partage.delaiMini = Number(v); store.markDirty() }" />
          </div>
          <span class="text-muted-foreground pb-2.5 text-xs">→</span>
          <div class="flex-1 space-y-1">
            <span class="text-muted-foreground block text-[11px]">Au plus (min)</span>
            <Input type="number" :model-value="store.partage.delaiMaxi" @update:model-value="(v) => { store.partage.delaiMaxi = Number(v); store.markDirty() }" />
          </div>
        </CardContent>
      </Card>

      <Card class="gap-0 py-0">
        <CardHeader class="border-b px-4 py-3">
          <CardTitle class="text-sm">Autonomie</CardTitle>
          <CardDescription class="text-xs">Ce qui part, puis l'envoi — le robot peut tout décider seul</CardDescription>
        </CardHeader>
        <CardContent class="space-y-2 p-4">
          <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div class="min-w-0">
              <p class="text-sm">Publication auto</p>
              <p class="text-muted-foreground text-xs">Le robot envoie tout seul sur les plateformes cochées (pilote auto)</p>
            </div>
            <Switch :model-value="store.partage.auto" @update:model-value="(v: boolean) => { store.partage.auto = v; store.markDirty() }" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Où part chaque format -->
    <Card class="gap-0 py-0">
      <CardHeader class="border-b px-4 py-3">
        <CardTitle class="text-sm">Où part chaque format</CardTitle>
        <CardDescription class="text-xs">Ex : seules les Alertes partent sur Discord</CardDescription>
      </CardHeader>
      <CardContent class="p-0">
        <Table class="text-xs">
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="pl-4 text-[10px] tracking-wider uppercase">Format</TableHead>
              <TableHead v-for="p in matrixPlatforms" :key="p" class="px-2 text-center text-[10px] tracking-wider uppercase">{{ p }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="f in store.formats" :key="f.id">
              <TableCell class="py-2 pl-4 pr-3 font-medium">{{ f.nom }}</TableCell>
              <TableCell v-for="p in matrixPlatforms" :key="p" class="px-2 py-2 text-center">
                <input type="checkbox" :checked="store.matrix[f.id]?.[p]" @change="toggleMatrix(f.id, p)" class="accent-primary" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Modal : réglages d'une plateforme -->
    <Dialog v-model:open="settingsOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Réglages — {{ labelOf(settingsFor) }}</DialogTitle>
        </DialogHeader>
        <div v-if="settingsFor" class="space-y-5">
          <div>
            <p class="mb-1.5 text-sm font-medium">Quand publier</p>
            <ButtonGroup class="h-8">
              <Button
                type="button"
                variant="outline"
                class="h-8 rounded-l-lg px-3 text-[11px] font-medium"
                :class="modeOf(settingsFor) === 'DIRECT' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''"
                @click="setMode(modeKeyOf(settingsFor), 'DIRECT')"
              >Tout de suite</Button>
              <Button
                type="button"
                variant="outline"
                class="h-8 px-3 text-[11px] font-medium"
                :class="modeOf(settingsFor) === 'SCHEDULED' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''"
                @click="setMode(modeKeyOf(settingsFor), 'SCHEDULED')"
              >Petit à petit</Button>
            </ButtonGroup>
            <p class="text-muted-foreground mt-1.5 text-[11px]">« Tout de suite » publie à la réception · « Petit à petit » espace les envois selon les délais réglés.</p>
          </div>

          <div v-for="f in fieldsFor(settingsFor)" :key="f.key" class="space-y-1.5">
            <p class="text-sm font-medium">{{ f.label }}</p>
            <Input
              :type="f.type ?? 'text'"
              :model-value="sec[f.key]?.value ?? ''"
              :placeholder="f.placeholder"
              @update:model-value="(v) => setField(f.key, String(v))"
            />
          </div>

          <div v-if="settingsFor === 'discord'" class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div>
              <p class="text-sm">Mode test Discord</p>
              <p class="text-muted-foreground text-xs">N'envoie pas réellement dans le salon</p>
            </div>
            <Switch :model-value="store.partage.discordTestMode" @update:model-value="(v: boolean) => { store.partage.discordTestMode = v; store.markDirty() }" />
          </div>

          <p v-if="fieldsFor(settingsFor).length === 0" class="text-muted-foreground text-xs italic">Aucune clé à configurer pour cette plateforme.</p>
          <p class="text-muted-foreground text-[10px]">Les clés restent dans daemon/config/.secrets.yaml — jamais dans git, jamais dans le localStorage.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="settingsOpen = false">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { SettingsIcon } from '@lucide/vue'
import { Button } from '../components/ui/button'
import { ButtonGroup } from '../components/ui/button-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Switch } from '../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { useConfigStore } from '../stores/config'

const store = useConfigStore()

// Champs secrets → store.secrets + sauvegarde (PATCH /api/secrets).
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

const settingsOpen = ref(false)
const settingsFor = ref<string | null>(null)
function openSettings(key: string) { settingsFor.value = key; settingsOpen.value = true }
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
  if (!store.matrix[formatId]) store.matrix[formatId] = {}
  store.matrix[formatId][platform] = !store.matrix[formatId]?.[platform]
  store.markDirty()
}
</script>
