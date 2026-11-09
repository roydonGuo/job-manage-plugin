<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Clock3 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const props = defineProps<{ id: string, label: string, disabled?: boolean }>()
const model = defineModel<string>({ required: true })
const open = ref(false)
const hour = ref('00')
const minute = ref('00')
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

watch(open, (value) => {
  if (value) {
    const parts = model.value.split(':')
    hour.value = hours.includes(parts[0] ?? '') ? parts[0]! : '00'
    minute.value = minutes.includes(parts[1] ?? '') ? parts[1]! : '00'
  }
})
watch(() => props.disabled, (value) => { if (value) open.value = false })

function confirm() {
  model.value = `${hour.value}:${minute.value}`
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button :id="id" type="button" variant="outline" :disabled="disabled" :aria-label="label" class="h-10 w-full justify-between bg-transparent px-2.5 font-normal">
        <span class="font-mono tabular-nums">{{ model }}</span>
        <Clock3 class="size-4 text-muted-foreground" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent :aria-label="`${label}选择器`" align="start" :collision-padding="12" class="w-60 gap-3 p-3.5">
      <PopoverHeader>
        <PopoverTitle>{{ label }}</PopoverTitle>
        <PopoverDescription class="text-xs">选择小时与分钟 · 24 小时制</PopoverDescription>
      </PopoverHeader>
      <div class="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel :for="`${id}-hours`" class="text-xs text-muted-foreground">时</FieldLabel>
          <Select v-model="hour" :disabled="disabled">
            <SelectTrigger :id="`${id}-hours`" :aria-label="`${label}小时`" class="w-full font-mono tabular-nums"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" align="start" :collision-padding="12" class="max-h-48 min-w-0">
              <SelectGroup><SelectItem v-for="value in hours" :key="value" :value="value" class="font-mono tabular-nums">{{ value }}</SelectItem></SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel :for="`${id}-minutes`" class="text-xs text-muted-foreground">分</FieldLabel>
          <Select v-model="minute" :disabled="disabled">
            <SelectTrigger :id="`${id}-minutes`" :aria-label="`${label}分钟`" class="w-full font-mono tabular-nums"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" align="start" :collision-padding="12" class="max-h-48 min-w-0">
              <SelectGroup><SelectItem v-for="value in minutes" :key="value" :value="value" class="font-mono tabular-nums">{{ value }}</SelectItem></SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Separator />
      <div class="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" @click="open = false">取消</Button>
        <Button type="button" size="sm" :disabled="disabled" @click="confirm"><Check class="size-3.5" aria-hidden="true" />确定</Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
