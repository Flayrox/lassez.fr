// Champ unique du schema (récursif pour les listes). Look legacy (.si).
<template>
  <div>
    <!-- Texte court / long : RichText compact (préserve les marques) -->
    <template v-if="field.type === 'text' || field.type === 'longtext'">
      <label class="schema-label">{{ field.label }}</label>
      <RichText
        :doc="docValue"
        label="TEXTE"
        sticker-pos="-top-4 right-0"
        :content-class="field.type === 'longtext' ? 'si si-rich' : 'si si-rich si-single'"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => emit('live', d)"
      />
    </template>

    <!-- Couleur (+ nuancier brand) -->
    <template v-else-if="field.type === 'color'">
      <div class="flex items-center justify-between">
        <label class="schema-label !mb-0">{{ field.label }}</label>
        <div class="schema-colorbox">
          <input
            type="color" :value="colorValue"
            @pointerdown="gesture.onBegin" @focus="gesture.onBegin"
            @input="gesture.liveTemplate({ [field.key]: ($event.target as HTMLInputElement).value })"
            @change="gesture.onEnd" @blur="gesture.onEnd"
          />
          <span>{{ colorValue.toUpperCase() }}</span>
        </div>
      </div>
      <BrandSwatches :value="colorValue" class="mt-2" @select="(c) => emit('patch', c)" />
    </template>

    <!-- Nombre : slider + saisie (geste groupé) -->
    <template v-else-if="field.type === 'number'">
      <div class="flex items-center justify-between mb-1">
        <label class="schema-label !mb-0">{{ field.label }}</label>
        <input
          type="text" class="schema-minibox" :value="numberValue"
          @focus="gesture.onBegin"
          @input="gesture.liveTemplate({ [field.key]: toNumber(($event.target as HTMLInputElement).value) })"
          @change="gesture.onEnd" @blur="gesture.onEnd"
        />
      </div>
      <input
        v-if="!field.props?.hideSlider"
        type="range" class="w-full"
        :min="field.props?.min ?? 0" :max="field.props?.max ?? 100" :step="field.props?.step ?? 1"
        :value="numberValue"
        @pointerdown="gesture.onBegin" @focus="gesture.onBegin"
        @input="gesture.liveTemplate({ [field.key]: toNumber(($event.target as HTMLInputElement).value) })"
        @change="gesture.onEnd" @blur="gesture.onEnd"
      />
    </template>

    <!-- Image : URL + import local -->
    <template v-else-if="field.type === 'image'">
      <div class="flex items-center justify-between mb-1">
        <label class="schema-label !mb-0">{{ field.label }}</label>
        <button class="schema-mini-btn" :disabled="uploading" @click="fileInput?.click()">
          {{ uploading ? 'Upload…' : 'Importer' }}
        </button>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
      </div>
      <input
        type="text" class="si" placeholder="https://…" :value="stringValue"
        @focus="gesture.onBegin"
        @input="gesture.liveTemplate({ [field.key]: ($event.target as HTMLInputElement).value })"
        @change="gesture.onEnd" @blur="gesture.onEnd"
      />
      <img v-if="stringValue" :src="stringValue" alt="" class="mt-2 w-full h-20 object-cover border" style="border-color: #2a2a2a;" />
    </template>

    <!-- Select -->
    <template v-else-if="field.type === 'select'">
      <label class="schema-label">{{ field.label }}</label>
      <select class="si cursor-pointer" :value="stringValue" @change="emit('patch', ($event.target as HTMLSelectElement).value)">
        <option v-for="opt in field.options ?? []" :key="String(opt.value)" :value="String(opt.value)">{{ opt.label }}</option>
      </select>
    </template>

    <!-- Booléen : toggle -->
    <template v-else-if="field.type === 'boolean'">
      <div class="flex items-center justify-between">
        <label class="schema-label !mb-0">{{ field.label }}</label>
        <button class="schema-toggle" :class="{ 'is-on': boolValue }" @click="emit('patch', !boolValue)">
          <div class="schema-knob" />
        </button>
      </div>
    </template>

    <!-- Liste : items récursifs + ajout/suppression/réordre -->
    <template v-else-if="field.type === 'list'">
      <div class="flex items-center justify-between mb-2">
        <label class="schema-label !mb-0">{{ field.label }}</label>
        <button class="schema-mini-btn" @click="addItem">+ Ajouter</button>
      </div>
      <div class="flex flex-col gap-2">
        <div v-for="(item, i) in listValue" :key="i" class="schema-list-item">
          <div class="absolute top-1 right-1 flex gap-1 z-10">
            <button v-if="i > 0" class="schema-icon-btn" @click="moveItem(i, -1)">▲</button>
            <button v-if="i < listValue.length - 1" class="schema-icon-btn" @click="moveItem(i, 1)">▼</button>
            <button class="schema-icon-btn" @click="removeItem(i)">✕</button>
          </div>
          <SchemaField
            v-for="sub in field.itemSchema ?? []"
            :key="sub.key"
            :field="sub"
            :value="(item as Record<string, unknown>)[sub.key]"
            @patch="(v) => patchSub(i, sub.key, v)"
            @live="(v) => patchSub(i, sub.key, v)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import type { TemplateField } from '../types'
import RichText from '../text/RichText.vue'
import BrandSwatches from './BrandSwatches.vue'
import { fieldDoc } from '../text/fields'
import { useTemplateFields } from '../templates/useTemplateFields'
import { useGestureInput } from '../engine/gestures'
import { ASSETS_KEY, type AssetStore } from '../assets'

const props = defineProps<{ field: TemplateField; value: unknown }>()

const emit = defineEmits<{
  (e: 'patch', value: unknown): void
  (e: 'live', value: unknown): void
}>()

const { onFocus, onBlur } = useTemplateFields()
// Gestes continus (sliders, color, URL) : 1 undo par geste, jamais de
// checkpoint par tick — voir engine/gestures.ts.
const gesture = useGestureInput()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
// Bibliothèque fournie par Slide.vue : les imports deviennent des assets
// persistés (reload-safe). Sans provider (tests) : repli objectURL session.
const assetStore = inject<Ref<AssetStore | null>>(ASSETS_KEY, ref(null))

const docValue = computed(() => fieldDoc({ v: props.value }, 'v'))
const stringValue = computed(() => (typeof props.value === 'string' ? props.value : ''))
const boolValue = computed(() => props.value === true)
const numberValue = computed(() => (typeof props.value === 'number' && Number.isFinite(props.value) ? props.value : 0))
const colorValue = computed(() => (typeof props.value === 'string' && /^#[0-9a-f]{6}$/i.test(props.value) ? props.value : '#000000'))
const listValue = computed(() => (Array.isArray(props.value) ? (props.value as Record<string, unknown>[]) : []))

function toNumber(raw: string): number {
  const v = parseFloat(raw.replace(/[^0-9.\-]/g, ''))
  return Number.isNaN(v) ? 0 : v
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    if (assetStore.value) {
      const asset = await assetStore.value.add(file, file.name)
      emit('patch', asset.url)
    } else {
      emit('patch', URL.createObjectURL(file))
    }
  } catch {
    /* l'URL manuelle reste disponible dans le champ */
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function addItem() {
  const item: Record<string, unknown> = {}
  for (const f of props.field.itemSchema ?? []) {
    item[f.key] = f.type === 'color' ? '#888888' : f.type === 'number' ? 0 : f.type === 'boolean' ? false : ''
  }
  emit('patch', [...listValue.value, item])
}

function removeItem(i: number) {
  emit('patch', listValue.value.filter((_, idx) => idx !== i))
}

function moveItem(i: number, dir: 1 | -1) {
  const next = [...listValue.value]
  const j = i + dir
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j], next[i]]
  emit('patch', next)
}

function patchSub(i: number, key: string, v: unknown) {
  const next = [...listValue.value]
  next[i] = { ...next[i], [key]: v }
  emit('patch', next)
}
</script>

<style scoped>
.schema-label {
  display: block; font-size: 11px; font-weight: 500;
  color: #aaa; margin-bottom: 5px; font-family: 'Inter', system-ui, sans-serif;
}
.schema-colorbox {
  display: flex; align-items: center; gap: 8px;
  background: #0f0f0f; border: 1px solid #2a2a2a;
  padding: 5px 12px; border-radius: 8px;
}
.schema-colorbox input[type='color'] {
  width: 22px; height: 22px; background: none; border: none;
  cursor: pointer; padding: 0; border-radius: 4px;
}
.schema-colorbox span {
  font-size: 11px; font-family: 'Inter', monospace;
  color: #aaa; text-transform: uppercase; font-weight: 600;
}
.schema-minibox {
  width: 50px; background: #000; border: 1px solid #2a2a2a;
  color: #fff; font-size: 10px; padding: 2px 4px; border-radius: 4px;
  text-align: right; font-family: 'Inter', monospace;
}
.schema-mini-btn {
  background: #333; border: 1px solid #444; color: #fff;
  font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 4px;
  cursor: pointer; text-transform: uppercase;
}
.schema-mini-btn:hover { background: #444; }
.schema-toggle {
  width: 44px; height: 24px; position: relative;
  background: #222; border: 1px solid #2a2a2a; border-radius: 14px;
  cursor: pointer; flex-shrink: 0;
}
.schema-toggle.is-on { background: #fff; border-color: #fff; }
.schema-knob {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #666; transition: all 0.2s;
}
.schema-toggle.is-on .schema-knob { left: 23px; background: #000; }
.schema-list-item {
  background: #111; border: 1px solid #2a2a2a;
  border-radius: 10px; padding: 10px; position: relative;
  display: flex; flex-direction: column; gap: 8px;
}
.schema-icon-btn {
  background: none; border: none; color: #666;
  font-size: 10px; cursor: pointer; padding: 2px 4px;
}
.schema-icon-btn:hover { color: #fff; }
.si-rich { min-height: 64px; }
.si-rich.si-single { min-height: 34px; }
</style>
