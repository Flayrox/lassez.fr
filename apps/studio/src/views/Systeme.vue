<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold">Système</h1>
        <p class="text-muted-foreground mt-0.5 text-xs">Le studio en coulisses — simple et lisible</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" :disabled="system.loading" @click="refresh">
          <RefreshCwIcon data-icon="inline-start" />
          Rafraîchir
        </Button>
        <Button :disabled="system.scanning" @click="scan">
          <PlayIcon data-icon="inline-start" />
          Lancer un scan
        </Button>
      </div>
    </div>

    <!-- Télémétrie temps réel -->
    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Santé du système</CardTitle>
          <CardDescription>État de chaque brique du pipeline, mis à jour en direct</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="pt-4">
        <div v-if="system.error" class="text-destructive mb-3 text-xs">
          daemon injoignable — la télémétrie n'est pas disponible ({{ system.error }})
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="b in system.bricks" :key="b.type"
            class="bg-muted/30 flex flex-col gap-1.5 rounded-lg border border-border p-3">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-medium">{{ b.label }}</p>
              <span class="h-2 w-2 shrink-0 rounded-full" :class="dotClass(b.status)"></span>
            </div>
            <p class="text-muted-foreground text-[10px]">{{ statusLabel(b) }}</p>
            <p v-if="b.lastError" class="text-destructive line-clamp-2 text-[10px]" :title="b.lastError">{{ b.lastError }}</p>
            <p v-else-if="b.durationMs" class="text-muted-foreground text-[10px]">{{ b.durationMs }} ms</p>
          </div>
        </div>
        <div class="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
          <span>Uptime : <b class="text-foreground">{{ uptime }}</b></span>
          <span>Cycles : <b class="text-foreground">{{ cycles }}</b></span>
          <span>Dernier passage : <b class="text-foreground">{{ lastCycle }}</b></span>
          <span v-if="system.scanDone" class="text-emerald-400">⚡ Scan déclenché — le robot tourne en arrière-plan</span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Niveau de détail des journaux</CardTitle>
          <CardDescription>DEBUG = tout · INFO = normal · WARN = alertes · ERROR = que les problèmes</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="pt-4">
        <Select
          :model-value="store.systeme.niveauLogs"
          @update:model-value="(v) => { store.systeme.niveauLogs = v; store.markDirty() }"
        >
          <SelectTrigger class="h-8 w-full max-w-xs text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DEBUG">DEBUG</SelectItem>
            <SelectItem value="INFO">INFO</SelectItem>
            <SelectItem value="WARN">WARN</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>

    <div class="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader class="border-b">
          <div>
            <CardTitle>Garder les journaux combien de jours</CardTitle>
            <CardDescription>0 = pour toujours (déconseillé)</CardDescription>
          </div>
        </CardHeader>
        <CardContent class="pt-4">
          <Input
            type="number"
            class="max-w-[120px]"
            :model-value="store.systeme.garderLogsJours"
            @update:model-value="(v) => { store.systeme.garderLogsJours = Number(v); store.markDirty() }"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="border-b">
          <div>
            <CardTitle>Envoyer les journaux au tableau de bord</CardTitle>
            <CardDescription>Pour voir en direct si le robot tourne bien</CardDescription>
          </div>
        </CardHeader>
        <CardContent class="pt-4">
          <Switch :model-value="store.systeme.miroirLogs" @update:model-value="(v: boolean) => { store.systeme.miroirLogs = v; store.markDirty() }" />
        </CardContent>
      </Card>
    </div>

    <!-- Connexion qoe.fi — réelle -->
    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Connexion qoe.fi</CardTitle>
          <CardDescription>Là où partent les articles publiés</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="pt-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="h-2 w-2 rounded-full" :class="qoeMock ? 'bg-warning' : 'bg-emerald-500'"></span>
            <div>
              <p class="text-sm font-medium">{{ qoeMock ? 'Mode test' : 'Branché' }}</p>
              <p class="text-muted-foreground text-[11px]">
                {{ qoeMock ? 'Sans clé d\'API, les envois sont simulés. Colle ta clé ci-dessous pour publier pour de vrai.' : 'Les articles partent vers ta publication qoe.fi.' }}
              </p>
            </div>
          </div>
          <Badge :class="qoeMock ? 'border-warning/40 bg-warning/10 text-warning' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'">
            {{ qoeMock ? 'mock' : 'en ligne' }}
          </Badge>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="space-y-1.5">
            <Label class="text-xs">Clé d'API qoe.fi</Label>
            <Input type="password" :model-value="store.secrets.qoeApiKey"
              @update:model-value="(v: string) => { store.secrets.qoeApiKey = v; store.markDirty() }" />
            <p class="text-muted-foreground text-[11px]">Stockée dans .secrets.yaml — jamais dans git</p>
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">ID de publication</Label>
            <Input :model-value="store.secrets.qoePublicationId"
              @update:model-value="(v: string) => { store.secrets.qoePublicationId = v; store.markDirty() }" />
          </div>
        </div>
        <div class="mt-3 space-y-1.5">
          <Label class="text-xs">Base URL (avancé)</Label>
          <Input :model-value="store.secrets.qoeBaseUrl"
            @update:model-value="(v: string) => { store.secrets.qoeBaseUrl = v; store.markDirty() }" />
          <p class="text-muted-foreground text-[11px]">Par défaut https://api.qoe.fi/v1 — laisse tel quel sauf si tu sais</p>
        </div>
      </CardContent>
    </Card>

    <!-- Vertex AI (source principale) -->
    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Vertex AI (source principale)</CardTitle>
          <CardDescription>Compte de service Google Cloud — SOURCE PRINCIPALE des nœuds IA du pipeline (Tri, Orchestrateur, Rédaction)</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="pt-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="h-2 w-2 rounded-full" :class="vertexConfigured ? 'bg-emerald-500' : 'bg-border'"></span>
            <div>
              <p class="text-sm font-medium">{{ vertexConfigured ? 'Compte de service configuré' : 'Non configuré' }}</p>
              <p class="text-muted-foreground text-[11px]">
                {{ vertexConfigured
                  ? 'Vertex AI est utilisé en premier pour chaque appel IA — la recherche web continue de fonctionner. AI Studio ne prend le relais que si Vertex échoue.'
                  : 'Non configuré : le pipeline dépend de la clé AI Studio en repli. Colle le JSON ci-dessous pour faire de Vertex AI ta source principale (fiable, sans crédits AI Studio).' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="vertexTesting || !vertexConfigured" @click="testVertex">
              {{ vertexTesting ? 'Test…' : 'Tester Vertex AI' }}
            </Button>
            <Badge :class="vertexConfigured ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-warning/40 bg-warning/10 text-warning'">
              {{ vertexConfigured ? 'actif' : 'inactif' }}
            </Badge>
          </div>
        </div>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label class="text-xs">JSON du compte de service (le fichier .json téléchargé depuis Google Cloud)</Label>
            <Textarea
              :rows="5"
              class="font-mono text-xs"
              :model-value="vertexShown ? store.secrets.vertexServiceAccount : (vertexConfigured ? '••••••••  (JSON configuré — clique dans le champ pour le voir ou le remplacer)' : '')"
              @focus="vertexShown = true" @blur="vertexShown = false"
              @update:model-value="(v: string) => { store.secrets.vertexServiceAccount = v.trim(); store.markDirty() }"
              placeholder='{ "type": "service_account", "project_id": "…", … }'
            />
            <p class="text-muted-foreground text-[11px]">Google Cloud Console → IAM & Admin → Comptes de service → créer un compte → Clés → Ajouter une clé → JSON. Contient la clé privée — masqué par défaut. Stocké dans .secrets.yaml, jamais dans git.</p>
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">Région</Label>
            <Input placeholder="global" :model-value="store.secrets.vertexRegion"
              @update:model-value="(v: string) => { store.secrets.vertexRegion = v.trim() || 'global'; store.markDirty() }" />
            <p class="text-muted-foreground text-[11px]">global (recommandé) ou une région : us-central1, europe-west1… (selon où les modèles sont activés).</p>
          </div>
          <p v-if="vertexResult" class="text-xs" :class="vertexResult.ok ? 'text-emerald-400' : 'text-destructive'">
            {{ vertexResult.ok ? '✓ Vertex AI fonctionne' : '✗ ' + vertexResult.error }}
            <span v-if="vertexResult.ok" class="text-muted-foreground">· {{ vertexResult.latencyMs }} ms · {{ vertexResult.model }} · {{ vertexResult.project }}@{{ vertexResult.region }} · « {{ vertexResult.reply }} »</span>
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Clé API Gemini (repli) -->
    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Clé API Gemini (repli)</CardTitle>
          <CardDescription>Repli gratuit si Vertex AI est absent ou échoue (quota, erreur réseau)</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="pt-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="h-2 w-2 rounded-full" :class="geminiConfigured ? 'bg-warning' : 'bg-border'"></span>
            <div>
              <p class="text-sm font-medium">{{ geminiConfigured ? 'Clé configurée' : 'Aucune clé' }}</p>
              <p class="text-muted-foreground text-[11px]">
                {{ geminiConfigured
                  ? 'Utilisée en repli quand Vertex AI échoue. Sans Vertex configuré, c\'est elle qui fait tourner les nœuds IA.'
                  : 'Aucune clé de repli. Tant que Vertex AI (ci-dessus) est configuré, le pipeline tourne grâce à lui.' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="geminiTesting || !geminiConfigured" @click="testGeminiKey">
              {{ geminiTesting ? 'Test…' : 'Tester la clé' }}
            </Button>
            <Badge :class="geminiConfigured ? 'border-warning/40 bg-warning/10 text-warning' : 'bg-muted text-muted-foreground border border-border'">
              {{ geminiConfigured ? 'repli' : 'inactive' }}
            </Badge>
          </div>
        </div>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label class="text-xs">Clé API Gemini</Label>
            <Input type="password" placeholder="AIza…" :model-value="store.secrets.geminiApiKey"
              @update:model-value="(v: string) => { store.secrets.geminiApiKey = v.trim(); store.markDirty() }" />
            <p class="text-muted-foreground text-[11px]">Stockée dans .secrets.yaml (jamais dans git). Utilisée seulement si Vertex AI est absent ou échoue.</p>
          </div>
          <p v-if="geminiResult" class="text-xs" :class="geminiResult.ok ? 'text-emerald-400' : 'text-destructive'">
            {{ geminiResult.ok ? '✓ Clé valide' : '✗ ' + geminiResult.error }}
            <span v-if="geminiResult.ok" class="text-muted-foreground">· {{ geminiResult.latencyMs }} ms · {{ geminiResult.model }} · réponse : « {{ geminiResult.reply }} »</span>
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Recherche d'images (Google officiel)</CardTitle>
          <CardDescription>Le nœud Média illustre chaque article — avec cette clé il utilise l'API Google Images officielle (100 recherches gratuites/jour), sinon il retombe sur Wikimedia Commons.</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="space-y-3 pt-4">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-xs font-medium">{{ cseConfigured ? 'Recherche Google configurée' : 'Non configuré' }}</p>
            <p class="text-muted-foreground text-[11px]">
              {{ cseConfigured
                ? "Le nœud Média cherche les illustrations avec l'API officielle, puis Wikimedia en secours."
                : 'Sans clé, les illustrations viennent de Wikimedia Commons (gratuit, sans clé). Active la Custom Search JSON API pour de vraies images Google.' }}
            </p>
          </div>
          <Badge :class="cseConfigured ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-warning/40 bg-warning/10 text-warning'">
            {{ cseConfigured ? 'actif' : 'inactif' }}
          </Badge>
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">Clé API (Custom Search JSON API)</Label>
          <Input type="password" placeholder="AIza…" :model-value="store.secrets.googleCseApiKey"
            @update:model-value="(v: string) => { store.secrets.googleCseApiKey = v.trim(); store.markDirty() }" />
          <p class="text-muted-foreground text-[11px]">Google Cloud Console → APIs & Services → Custom Search API → Créer des identifiants → Clé API (gratuit, sans carte). Stockée dans .secrets.yaml, jamais dans git.</p>
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">ID du moteur de recherche (cx)</Label>
          <Input placeholder="0123456789abcdefg:hijklmnopqrst" :model-value="store.secrets.googleCseId"
            @update:model-value="(v: string) => { store.secrets.googleCseId = v.trim(); store.markDirty() }" />
          <p class="text-muted-foreground text-[11px]">programmablesearchengine.google.com → créer un moteur qui cherche TOUT le web → activer « Recherche d'images » → copier l'ID (cx).</p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Mode maintenance</CardTitle>
          <CardDescription>Remplace le site public par un écran « revenons bientôt »</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="space-y-3 pt-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium">Activer la maintenance</p>
          <Switch :model-value="store.systeme.maintenanceMode" @update:model-value="(v: boolean) => { store.systeme.maintenanceMode = v; store.markDirty() }" />
        </div>
        <div v-if="store.systeme.maintenanceMode" class="space-y-1.5">
          <Label class="text-xs">Message affiché</Label>
          <Textarea :rows="2" :model-value="store.systeme.maintenanceMessage"
            @update:model-value="(v: string) => { store.systeme.maintenanceMessage = v; store.markDirty() }" />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Popup de soutien</CardTitle>
          <CardDescription>S'affiche une fois par session sur le site public (bandeau don)</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="space-y-3 pt-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium">Activer la popup</p>
          <Switch :model-value="store.systeme.popupEnabled" @update:model-value="(v: boolean) => { store.systeme.popupEnabled = v; store.markDirty() }" />
        </div>
        <template v-if="store.systeme.popupEnabled">
          <div class="space-y-1.5">
            <Label class="text-xs">Titre</Label>
            <Input v-model="popupTitleProxy" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">Texte</Label>
            <Textarea :rows="2" v-model="popupTextProxy" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label class="text-xs">Libellé du bouton</Label>
              <Input v-model="popupLinkLabelProxy" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">Lien</Label>
              <Input v-model="popupLinkUrlProxy" />
              <p class="text-muted-foreground text-[11px]">Chemin interne ou URL complète</p>
            </div>
          </div>
          <!-- Aperçu -->
          <div class="bg-muted/30 max-w-xs rounded-lg border border-border p-4">
            <p class="text-muted-foreground mb-1.5 text-[9px] uppercase tracking-widest">Aperçu</p>
            <p class="text-sm font-semibold">{{ store.systeme.popupTitle }}</p>
            <p class="mt-1 text-xs">{{ store.systeme.popupText }}</p>
            <span class="bg-primary text-primary-foreground mt-3 inline-block rounded px-3 py-1.5 text-xs font-semibold">{{ store.systeme.popupLinkLabel }}</span>
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- Équipe (en attente de l'API qoe.fi pour le vrai CRUD) -->
    <Card>
      <CardHeader class="border-b">
        <div>
          <CardTitle>Équipe</CardTitle>
          <CardDescription>Qui peut toucher au studio (branché via qoe.fi prochainement)</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="pt-4">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>Membre</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Depuis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <div class="flex items-center gap-2.5">
                  <div class="from-emerald-500/60 to-sky-500/60 ring-border h-6 w-6 rounded-full bg-gradient-to-br ring-1"></div>
                  <div>
                    <p class="font-medium">Toi</p>
                    <p class="text-muted-foreground text-[10px]">ekedzah@gmail.com</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge class="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">Admin</Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">Le début</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="border-b">
        <CardTitle>Où tout est gardé</CardTitle>
      </CardHeader>
      <CardContent class="pt-4">
        <ul class="text-muted-foreground space-y-1.5 font-mono text-xs">
          <li><span class="text-foreground/50">Config</span> daemon/config/config.yaml</li>
          <li><span class="text-foreground/50">Secrets</span> daemon/config/.secrets.yaml (clés API, jamais dans git)</li>
          <li><span class="text-foreground/50">Données locales</span> data/pipeline.db (signaux, cycles, publications)</li>
          <li><span class="text-foreground/50">Articles publiés</span> api.qoe.fi (qoe.fi)</li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { PlayIcon, RefreshCwIcon } from '@lucide/vue'
import { useConfigStore } from '../stores/config'
import { useSystemStore } from '../stores/system'
import { api } from '../lib/api'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import { toast } from 'vue-sonner'

const store = useConfigStore()
const system = useSystemStore()

onMounted(() => system.fetchHealth())

async function refresh() { await system.fetchHealth() }
async function scan() {
  try {
    await system.triggerScan()
    await system.fetchHealth()
    setTimeout(() => system.fetchHealth(), 6000)
    toast.success('Scan lancé — le robot tourne en arrière-plan')
  } catch {
    toast.error('Impossible de lancer le scan — daemon injoignable')
  }
}

function dotClass(status: string): string {
  switch (status) {
    case 'ok': return 'bg-emerald-500'
    case 'warning': return 'bg-warning'
    case 'danger': return 'bg-destructive'
    default: return 'bg-border'
  }
}
function statusLabel(b: { status: string; lastRun?: string; errors?: number }): string {
  switch (b.status) {
    case 'ok': return 'OK · ' + relTime(b.lastRun ?? '')
    case 'warning': return `En échec (${b.errors ?? 1}) · ${relTime(b.lastRun ?? '')}`
    case 'danger': return `En panne (${b.errors ?? 3}) · ${relTime(b.lastRun ?? '')}`
    default: return 'Jamais exécuté'
  }
}

// ── Clé API Gemini : statut + test réel via le daemon (POST /api/gemini/test) ──
const geminiConfigured = computed(() => !!store.secrets.geminiApiKey)
const geminiTesting = ref(false)
const geminiResult = ref<{ ok: boolean; error?: string; latencyMs?: number; model?: string; reply?: string } | null>(null)

async function testGeminiKey() {
  geminiTesting.value = true
  geminiResult.value = null
  try {
    const res = await api('/api/gemini/test', { method: 'POST' })
    geminiResult.value = await res.json()
  } catch (e: any) {
    geminiResult.value = { ok: false, error: e?.message || String(e) }
  } finally {
    geminiTesting.value = false
  }
  if (geminiResult.value?.ok) toast.success(`Clé Gemini valide · ${geminiResult.value.latencyMs} ms`)
  else toast.error(geminiResult.value?.error ?? 'Test de clé échoué')
}

// ── Vertex AI (secours) : statut + test réel via le daemon (POST /api/vertex/test) ──
const vertexConfigured = computed(() => !!store.secrets.vertexServiceAccount)
const vertexShown = ref(false)
const cseConfigured = computed(() => !!store.secrets.googleCseApiKey && !!store.secrets.googleCseId)
const vertexTesting = ref(false)
const vertexResult = ref<{ ok: boolean; error?: string; latencyMs?: number; model?: string; project?: string; region?: string; reply?: string } | null>(null)

async function testVertex() {
  vertexTesting.value = true
  vertexResult.value = null
  try {
    const res = await api('/api/vertex/test', { method: 'POST' })
    vertexResult.value = await res.json()
  } catch (e: any) {
    vertexResult.value = { ok: false, error: e?.message || String(e) }
  } finally {
    vertexTesting.value = false
  }
  if (vertexResult.value?.ok) toast.success(`Vertex AI fonctionne · ${vertexResult.value.latencyMs} ms`)
  else toast.error(vertexResult.value?.error ?? 'Test Vertex échoué')
}

const qoeMock = computed(() => system.daemon?.qoeMock ?? true)
const uptime = computed(() => (system.daemon ? humanize(system.daemon.uptimeSeconds) : '—'))
const cycles = computed(() => (system.daemon ? String(system.daemon.cycleCount ?? 0) : '—'))
const lastCycle = computed(() => {
  const at = system.daemon?.lastCycleAt
  if (!at) return 'jamais'
  return relTime(at) + (system.daemon?.lastCycleError ? ` (erreur : ${system.daemon.lastCycleError})` : '')
})

function humanize(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '?'
  if (seconds < 60) return `${Math.floor(seconds)} s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} j ${h % 24} h`
}
function relTime(iso: string): string {
  if (!iso) return 'jamais'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1970) return 'jamais' // temps zéro Go
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (s < 60) return 'à l\'instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86_400)} j`
}

function proxy(key: string) {
  return computed({
    get: () => (store.systeme as any)[key],
    set: (v: string) => { (store.systeme as any)[key] = v; store.markDirty() },
  })
}
const popupTitleProxy = proxy('popupTitle')
const popupTextProxy = proxy('popupText')
const popupLinkLabelProxy = proxy('popupLinkLabel')
const popupLinkUrlProxy = proxy('popupLinkUrl')
</script>
