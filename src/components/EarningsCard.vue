<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, ChartNoAxesCombined, CreditCard, Settings2, Wallet } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { getEarnings, getWorkStatus, type WorkSettings } from '@/utils/work'
import FlipAmount from './FlipAmount.vue'

const props = defineProps<{ settings: WorkSettings, timestamp: number }>()
const emit = defineEmits<{ configure: [] }>()
const stats = computed(() => getEarnings(props.settings, new Date(props.timestamp)))
const status = computed(() => getWorkStatus(props.settings, new Date(props.timestamp)).status)
const accumulating = computed(() => status.value === 'working' && props.settings.dailySalary > 0)
const numberFormat = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amount = computed(() => numberFormat.format(stats.value.earned))
// Reserve fixed tile gaps and the currency mark so large configured salaries still fit.
const amountFontSize = computed(() => {
  const digits = amount.value.replace(/\D/g, '').length
  const punctuation = amount.value.length - digits
  return Math.min(42, (270 - (amount.value.length - 1) * 6) / (digits * .7 + punctuation * .22))
})
const money = (value: number) => `¥${numberFormat.format(value)}`
const stateText = computed(() => {
  if (!props.settings.dailySalary) return '设置日薪，开始记录今天的收获'
  return { rest: '今天休息，好好享受自己的时间', before: '上班后开始累计', finished: '今日累计完成，辛苦了', working: '实时累计' }[status.value]
})
</script>

<template>
  <section class="earnings-section" aria-label="今日已赚">
    <div class="earnings-heading">
      <h2><Wallet class="size-[18px] text-primary" :stroke-width="1.6" aria-hidden="true" />今日已赚</h2>
      <Button v-if="!settings.dailySalary" variant="ghost" size="xs" class="text-primary" @click="emit('configure')"><Settings2 class="size-3" aria-hidden="true" />设置日薪</Button>
      <span v-else-if="accumulating" :key="timestamp" class="income-tick income-rate"><span class="mr-1 font-sans font-normal text-muted-foreground">收入累计</span><ArrowUpRight class="size-3" aria-hidden="true" />+¥{{ stats.perSecond.toFixed(4) }}/秒</span>
      <span v-else class="earnings-state">{{ stateText }}</span>
    </div>
      <div class="earned-display" :aria-label="`今日预计已赚 ${stats.earned.toFixed(2)} 元`" aria-live="off">
        <span class="currency-sign" aria-hidden="true">¥</span>
        <FlipAmount data-testid="earned-amount" :value="amount" class="font-mono font-semibold tabular-nums" :style="{ fontSize: `${amountFontSize}px` }" />
      </div>
      <div class="salary-metrics">
        <div><CreditCard class="size-5 text-primary" :stroke-width="1.5" aria-hidden="true" /><div><span>日薪</span><strong :class="{ 'metric-large': money(settings.dailySalary).length > 11 }">{{ money(settings.dailySalary) }}</strong></div></div>
        <div><ChartNoAxesCombined class="size-5 text-primary" :stroke-width="1.5" aria-hidden="true" /><div><span>时薪</span><strong :class="{ 'metric-large': money(stats.hourlyRate).length > 11 }">{{ money(stats.hourlyRate) }}</strong></div></div>
      </div>
  </section>
</template>
