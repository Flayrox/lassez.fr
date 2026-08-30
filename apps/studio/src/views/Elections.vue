<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold">Élections</h1>
        <p class="text-muted-foreground mt-0.5 text-xs">Le front des résultats électoraux — un fichier SQLite par scrutin</p>
      </div>
      <Button variant="outline" :disabled="loading" @click="refresh">
        <RefreshCwIcon data-icon="inline-start" />
        Rafraîchir
      </Button>
    </div>

    <div v-if="error" class="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
      daemon injoignable — impossible de lire le registre ({{ error }})
    </div>

    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Scrutins</CardTitle>
          <CardDescription>Chaque scrutin = data/elections/{slug}.db + une entrée du registre (registry.json). « Affiché » le rend visible sur le site, « Cible » = la page d'accueil des élections.</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="pt-4">
        <div v-if="loading" class="text-muted-foreground py-4 text-xs">Chargement…</div>
        <Table v-else>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>Scrutin</TableHead>
              <TableHead>Communes</TableHead>
              <TableHead>Départements</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead>Affiché</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead class="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="e in elections" :key="e.slug">
              <TableCell>
                <p class="font-medium">{{ e.slug }}</p>
                <p v-if="!e.fileExists" class="text-warning text-[10px]">fichier absent — à créer</p>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ e.communes > 0 ? e.communes.toLocaleString('fr-FR') : '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ e.departments > 0 ? e.departments : '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ e.fileExists ? (e.fileSizeKb / 1024).toFixed(1) + ' Mo' : '—' }}</TableCell>
              <TableCell>
                <Switch :model-value="e.displayed" :disabled="busy" @update:model-value="(v: boolean) => setDisplay(e, v)" />
              </TableCell>
              <TableCell>
                <Badge v-if="e.isTarget" class="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">Cible</Badge>
                <Button v-else variant="outline" size="sm" :disabled="busy" @click="setTarget(e)">Définir</Button>
              </TableCell>
              <TableCell class="text-right">
                <Button variant="destructive" size="sm" :disabled="busy" @click="remove(e)">Supprimer</Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="!elections.length">
              <TableCell colspan="7" class="text-muted-foreground py-4 text-center">Aucun scrutin — crée le premier ci-dessous (il deviendra la cible).</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Ajouter un scrutin</CardTitle>
          <CardDescription>Crée le fichier {slug}.db (schéma élection vide) + l'affiche sur le site. Les résultats officiels seront synchronisés depuis data.gouv.fr.</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="flex flex-wrap items-end gap-3 pt-4">
        <div class="min-w-[240px] flex-1 space-y-1.5">
          <Label class="text-xs">Identifiant (slug)</Label>
          <Input
            placeholder="presidentielles-2027"
            :model-value="newSlug"
            @update:model-value="newSlug = $event.toLowerCase().replace(/[^a-z0-9-]/g, '')"
          />
          <p class="text-muted-foreground text-[11px]">Lettres, chiffres et tirets — il devient l'URL /elections/{slug}</p>
        </div>
        <Button :disabled="!canCreate || busy" @click="create">＋ Créer le scrutin</Button>
      </CardContent>
      <p v-if="createMsg" class="px-4 pb-4 text-xs" :class="createMsg.ok ? 'text-emerald-400' : 'text-destructive'">
        {{ createMsg.ok ? '✓ ' + createMsg.text : '✗ ' + createMsg.text }}
      </p>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshCwIcon } from '@lucide/vue'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

interface Election {
  slug: string
  displayed: boolean
  isTarget: boolean
  fileExists: boolean
  fileSizeKb: number
  communes: number
  departments: number
}

const loading = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const elections = ref<Election[]>([])
const newSlug = ref('')
const createMsg = ref<{ ok: boolean; text: string } | null>(null)

const canCreate = computed(() => /^[a-z0-9-]{3,40}$/.test(newSlug.value.trim()))

onMounted(refresh)

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch('/api/elections')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const y = await res.json()
    elections.value = y?.elections ?? []
  } catch (e: any) {
    error.value = e?.message || String(e)
    elections.value = []
  } finally {
    loading.value = false
  }
}

async function api(method: string, body?: object) {
  busy.value = true
  error.value = null
  try {
    const res = await fetch('/api/elections', {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const y = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(y?.error || `HTTP ${res.status}`)
    await refresh()
    return y
  } catch (e: any) {
    error.value = e?.message || String(e)
    return null
  } finally {
    busy.value = false
  }
}

async function create() {
  if (!canCreate.value) return
  createMsg.value = null
  const y = await api('POST', { slug: newSlug.value.trim(), display: true })
  if (y) {
    newSlug.value = ''
    createMsg.value = { ok: true, text: `Scrutin « ${y.slug} » créé et affiché.` }
  } else {
    createMsg.value = { ok: false, text: error.value ?? 'échec inconnu' }
  }
}

async function setDisplay(e: Election, v: boolean) {
  const y = await api('PATCH', { slug: e.slug, display: v })
  if (y) e.displayed = v
}

async function setTarget(e: Election) {
  await api('PATCH', { slug: e.slug, target: true })
}

async function remove(e: Election) {
  if (!confirm(`Supprimer le scrutin « ${e.slug} » ?\nLe fichier ${e.slug}.db sera effacé (les données officielles sont re-synchronisables).`)) return
  const res = await fetch(`/api/elections?slug=${encodeURIComponent(e.slug)}`, { method: 'DELETE' })
  const y = await res.json().catch(() => ({}))
  if (!res.ok) {
    error.value = y?.error || `HTTP ${res.status}`
    return
  }
  await refresh()
}
</script>
