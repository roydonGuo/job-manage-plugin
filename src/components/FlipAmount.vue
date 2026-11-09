<script setup lang="ts">
import { computed } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import FlipDigit from './FlipDigit.vue'

const props = defineProps<{ value: string }>()
const reducedMotion = usePreferredReducedMotion()
// 从右侧对齐数字位置，9.99 -> 10.00 等进位不会让所有数字错位重建。
const characters = computed(() => [...props.value].map((value, index, values) => ({
  value, key: values.length - index - 1, digit: /\d/.test(value),
})))
</script>

<template>
  <span class="flip-amount" :data-value="value" aria-live="off">
    <span class="sr-only">{{ value }}</span>
    <template v-for="character in characters" :key="character.key">
      <FlipDigit v-if="character.digit" :value="character.value" :animate="reducedMotion !== 'reduce'" />
      <span v-else class="flip-punctuation" aria-hidden="true">{{ character.value }}</span>
    </template>
  </span>
</template>
