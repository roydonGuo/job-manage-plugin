<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowRight, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronRight, CircleCheck, ClipboardCheck, Clock3, Coffee, Settings2, Sunrise } from '@lucide/vue'
import { Button } from './components/ui/button'
import { Alert, AlertDescription } from './components/ui/alert'
import { Badge } from './components/ui/badge'
import { Separator } from './components/ui/separator'
import { Spinner } from './components/ui/spinner'
import { Progress } from './components/ui/progress'
import { TooltipProvider } from './components/ui/tooltip'
import Hint from './components/Hint.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import EarningsCard from './components/EarningsCard.vue'
import { useClock } from './composables/useClock'
import { isExtension, loadSettings } from './services/settings'
import { formatPunchReminderOffset, getEarnings, getWorkStatus, normalizeSettings, SETTINGS_KEY, type WorkSettings } from './utils/work'

const clock = useClock()
const settings = ref(normalizeSettings(undefined))
const ready = ref(false)
const settingsOpen = ref(false)
const settingsTab = ref<'work' | 'notifications'>('work')
const message = ref('')
const work = computed(() => getWorkStatus(settings.value, new Date(clock.value.timestamp)))
const statusIcon = computed(() => ({ rest: Coffee, before: Sunrise, working: BriefcaseBusiness, finished: CircleCheck })[work.value.status])
const progress = computed(() => getEarnings(settings.value, new Date(clock.value.timestamp)).progress)
// 日期或工资规则变化时重新初始化动画，避免把改配置和跨日清零演成收入增长。
const earningsKey = computed(() => [clock.value.date, settings.value.startTime, settings.value.endTime, settings.value.dailySalary, settings.value.workdays.join(',')].join('|'))

async function refreshSettings() {
  try {
    settings.value = await loadSettings()
    ready.value = true
    message.value = ''
  } catch { message.value = '读取设置失败，请重新打开插件。' }
}

function handleStorageChange(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (area === 'local' && changes[SETTINGS_KEY]) settings.value = normalizeSettings(changes[SETTINGS_KEY].newValue)
}

function handleWebStorage(event: StorageEvent) {
  if (event.key === SETTINGS_KEY) void refreshSettings()
}

function handleSaved(value: WorkSettings) {
  settings.value = normalizeSettings(value)
  message.value = '设置已保存'
}

function openSettings(tab: 'work' | 'notifications' = 'work') {
  settingsTab.value = tab
  settingsOpen.value = true
}

onMounted(() => {
  void refreshSettings()
  if (isExtension) chrome.storage.onChanged.addListener(handleStorageChange)
  else window.addEventListener('storage', handleWebStorage)
})
onUnmounted(() => {
  if (isExtension) chrome.storage.onChanged.removeListener(handleStorageChange)
  else window.removeEventListener('storage', handleWebStorage)
})
</script>

<template>
  <TooltipProvider :delay-duration="350">
  <main class="dashboard dark">
    <header class="brand-header">
      <div class="flex items-center gap-2.5">
        <span class="brand-mark" aria-hidden="true"><Clock3 class="size-7" :stroke-width="1.6" /></span>
        <h1 class="text-[23px] leading-none font-semibold tracking-[.12em]">此刻</h1>
      </div>
      <Hint label="工作与提醒设置"><Button variant="outline" size="icon-lg" aria-label="设置" class="settings-trigger" :disabled="!ready" @click="openSettings()"><Settings2 class="size-5" :stroke-width="1.6" aria-hidden="true" /></Button></Hint>
    </header>

    <section class="date-strip" aria-label="当前日期与时间">
      <div class="flex items-center justify-center gap-2 text-muted-foreground">
        <CalendarDays class="size-3.5" :stroke-width="1.6" aria-hidden="true" />
        <time class="text-[11px] tabular-nums">{{ clock.date }}</time>
        <Separator orientation="vertical" class="mx-0.5 h-3 bg-muted-foreground/35" />
        <Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-[11px] font-normal">{{ clock.weekday.replace('星期', '周') }}</Badge>
      </div>
      <Hint :label="`${clock.timezone} · ${clock.offset}`"><time class="clock-display" role="timer" aria-live="off" :aria-label="`当前时间 ${clock.hours}时${clock.minutes}分${clock.seconds}秒`"><span>{{ clock.hours }}</span><span class="clock-colon" aria-hidden="true">:</span><span>{{ clock.minutes }}</span><span class="clock-colon" aria-hidden="true">:</span><span class="clock-seconds">{{ clock.seconds }}</span></time></Hint>
    </section>

    <template v-if="ready">
      <section class="countdown-section" aria-label="下班倒计时">
        <Progress :model-value="progress" circular aria-label="今日工作进度" class="orbit-progress" />
        <div class="orbit-content">
          <h2>下班倒计时</h2>
          <div class="countdown-display" role="timer" aria-live="off" :aria-label="`下班倒计时 ${work.countdown}`">{{ work.countdown }}</div>
          <div class="shift-row"><span>上班 {{ settings.startTime }}</span><ArrowRight class="size-3.5" aria-hidden="true" /><span>下班 {{ settings.endTime }}</span></div>
          <strong class="orbit-percentage">{{ progress.toFixed(1) }}<span>%</span></strong>
          <span class="orbit-state"><component :is="statusIcon" class="size-3" aria-hidden="true" />{{ work.status === 'working' ? '工作进度' : work.label }}</span>
        </div>
      </section>
      <Separator class="orbit-divider" />
      <EarningsCard :key="earningsKey" :settings="settings" :timestamp="clock.timestamp" @configure="openSettings()" />
      <nav aria-label="提醒设置" class="reminder-list">
        <Button variant="ghost" class="reminder-row" aria-label="设置下班提醒" @click="openSettings('notifications')">
          <Bell class="size-5 text-primary" :stroke-width="1.6" aria-hidden="true" /><span class="reminder-copy"><span>下班提醒</span><span class="reminder-summary">{{ settings.reminderEnabled ? `提前 ${settings.reminderMinutes} 分钟` : '未开启' }}</span></span><ChevronRight class="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
        <Button variant="ghost" class="reminder-row" aria-label="设置下班打卡提醒" @click="openSettings('notifications')">
          <ClipboardCheck class="size-5 text-primary" :stroke-width="1.6" aria-hidden="true" /><span class="reminder-copy"><span>打卡提醒</span><span class="reminder-summary">{{ settings.punchReminderEnabled ? formatPunchReminderOffset(settings.punchReminderOffsetMinutes) : '未开启' }}</span></span><ChevronRight class="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </nav>
    </template>
    <Alert v-else :variant="message ? 'destructive' : 'default'" class="py-4" :role="message ? 'alert' : 'status'">
      <Spinner v-if="!message" />
      <AlertDescription class="text-xs">{{ message || '正在读取工作设置…' }}</AlertDescription>
    </Alert>
    <footer v-if="ready && message" class="dashboard-footer">
      <p role="status" class="flex items-center justify-center gap-1 text-primary"><Check class="size-3" aria-hidden="true" />{{ message }}</p>
    </footer>
    <SettingsDialog v-model:open="settingsOpen" :settings="settings" :initial-tab="settingsTab" @saved="handleSaved" />
  </main>
  </TooltipProvider>
</template>
