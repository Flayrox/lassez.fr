<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Équipe</h1>
        <p class="text-xs text-text-3 mt-0.5">Qui peut toucher au labo</p>
      </div>
      <LButton>+ Inviter</LButton>
    </div>

    <LCard :padding="false" title="Membres">
      <table class="w-full text-left text-xs">
        <thead><tr class="text-[10px] uppercase tracking-wider text-text-3 border-b border-border">
          <th class="px-4 py-2 font-medium">Membre</th>
          <th class="py-2 pr-3 font-medium">Rôle</th>
          <th class="py-2 pr-3 font-medium">Depuis</th>
          <th></th>
        </tr></thead>
        <tbody>
          <tr v-for="m in members" :key="m.email" class="border-b border-border/50 hover:bg-surface-hover/40 transition-colors">
            <td class="px-4 py-2.5 flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-accent/60 to-info/60 ring-1 ring-border"></div>
              <div>
                <p class="font-medium text-text-1">{{ m.name }}</p>
                <p class="text-[11px] text-text-3">{{ m.email }}</p>
              </div>
            </td>
            <td class="py-2.5 pr-3"><LBadge :variant="m.role === 'admin' ? 'accent' : 'neutral'">{{ roleLabel(m.role) }}</LBadge></td>
            <td class="py-2.5 pr-3 text-text-3">{{ m.since }}</td>
            <td class="py-2 pr-3"><LButton v-if="m.role !== 'admin'" variant="ghost">Retirer</LButton></td>
          </tr>
        </tbody>
      </table>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LButton from '../components/ui/LButton.vue'

const members = [
  { name: 'Toi', email: 'ekedzah@gmail.com', role: 'admin', since: 'Le début' },
]
function roleLabel(r: string) {
  return r === 'admin' ? 'Admin' : r === 'editor' ? 'Rédacteur' : 'Observateur'
}
</script>
