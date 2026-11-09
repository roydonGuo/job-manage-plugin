<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
defineProps<{ label: string }>()
</script>

<template>
  <Tooltip :delay-duration="350">
    <TooltipTrigger as-child><slot /></TooltipTrigger>
    <TooltipContent :collision-padding="8" class="max-w-64 text-xs leading-relaxed">{{ label }}</TooltipContent>
  </Tooltip>
</template>
