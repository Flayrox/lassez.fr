<script setup lang="ts">
import { ref, onErrorCaptured, watch } from 'vue'
import { useRoute } from 'vue-router'

// Garde-fou anti « page blanche » : si une vue plante pendant le rendu,
// on affiche un écran d'erreur avec un bouton de rechargement au lieu
// de laisser toute l'application disparaître.
const route = useRoute()
const error = ref<Error | null>(null)

onErrorCaptured((e: Error) => {
  console.error('[labo] erreur capturée:', e)
  error.value = e
  return false // on stoppe la propagation : on affiche notre fallback
})

// On repart de zéro dès qu'on change de page (l'erreur peut être ponctuelle)
watch(() => route.fullPath, () => { error.value = null })
</script>

<template>
  <div v-if="error" class="flex flex-col items-center justify-center gap-3 py-24 text-center">
    <span class="text-2xl">⚠️</span>
    <h2 class="text-sm font-semibold text-text-1">Cette page a rencontré un problème</h2>
    <p class="text-xs text-text-3 max-w-sm break-words font-mono">{{ error.message }}</p>
    <button
      @click="location.reload()"
      class="mt-2 inline-flex items-center justify-center gap-1.5 rounded px-3 h-8 text-xs font-medium bg-accent text-accent-fg hover:bg-accent-hover transition-colors"
    >
      ↻ Recharger
    </button>
  </div>
  <slot v-else />
</template>
