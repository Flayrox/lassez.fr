<template>
  <Card class="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-card to-accent/10 shadow-sm py-0 gap-0">
    <!-- En-tête -->
    <CardHeader class="px-4 py-3 border-b border-border/40">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5">
          <div class="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <SparklesIcon data-icon class="size-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <CardTitle class="text-xs font-bold tracking-tight">Pilote IA — Vertex AI</CardTitle>
              <Badge variant="secondary" class="font-mono text-[9px] px-1.5 h-4 bg-primary/20 text-primary border-primary/30">
                gemini-3.5-flash-lite
              </Badge>
              <Badge variant="outline" class="text-[9px] px-1.5 h-4 border-muted-foreground/30 text-muted-foreground">
                DB persistante
              </Badge>
            </div>
            <CardDescription class="text-[10px] text-muted-foreground">
              Assistant autonome, multi-discussions persistantes, création de pipelines et gestion d'agenda.
            </CardDescription>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- Sélecteur de conversations -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="xs" class="h-7 gap-1 text-[10px] bg-background/80">
                <HistoryIcon data-icon class="size-3" />
                <span class="max-w-[100px] truncate">{{ currentSessionTitle }}</span>
                <ChevronDownIcon class="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56 text-xs">
              <DropdownMenuLabel class="text-[10px] text-muted-foreground">Historique des discussions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="createNewSession" class="gap-1.5 text-primary font-medium cursor-pointer">
                <PlusIcon class="size-3.5" />
                <span>Nouvelle discussion</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div v-if="sessions.length === 0" class="p-2 text-center text-[10px] text-muted-foreground">
                Aucune discussion enregistrée
              </div>
              <DropdownMenuItem
                v-for="s in sessions"
                :key="s.id"
                class="flex items-center justify-between gap-2 cursor-pointer"
                :class="s.id === sessionId ? 'bg-accent/15 font-semibold text-accent' : ''"
                @click="switchSession(s.id)"
              >
                <span class="truncate flex-1 text-[11px]">{{ s.title }}</span>
                <button
                  type="button"
                  class="text-muted-foreground hover:text-destructive p-0.5 rounded"
                  @click.stop="deleteSession(s.id)"
                  title="Supprimer la discussion"
                >
                  <TrashIcon class="size-3" />
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-xs"
            class="text-muted-foreground"
            @click="expanded = !expanded"
            :title="expanded ? 'Réduire la vue' : 'Déplier l\'historique du chat'"
          >
            <ChevronUpIcon v-if="expanded" />
            <ChevronDownIcon v-else />
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-3.5 space-y-3">
      <!-- Vue des messages (déroulable) -->
      <div v-if="expanded || messages.length > 0" class="max-h-72 overflow-y-auto space-y-2.5 pr-1 rounded-lg bg-background/50 p-2.5 border border-border/50">
        <div v-if="messages.length === 0" class="py-6 text-center text-xs text-muted-foreground">
          <SparklesIcon class="size-6 mx-auto mb-1.5 opacity-40 text-primary" />
          <p class="font-medium text-foreground">Discussion prête</p>
          <p class="text-[10px]">Donnez un ordre pour configurer vos plannings ou créer un pipeline.</p>
        </div>

        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="flex flex-col gap-1 text-xs"
          :class="msg.role === 'user' ? 'items-end' : 'items-start'"
        >
          <div
            class="max-w-[85%] rounded-lg px-3 py-2 leading-relaxed shadow-2xs"
            :class="msg.role === 'user' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted/90 text-foreground border border-border/60'"
          >
            <p class="whitespace-pre-line text-[11px]">{{ msg.content }}</p>
            <div v-if="msg.action" class="mt-1.5 pt-1 border-t border-border/40 flex flex-wrap gap-1">
              <span class="text-[9px] font-mono text-accent font-semibold">✓ {{ msg.action }}</span>
            </div>
          </div>
          <span class="text-[9px] text-muted-foreground px-1 font-mono">
            {{ msg.role === 'user' ? 'Vous' : 'Pilote IA' }}
          </span>
        </div>
      </div>

      <!-- Champ de saisie -->
      <form @submit.prevent="submitPrompt" class="flex items-center gap-2">
        <div class="relative flex-1">
          <Input
            v-model="promptInput"
            placeholder="Ex: « Programme Principal toutes les heures de 8h à 22h » ou « Crée un pipeline Palestine »..."
            class="h-9 pr-8 text-xs bg-background/90 focus-visible:ring-primary backdrop-blur"
            :disabled="loading"
          />
          <button
            v-if="promptInput"
            type="button"
            class="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            @click="promptInput = ''"
          >
            <XIcon class="size-3.5" />
          </button>
        </div>

        <Button size="sm" type="submit" class="h-9 px-4 font-medium gap-1.5" :disabled="loading || !promptInput.trim()">
          <Spinner v-if="loading" class="size-3.5" />
          <SendIcon v-else data-icon class="size-3.5" />
          <span>Envoyer</span>
        </Button>
      </form>

      <!-- Suggestions rapides -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[10px] text-muted-foreground font-medium">Idées :</span>
        <button
          v-for="sug in suggestions"
          :key="sug"
          type="button"
          class="rounded-md border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground transition-colors"
          @click="promptInput = sug; submitPrompt()"
        >
          {{ sug }}
        </button>
      </div>

      <!-- Dernier retour avec actions exécutées -->
      <div v-if="lastResponse && !expanded" class="rounded-lg border border-border/80 bg-background/90 p-2.5 text-xs shadow-xs space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <p class="font-medium text-foreground text-[11px] leading-relaxed whitespace-pre-line">{{ lastResponse.reply }}</p>
          <Button variant="ghost" size="icon-xs" class="text-muted-foreground" @click="lastResponse = null">
            <XIcon class="size-3" />
          </Button>
        </div>
        <div v-if="lastResponse.actions_done?.length" class="flex flex-wrap gap-1 pt-1 border-t border-border/40">
          <Badge
            v-for="act in lastResponse.actions_done"
            :key="act"
            variant="secondary"
            class="font-mono text-[9px] font-semibold bg-accent/15 text-accent border-accent/30"
          >
            ✓ {{ act }}
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  HistoryIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import { useConfigStore } from '../../stores/config'
import { usePipelinesStore } from '../../stores/pipelines'
import { api } from '../../lib/api'

interface ChatSessionItem {
  id: string
  title: string
  pipeline_id: string
  updated_at: string
}

interface ChatMsg {
  role: 'user' | 'model'
  content: string
  action?: string
}

const cfg = useConfigStore()
const pipes = usePipelinesStore()

const promptInput = ref('')
const loading = ref(false)
const expanded = ref(false)
const sessionId = ref(localStorage.getItem('studio_ai_session_id') || `sess_${Date.now()}`)
const sessions = ref<ChatSessionItem[]>([])
const messages = ref<ChatMsg[]>([])
const lastResponse = ref<any>(null)

const currentSessionTitle = computed(() => {
  const current = sessions.value.find(s => s.id === sessionId.value)
  return current ? current.title : 'Discussion en cours'
})

const suggestions = [
  'Programme Principal toutes les heures de 8h à 22h du lundi au vendredi',
  'Crée un pipeline Palestine & Anti-impérialisme programmé de 10h à 15h',
  'Publie une alerte sur Twitter et Discord à 18h',
  'Transfère les articles FLASH vers le pipeline Flash',
]

async function loadSessions() {
  try {
    const res = await api(`/api/assistant/sessions?pipeline_id=${cfg.activePipelineId || 'principal'}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data?.data)) {
        sessions.value = data.data
      }
    }
  } catch {}
}

async function loadHistory(sid: string) {
  try {
    const res = await api(`/api/assistant/history?session_id=${sid}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data?.data)) {
        messages.value = data.data.map((m: any) => ({
          role: m.role,
          content: m.content,
          action: m.action,
        }))
      }
    }
  } catch {}
}

function createNewSession() {
  const newId = `sess_${Date.now()}`
  sessionId.value = newId
  localStorage.setItem('studio_ai_session_id', newId)
  messages.value = []
  lastResponse.value = null
  toast.info('Nouvelle discussion démarrée')
}

async function switchSession(id: string) {
  sessionId.value = id
  localStorage.setItem('studio_ai_session_id', id)
  lastResponse.value = null
  await loadHistory(id)
}

async function deleteSession(id: string) {
  try {
    const res = await api(`/api/assistant/sessions?session_id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      sessions.value = sessions.value.filter(s => s.id !== id)
      if (sessionId.value === id) {
        createNewSession()
      }
      toast.success('Discussion supprimée')
    }
  } catch {
    toast.error('Erreur lors de la suppression')
  }
}

async function submitPrompt() {
  const text = promptInput.value.trim()
  if (!text || loading.value) return

  loading.value = true
  promptInput.value = ''
  messages.value.push({ role: 'user', content: text })

  try {
    const res = await api('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId.value,
        message: text,
        active_pipeline_id: cfg.activePipelineId || 'principal',
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || `Erreur serveur HTTP ${res.status}`)
    }

    const data = await res.json()
    lastResponse.value = data
    messages.value.push({
      role: 'model',
      content: data.reply,
      action: data.actions_done?.join(', '),
    })

    await loadSessions()

    if (data.updated_state) {
      toast.success('Actions exécutées avec succès sur les pipelines')
      await Promise.all([pipes.refresh(true), cfg.loadFromDaemon()])
    }
  } catch (err: any) {
    toast.error(err.message || 'Erreur de communication avec l\'assistant IA')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadSessions(), loadHistory(sessionId.value)])
})
</script>
