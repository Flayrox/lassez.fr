<template>
  <Card class="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-card to-accent/10 shadow-sm py-0 gap-0">
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
            </div>
            <CardDescription class="text-[10px] text-muted-foreground">
              Contrôle total en langage naturel : création de pipelines, routage inter-bases, plannings, publications.
            </CardDescription>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <Button
            v-if="messages.length > 0"
            variant="ghost"
            size="xs"
            class="text-[10px] text-muted-foreground hover:text-foreground"
            @click="messages = []; lastResponse = null"
          >
            Effacer l'historique
          </Button>
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
      <!-- Historique conversationnel si déplié -->
      <div v-if="expanded && messages.length > 0" class="max-h-60 overflow-y-auto space-y-2 pr-1 rounded-lg bg-background/50 p-2.5 border border-border/50">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="flex flex-col gap-1 text-xs"
          :class="msg.role === 'user' ? 'items-end' : 'items-start'"
        >
          <div
            class="max-w-[85%] rounded-lg px-3 py-1.5 leading-relaxed"
            :class="msg.role === 'user' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted/80 text-foreground border border-border/60'"
          >
            <p class="whitespace-pre-line text-[11px]">{{ msg.content }}</p>
          </div>
          <span class="text-[9px] text-muted-foreground px-1 font-mono">
            {{ msg.role === 'user' ? 'Vous' : 'Assistant IA' }}
          </span>
        </div>
      </div>

      <!-- Champ de prompt principal -->
      <form @submit.prevent="submitPrompt" class="flex items-center gap-2">
        <div class="relative flex-1">
          <Input
            v-model="promptInput"
            placeholder="Ex: « Crée un pipeline Palestine et programme-le la semaine prochaine de 10h à 15h »..."
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

      <!-- Suggestions rapides en 1 clic -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[10px] text-muted-foreground font-medium">Exemples :</span>
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

      <!-- Résultat / Dernier retour IA -->
      <div v-if="lastResponse" class="rounded-lg border border-border/80 bg-background/90 p-3 text-xs shadow-xs space-y-2 animate-in fade-in slide-in-from-top-1">
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-primary text-[10px] font-semibold">
              <SparklesIcon data-icon class="size-3" />
              <span>Réponse du Pilote IA</span>
            </div>
            <p class="font-medium text-foreground text-[11px] leading-relaxed whitespace-pre-line">{{ lastResponse.reply }}</p>
          </div>
          <Button variant="ghost" size="icon-xs" class="text-muted-foreground hover:text-foreground" @click="lastResponse = null">
            <XIcon class="size-3" />
          </Button>
        </div>

        <!-- Badges d'actions appliquées -->
        <div v-if="lastResponse.actions_done?.length" class="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
          <Badge
            v-for="act in lastResponse.actions_done"
            :key="act"
            variant="secondary"
            class="font-mono text-[9px] font-semibold bg-accent/15 text-accent border-accent/30 py-0.5"
          >
            ✓ {{ act }}
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDownIcon, ChevronUpIcon, SendIcon, SparklesIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import { useConfigStore } from '../../stores/config'
import { usePipelinesStore } from '../../stores/pipelines'
import { api } from '../../lib/api'

const cfg = useConfigStore()
const pipes = usePipelinesStore()

const promptInput = ref('')
const loading = ref(false)
const expanded = ref(false)
const sessionId = ref(`sess_${Date.now()}`)
const messages = ref<{ role: 'user' | 'model'; content: string }[]>([])
const lastResponse = ref<any>(null)

const suggestions = [
  'Crée un pipeline Palestine & Anti-impérialisme programmé de 10h à 15h',
  'Programme Principal toutes les heures de 8h à 22h du lundi au vendredi',
  'Publie une alerte sur Twitter et Discord à 18h',
  'Transfère les articles FLASH vers le pipeline Flash',
]

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
    messages.value.push({ role: 'model', content: data.reply })

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
</script>
