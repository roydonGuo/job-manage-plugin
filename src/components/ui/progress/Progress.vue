<script setup lang="ts">
import type { ProgressRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { cn } from 'cn'
import {
  ProgressIndicator,
  ProgressRoot,
} from 'reka-ui'

const props = withDefaults(
  defineProps<ProgressRootProps & { class?: HTMLAttributes['class'], circular?: boolean }>(),
  {
    modelValue: 0,
  },
)

const delegatedProps = reactiveOmit(props, 'class', 'circular')
</script>

<template>
  <ProgressRoot
    data-slot="progress"
    v-bind="delegatedProps"
    :class="
      cn(
        props.circular ? 'circular-progress' : 'bg-muted h-1 rounded-full relative flex w-full items-center overflow-x-hidden',
        props.class,
      )
    "
  >
    <ProgressIndicator
      data-slot="progress-indicator"
      :class="circular ? 'circular-progress-indicator' : 'bg-primary size-full flex-1 transition-all'"
      :style="circular ? { '--progress-angle': `${Math.min(100, Math.max(0, props.modelValue ?? 0)) * 3.6}deg`, '--progress-cap-opacity': (props.modelValue ?? 0) > 0 ? 1 : 0 } : { transform: `translateX(-${100 - (props.modelValue ?? 0)}%)` }"
    />
  </ProgressRoot>
</template>
