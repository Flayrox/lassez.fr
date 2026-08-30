<template>
  <div class="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-accent/10 p-3.5 shadow-sm">
    <!-- En-tête Assistant -->
    <div class="flex items-center justify-between gap-2 mb-2.5">
      <div class="flex items-center gap-2">
        <div class="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
          <SparklesIcon class="size-3.5" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold tracking-tight">Pilote IA — Vertex AI</span>
            <Badge variant="secondary" class="font-mono text-[9px] px-1 h-4 bg-primary/20 text-primary border-primary/30">
              gemini-3.5-flash-lite
            </Badge>
          </div>
          <p class="text-[10px] text-muted-foreground">Contrôle total en langage naturel : planning, fréquences, plateformes, scans et routage</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="messages.length > 0"
          type="button"
          class="text-[10px] text-muted-foreground hover:text-foreground underline"
          @click="messages = []"
        >
          Effacer l'historique
        </button>
      </div>
    </div>

    <!-- Champ de commande naturel -->
    <form @submit.prevent="submitPrompt" class="relative flex items-center gap-2">
      <div class="relative flex-1">
        <Input
          v-model="promptInput"
          placeholder="Ex: « Programme le pipeline principal toutes les heures de 8h à 22h du lundi au vendredi »..."
          class="h-9 pr-8 text-xs bg-background/80 focus-visible:ring-primary backdrop-blur"
          :disabled="loading"
        />
        <button
          v-if="promptInput"
          type="button"
          class="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
          @click="promptInput = ''"
        >
          <XIcon class="size-3.5" />
        </button>
      </div>

      <Button size="sm" type="submit" class="h-9 px-4 gap-1.5 font-medium" :disabled="loading || !promptInput.trim()">
        <Spinner v-if="loading" class="size-3.5" />
        <SendIcon v-else class="size-3.5" />
        <span>Envoyer</span>
      </Button>
    </form>

    <!-- Suggestions rapides cliquables -->
    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      <span class="text-[10px] text-muted-foreground font-medium">Exemples :</span>
      <button
        v-for="sug in suggestions"
        :key="sug"
        type="button"
        class="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground transition-colors"
        @click="promptInput = sug; submitPrompt()"
      >
        {{ sug }}
      </button>
    </div>

    <!-- Dernier retour IA avec actions exécutées -->
    <div v-if="lastResponse" class="mt-3 rounded-lg border border-border/80 bg-background/90 p-2.5 text-xs shadow-xs space-y-1.5 animate-in fade-in slide-in-from-top-1">
      <div class="flex items-start justify-between gap-2">
        <p class="font-medium text-foreground text-[11px] leading-relaxed">{{ lastResponse.reply }}</p>
        <button type="button" class="text-muted-foreground hover:text-foreground" @click="lastResponse = null">
          <XIcon class="size-3" />
        </button>
      </div>

      <div v-if="lastResponse.actions_done?.length" class="flex flex-wrap gap-1 pt-1 border-t border-border/40">
        <span
          v-for="act in lastResponse.actions_done"
          :key="act"
          class="inline-flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-accent"
        >
          ✓ {{ act }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { SendIcon, SparklesIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import { useConfigStore } from '../../stores/config'
import { usePipelinesStore } from '../../stores/pipelines'
import { api } from '../../lib/api'

const cfg = useConfigStore()
const pipes = usePipelinesStore()

const promptInput = ref('')
const loading = ref(false)
const sessionId = ref(`sess_${Date.now()}`)
const messages = ref<{ role: string; content: string }[]>([])
const lastResponse = ref<any>(null)

const suggestions = [
  'Programme Principal toutes les heures de 8h à 22h du lundi au vendredi',
  'Ajoute un scan ponctuel demain à 07h30 pour Flash',
  'Publie une alerte sur Twitter et Discord à 18h',
  'Réinitialise tous les créneaux de Principal',
]

async function submitPrompt() {
  const text = promptInput.value.trim()
  if (!text || loading.value) return

  loading.value = true
  promptInput.value = ''

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

    if (data.updated_state) {
      toast.success('Actions appliquées au calendrier et aux pipelines')
      await Promise.all([pipes.refresh(true), cfg.loadFromDaemon()])
    }
  } catch (err: any) {
    toast.error(err.message || 'Erreur lors de la communication avec l\'assistant IA')
  } finally {
    loading.value = false
  }
}
</script>
