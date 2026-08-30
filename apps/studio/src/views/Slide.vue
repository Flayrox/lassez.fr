<!-- Slide — produit à venir (sur-sidebar « Slide », hint bientôt).
     Page d'attente propre : rien n'est branché pour l'instant. -->
<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-lg font-semibold">Slide</h1>
      <p class="text-muted-foreground mt-0.5 text-xs">Génération de slides pour les réseaux sociaux — bientôt disponible.</p>
    </div>
    <Card>
      <CardContent class="flex flex-col items-center justify-center gap-2 py-14 text-center">
        <span class="text-3xl">🎞</span>
        <p class="text-sm font-medium">En construction</p>
        <p class="text-muted-foreground max-w-md text-xs leading-relaxed">
          Ce module servira à produire des visuels (carrousels, formats éditoriaux) à partir des
          publications validées. Il n'est pas encore branché — les autres sections du studio
          fonctionnent normalement.
        </p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Card, CardContent } from '../components/ui/card'
</script>
