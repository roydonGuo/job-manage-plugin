<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ value: string, animate: boolean }>()
const previous = ref(props.value)
const flipping = ref(false)
const revision = ref(0)

watch(() => props.value, (value, oldValue) => {
  previous.value = oldValue
  revision.value++
  flipping.value = props.animate && value !== oldValue
})
watch(() => props.animate, (enabled) => { if (!enabled) flipping.value = false })

function finish(currentRevision: number) {
  if (currentRevision === revision.value) flipping.value = false
}
</script>

<template>
  <span class="flip-digit" :data-flipping="flipping" :data-digit="value" aria-hidden="true">
    <span class="flip-half flip-half-top"><span class="flip-glyph">{{ value }}</span></span>
    <span class="flip-half flip-half-bottom"><span class="flip-glyph">{{ flipping ? previous : value }}</span></span>
    <template v-if="flipping" :key="revision">
      <span class="flip-half flip-half-top flip-leaf-top"><span class="flip-glyph">{{ previous }}</span></span>
      <span class="flip-half flip-half-bottom flip-leaf-bottom" @animationend.self="finish(revision)"><span class="flip-glyph">{{ value }}</span></span>
    </template>
  </span>
</template>
