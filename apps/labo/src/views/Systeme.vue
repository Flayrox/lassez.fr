<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold">Système</h1>
        <p class="text-xs text-text-3 mt-0.5">Le labo en coulisses — simple et lisible</p>
      </div>
      <div class="flex items-center gap-2">
        <LButton variant="secondary" :disabled="system.loading" @click="refresh">↻ Rafraîchir</LButton>
        <LButton :disabled="system.scanning" @click="scan">▶ Lancer un scan</LButton>
      </div>
    </div>

    <!-- Télémétrie temps réel -->
    <LCard title="Santé du système" description="État de chaque brique du pipeline, mis à jour en direct">
      <div v-if="system.error" class="text-xs text-danger mb-3">
        daemon injoignable — la télémétrie n'est pas disponible ({{ system.error }})
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="b in system.bricks" :key="b.type"
          class="rounded-card border border-border bg-bg p-3 flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium text-text-1">{{ b.label }}</p>
            <span class="w-2 h-2 rounded-full shrink-0" :class="dotClass(b.status)"></span>
          </div>
          <p class="text-[10px] text-text-3">{{ statusLabel(b) }}</p>
          <p v-if="b.lastError" class="text-[10px] text-danger line-clamp-2" :title="b.lastError">{{ b.lastError }}</p>
          <p v-else-if="b.durationMs" class="text-[10px] text-text-3">{{ b.durationMs }} ms</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[11px] text-text-3">
        <span>Uptime : <b class="text-text-1">{{ uptime }}</b></span>
        <span>Cycles : <b class="text-text-1">{{ cycles }}</b></span>
        <span>Dernier passage : <b class="text-text-1">{{ lastCycle }}</b></span>
        <span v-if="system.scanDone" class="text-accent">⚡ Scan déclenché — le robot tourne en arrière-plan</span>
      </div>
    </LCard>

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

    <!-- Connexion qoe.fi — réelle -->
    <LCard title="Connexion qoe.fi" description="Là où partent les articles publiés">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-3">
          <span class="w-2 h-2 rounded-full" :class="qoeMock ? 'bg-warning' : 'bg-accent'"></span>
          <div>
            <p class="text-sm font-medium">{{ qoeMock ? 'Mode test' : 'Branché' }}</p>
            <p class="text-[11px] text-text-3">
              {{ qoeMock ? 'Sans clé d\'API, les envois sont simulés. Colle ta clé ci-dessous pour publier pour de vrai.' : 'Les articles partent vers ta publication qoe.fi.' }}
            </p>
          </div>
        </div>
        <LBadge :variant="qoeMock ? 'warning' : 'success'">{{ qoeMock ? 'mock' : 'en ligne' }}</LBadge>
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        <LInput label="Clé d'API qoe.fi" type="password" :model-value="store.secrets.qoeApiKey"
          @update:model-value="(v: string) => { store.secrets.qoeApiKey = v; store.markDirty() }"
          help="Stockée dans .secrets.yaml — jamais dans git" />
        <LInput label="ID de publication" :model-value="store.secrets.qoePublicationId"
          @update:model-value="(v: string) => { store.secrets.qoePublicationId = v; store.markDirty() }" />
      </div>
      <LInput label="Base URL (avancé)" :model-value="store.secrets.qoeBaseUrl"
        @update:model-value="(v: string) => { store.secrets.qoeBaseUrl = v; store.markDirty() }"
        help="Par défaut https://api.qoe.fi/v1 — laisse tel quel sauf si tu sais" />
    </LCard>

    <!-- Clé API Gemini — les nœuds IA du pipeline (Tri / Rédaction / Vérification) -->
    <LCard title="Clé API Gemini" description="La clé qui fait tourner les nœuds IA du pipeline (Tri, Rédaction, Vérification)">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-3">
          <span class="w-2 h-2 rounded-full" :class="geminiConfigured ? 'bg-accent' : 'bg-warning'"></span>
          <div>
            <p class="text-sm font-medium">{{ geminiConfigured ? 'Clé configurée' : 'Aucune clé' }}</p>
            <p class="text-[11px] text-text-3">
              {{ geminiConfigured
                ? 'Les nœuds IA peuvent tourner. Sans clé valide, le Tri, la Rédaction et la Vérification sont ignorés.'
                : 'Sans clé, le pipeline s\'arrête après la collecte (rien n\'est trié ni rédigé). Colle ta clé ci-dessous.' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <LButton variant="secondary" size="sm" :disabled="geminiTesting || !geminiConfigured" @click="testGeminiKey">
            {{ geminiTesting ? 'Test…' : 'Tester la clé' }}
          </LButton>
          <LBadge :variant="geminiConfigured ? 'success' : 'warning'">{{ geminiConfigured ? 'active' : 'en pause' }}</LBadge>
        </div>
      </div>
      <div class="space-y-3">
        <LInput label="Clé API Gemini" type="password" :model-value="store.secrets.geminiApiKey"
          @update:model-value="(v: string) => { store.secrets.geminiApiKey = v.trim(); store.markDirty() }"
          placeholder="AIza…"
          help="Stockée dans .secrets.yaml (jamais dans git). Vide = pipeline sans IA." />
        <p v-if="geminiResult" class="text-xs" :class="geminiResult.ok ? 'text-accent' : 'text-danger'">
          {{ geminiResult.ok ? '✓ Clé valide' : '✗ ' + geminiResult.error }}
          <span v-if="geminiResult.ok" class="text-text-3">· {{ geminiResult.latencyMs }} ms · {{ geminiResult.model }} · réponse : « {{ geminiResult.reply }} »</span>
        </p>
      </div>
    </LCard>

    <!-- Vertex AI (secours) — compte de service Google Cloud : le chemin fiable quand la clé AI Studio est épuisée -->
    <LCard title="Vertex AI (secours)" description="Compte de service Google Cloud — utilisé automatiquement quand la clé AI Studio échoue (quota, crédits épuisés, clé invalide)">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-3">
          <span class="w-2 h-2 rounded-full" :class="vertexConfigured ? 'bg-accent' : 'bg-border'"></span>
          <div>
            <p class="text-sm font-medium">{{ vertexConfigured ? 'Compte de service configuré' : 'Non configuré' }}</p>
            <p class="text-[11px] text-text-3">
              {{ vertexConfigured
                ? 'Le pipeline bascule automatiquement sur Vertex AI si la clé AI Studio échoue — la recherche web continue de fonctionner.'
                : 'Sans compte de service, le pipeline dépend uniquement de la clé AI Studio. Colle le JSON ci-dessous pour activer le secours.' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <LButton variant="secondary" size="sm" :disabled="vertexTesting || !vertexConfigured" @click="testVertex">
            {{ vertexTesting ? 'Test…' : 'Tester Vertex AI' }}
          </LButton>
          <LBadge :variant="vertexConfigured ? 'success' : 'warning'">{{ vertexConfigured ? 'actif' : 'inactif' }}</LBadge>
        </div>
      </div>
      <div class="space-y-3">
        <LTextarea label="JSON du compte de service (le fichier .json téléchargé depuis Google Cloud)" :rows="5"
          :model-value="store.secrets.vertexServiceAccount"
          @update:model-value="(v: string) => { store.secrets.vertexServiceAccount = v.trim(); store.markDirty() }"
          placeholder='{ "type": "service_account", "project_id": "…", … }'
          help="Google Cloud Console → IAM & Admin → Comptes de service → créer un compte → Clés → Ajouter une clé → JSON. Stocké dans .secrets.yaml, jamais dans git." />
        <LInput label="Région" :model-value="store.secrets.vertexRegion"
          @update:model-value="(v: string) => { store.secrets.vertexRegion = v.trim() || 'global'; store.markDirty() }"
          placeholder="global"
          help="global (recommandé) ou une région : us-central1, europe-west1… (selon où les modèles sont activés)." />
        <p v-if="vertexResult" class="text-xs" :class="vertexResult.ok ? 'text-accent' : 'text-danger'">
          {{ vertexResult.ok ? '✓ Vertex AI fonctionne' : '✗ ' + vertexResult.error }}
          <span v-if="vertexResult.ok" class="text-text-3">· {{ vertexResult.latencyMs }} ms · {{ vertexResult.model }} · {{ vertexResult.project }}@{{ vertexResult.region }} · « {{ vertexResult.reply }} »</span>
        </p>
      </div>
    </LCard>

    <LCard title="Mode maintenance" description="Remplace le site public par un écran « revenons bientôt »">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium">Activer la maintenance</p>
          <LToggle :model-value="store.systeme.maintenanceMode" @update:model-value="(v: boolean) => { store.systeme.maintenanceMode = v; store.markDirty() }" />
        </div>
        <LTextarea v-if="store.systeme.maintenanceMode" v-model="store.systeme.maintenanceMessage" :rows="2" label="Message affiché" />
      </div>
    </LCard>

    <LCard title="Popup de soutien" description="S'affiche une fois par session sur le site public (bandeau don)">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium">Activer la popup</p>
          <LToggle :model-value="store.systeme.popupEnabled" @update:model-value="(v: boolean) => { store.systeme.popupEnabled = v; store.markDirty() }" />
        </div>
        <template v-if="store.systeme.popupEnabled">
          <LInput label="Titre" v-model="popupTitleProxy" />
          <LTextarea label="Texte" :rows="2" v-model="popupTextProxy" />
          <div class="grid grid-cols-2 gap-3">
            <LInput label="Libellé du bouton" v-model="popupLinkLabelProxy" />
            <LInput label="Lien" help="Chemin interne ou URL complète" v-model="popupLinkUrlProxy" />
          </div>
          <!-- Aperçu -->
          <div class="border border-border rounded-card p-4 bg-bg max-w-xs">
            <p class="text-[9px] uppercase tracking-widest text-text-3 mb-1.5">Aperçu</p>
            <p class="text-sm font-semibold">{{ store.systeme.popupTitle }}</p>
            <p class="text-xs text-text-2 mt-1">{{ store.systeme.popupText }}</p>
            <span class="inline-block mt-3 px-3 py-1.5 bg-accent text-accent-fg text-xs font-semibold rounded">{{ store.systeme.popupLinkLabel }}</span>
          </div>
        </template>
      </div>
    </LCard>

    <!-- Équipe (en attente de l'API qoe.fi pour le vrai CRUD) -->
    <LCard title="Équipe" description="Qui peut toucher au labo (branché via qoe.fi prochainement)">
      <table class="w-full text-left text-xs">
        <thead><tr class="text-[10px] uppercase tracking-wider text-text-3 border-b border-border">
          <th class="px-4 py-2 font-medium">Membre</th>
          <th class="py-2 pr-3 font-medium">Rôle</th>
          <th class="py-2 pr-3 font-medium">Depuis</th>
        </tr></thead>
        <tbody>
          <tr class="border-b border-border/50">
            <td class="px-4 py-2.5 flex items-center gap-2.5">
              <div class="w-6 h-6 rounded-full bg-gradient-to-br from-accent/60 to-info/60 ring-1 ring-border"></div>
              <div><p class="font-medium text-text-1">Toi</p><p class="text-[10px] text-text-3">ekedzah@gmail.com</p></div>
            </td>
            <td class="py-2.5 pr-3"><LBadge variant="accent">Admin</LBadge></td>
            <td class="py-2.5 pr-3 text-text-3">Le début</td>
          </tr>
        </tbody>
      </table>
    </LCard>

    <LCard title="Où tout est gardé">
      <ul class="text-xs text-text-2 space-y-1.5 font-mono">
        <li><span class="text-text-3">Config</span> daemon/config/config.yaml</li>
        <li><span class="text-text-3">Secrets</span> daemon/config/.secrets.yaml (clés API, jamais dans git)</li>
        <li><span class="text-text-3">Données locales</span> data/radar.db (signaux, archives, élections)</li>
        <li><span class="text-text-3">Articles publiés</span> api.qoe.fi (qoe.fi)</li>
      </ul>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConfigStore } from '../stores/config'
import { useSystemStore } from '../stores/system'
import LCard from '../components/ui/LCard.vue'
import LToggle from '../components/ui/LToggle.vue'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LInput from '../components/ui/LInput.vue'
import LTextarea from '../components/ui/LTextarea.vue'

const store = useConfigStore()
const system = useSystemStore()

onMounted(() => system.fetchHealth())

async function refresh() { await system.fetchHealth() }
async function scan() {
  await system.triggerScan()
  await system.fetchHealth()
  setTimeout(() => system.fetchHealth(), 6000)
}

function dotClass(status: string): string {
  switch (status) {
    case 'ok': return 'bg-accent'
    case 'warning': return 'bg-warning'
    case 'danger': return 'bg-danger'
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
    const res = await fetch('/api/gemini/test', { method: 'POST' })
    geminiResult.value = await res.json()
  } catch (e: any) {
    geminiResult.value = { ok: false, error: e?.message || String(e) }
  } finally {
    geminiTesting.value = false
  }
}

// ── Vertex AI (secours) : statut + test réel via le daemon (POST /api/vertex/test) ──
const vertexConfigured = computed(() => !!store.secrets.vertexServiceAccount)
const vertexTesting = ref(false)
const vertexResult = ref<{ ok: boolean; error?: string; latencyMs?: number; model?: string; project?: string; region?: string; reply?: string } | null>(null)

async function testVertex() {
  vertexTesting.value = true
  vertexResult.value = null
  try {
    const res = await fetch('/api/vertex/test', { method: 'POST' })
    vertexResult.value = await res.json()
  } catch (e: any) {
    vertexResult.value = { ok: false, error: e?.message || String(e) }
  } finally {
    vertexTesting.value = false
  }
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
