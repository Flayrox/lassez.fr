<!-- Diffusion — ce qui sort du pipeline : où et quand publier. 2 sous-onglets. -->
<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Diffusion</h1>
      <p class="text-xs text-text-3 mt-0.5">Où partent tes articles — règle tes plateformes (le planning vit dans « Emploi du temps »)</p>
    </div>

    <LCard :padding="false">
      <LTabs v-model="tab" :tabs="[
        { key: 'partage', label: 'Plateformes' },
      ]" />
      <div class="p-4">
        <Partage v-if="tab === 'partage'" />
      </div>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LCard from '../components/ui/LCard.vue'
import LTabs from '../components/ui/LTabs.vue'
import Partage from './Partage.vue'

const tab = ref('partage')
</script>