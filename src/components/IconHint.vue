<script setup lang="ts">
import type { Component } from 'vue'
import Hint from './Hint.vue'
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ icon: Component, label: string, iconClass?: string, focusable?: boolean }>(), { focusable: true })
</script>

<template>
  <Hint :label="label">
    <span v-bind="$attrs" role="img" :aria-label="label" :tabindex="focusable ? 0 : undefined" class="inline-flex shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
      <component :is="icon" :class="iconClass ?? 'size-3.5'" aria-hidden="true" />
    </span>
  </Hint>
</template>
