// Couche forme libre (rect / ellipse / ligne / flèche) en SVG.
<template>
  <div
    class="absolute slide-layer-view"
    :style="boxStyle"
    @pointerdown.stop="onSelect"
  >
    <svg :width="layer.w" :height="layer.h" class="block overflow-visible">
      <rect
        v-if="shape === 'rect'"
        x="0" y="0" :width="layer.w" :height="layer.h"
        :fill="fill" :stroke="stroke" :stroke-width="strokeWidth"
      />
      <ellipse
        v-else-if="shape === 'ellipse'"
        :cx="layer.w / 2" :cy="layer.h / 2" :rx="layer.w / 2" :ry="layer.h / 2"
        :fill="fill" :stroke="stroke" :stroke-width="strokeWidth"
      />
      <line
        v-else-if="shape === 'line'"
        x1="0" :y1="layer.h / 2" :x2="layer.w" :y2="layer.h / 2"
        :stroke="stroke" :stroke-width="strokeWidth * 2" stroke-linecap="round"
      />
      <g v-else>
        <line
          x1="0" :y1="layer.h / 2" :x2="layer.w - 14" :y2="layer.h / 2"
          :stroke="stroke" :stroke-width="strokeWidth * 2" stroke-linecap="round"
        />
        <polygon
          :points="`${layer.w - 16},2 ${layer.w},${layer.h / 2} ${layer.w - 16},${layer.h - 2}`"
          :fill="stroke"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Layer, ShapeLayerData } from '../types'

const props = defineProps<{ layer: Layer }>()

const emit = defineEmits<{ (e: 'select', id: string, additive: boolean): void }>()

const data = computed(() => props.layer.data as ShapeLayerData)
const shape = computed(() => data.value.shape ?? 'rect')
const fill = computed(() => data.value.fill ?? '#DC2626')
const stroke = computed(() => data.value.stroke ?? '#000000')
const strokeWidth = computed(() => data.value.strokeWidth ?? 4)

const boxStyle = computed(() => ({
  left: `${props.layer.x}px`,
  top: `${props.layer.y}px`,
  width: `${props.layer.w}px`,
  height: `${props.layer.h}px`,
  opacity: String(props.layer.opacity),
  transform: props.layer.rotation ? `rotate(${props.layer.rotation}deg)` : undefined,
  cursor: 'move',
}))

function onSelect(e: PointerEvent) {
  emit('select', props.layer.id, e.shiftKey || e.ctrlKey || e.metaKey)
}
</script>
