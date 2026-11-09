<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { AlarmClock, Bell, BriefcaseBusiness, CalendarDays, ClipboardCheck, Info, LogIn, LogOut, Save, Send, Settings2, Wallet } from '@lucide/vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import WorkTimePicker from '@/components/WorkTimePicker.vue'
import { isExtension, saveSettings } from '@/services/settings'
import { formatPunchReminderOffset, getPunchReminderMessage, validateSettings, WEEKDAYS, type WorkSettings } from '@/utils/work'

const props = defineProps<{ settings: WorkSettings, initialTab?: 'work' | 'notifications' }>()
const emit = defineEmits<{ saved: [settings: WorkSettings] }>()
const open = defineModel<boolean>('open', { required: true })
const form = reactive({ ...props.settings, workdays: [...props.settings.workdays], dailySalary: String(props.settings.dailySalary), reminderMinutes: String(props.settings.reminderMinutes), punchReminderOffsetMinutes: String(props.settings.punchReminderOffsetMinutes) })
const saving = ref(false)
const activeTab = ref('work')
const error = ref('')
const testMessage = ref('')
const testKind = ref<'off-work' | 'punch'>('off-work')
const notificationDenied = ref(false)
const punchPreview = computed(() => {
  const minutes = Number(form.punchReminderOffsetMinutes)
  return String(form.punchReminderOffsetMinutes).trim() && Number.isInteger(minutes) && Math.abs(minutes) <= 1440 ? `${formatPunchReminderOffset(minutes)}提醒打卡` : '负数为下班前，正数为下班后，0 为下班时'
})

watch(open, async (value) => {
  if (!value) return
  activeTab.value = props.initialTab ?? 'work'
  Object.assign(form, { ...props.settings, workdays: [...props.settings.workdays], dailySalary: String(props.settings.dailySalary), reminderMinutes: String(props.settings.reminderMinutes), punchReminderOffsetMinutes: String(props.settings.punchReminderOffsetMinutes) })
  error.value = ''
  testMessage.value = ''
  if (isExtension) {
    try { notificationDenied.value = await chrome.notifications.getPermissionLevel() === 'denied' }
    catch { notificationDenied.value = false }
  }
})

function toggleDay(day: number, checked: boolean | 'indeterminate') {
  form.workdays = checked === true ? [...new Set([...form.workdays, day])] : form.workdays.filter((d) => d !== day)
}

async function submit() {
  error.value = ''
  if (!String(form.dailySalary).trim() || !String(form.reminderMinutes).trim()) {
    error.value = '请填写日薪和提醒分钟数，日薪可填 0。'
    activeTab.value = !String(form.dailySalary).trim() ? 'work' : 'notifications'
    return
  }
  if (form.punchReminderEnabled && !String(form.punchReminderOffsetMinutes).trim()) { activeTab.value = 'notifications'; error.value = '请填写打卡提醒的偏移分钟数，可填 0。'; return }
  const settings: WorkSettings = { ...form, workdays: [...form.workdays], dailySalary: Number(form.dailySalary), reminderMinutes: Number(form.reminderMinutes), punchReminderOffsetMinutes: Number(form.punchReminderOffsetMinutes) }
  const validation = validateSettings(settings)
  if (validation) { activeTab.value = /提醒/.test(validation) ? 'notifications' : 'work'; error.value = validation; return }
  saving.value = true
  try {
    await saveSettings(settings)
    emit('saved', settings)
    open.value = false
  } catch {
    error.value = '保存失败，请重试。你的修改仍保留在此页面。'
  } finally { saving.value = false }
}

async function testNotification(kind: 'off-work' | 'punch') {
  if (!isExtension) return
  testMessage.value = ''
  testKind.value = kind
  try {
    if (await chrome.notifications.getPermissionLevel() !== 'granted') {
      notificationDenied.value = true
      return
    }
    const minutes = kind === 'punch' ? Number(form.punchReminderOffsetMinutes) : Number(form.reminderMinutes)
    if (!Number.isInteger(minutes) || (kind === 'punch' ? Math.abs(minutes) > 1440 || !String(form.punchReminderOffsetMinutes).trim() : minutes < 1 || minutes > 1439)) {
      testMessage.value = '请先填写有效的提醒分钟数。'
      return
    }
    const testTime = new Date()
    await chrome.notifications.create(`${kind}-test`, {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: kind === 'punch' ? '下班打卡提醒 · 测试' : '下班提醒 · 测试',
      message: kind === 'punch' ? getPunchReminderMessage(new Date(testTime.getTime() - minutes * 60000), testTime) : `还有${minutes}分钟就下班了！`,
    })
    testMessage.value = '测试通知已发送；若未显示，请检查系统通知设置。'
  } catch { testMessage.value = '测试通知发送失败，请检查 Edge 的通知设置。' }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :show-close-button="!saving" class="settings-dialog" @interact-outside="(event) => { if (saving) event.preventDefault() }" @escape-key-down="(event) => { if (saving) event.preventDefault() }">
      <DialogHeader class="settings-header">
        <DialogTitle class="flex items-center gap-2 text-lg"><Settings2 class="size-5 text-primary" aria-hidden="true" />工作设置</DialogTitle>
        <DialogDescription class="text-xs">安排工作节奏，把下班交给提醒。</DialogDescription>
      </DialogHeader>
      <form class="settings-form" novalidate @submit.prevent="submit">
        <Tabs v-model="activeTab" class="settings-tabs">
          <TabsList class="settings-tab-list" aria-label="设置分类">
            <TabsTrigger value="work" :disabled="saving"><BriefcaseBusiness class="size-3.5" aria-hidden="true" />工作安排</TabsTrigger>
            <TabsTrigger value="notifications" :disabled="saving"><Bell class="size-3.5" aria-hidden="true" />提醒通知</TabsTrigger>
          </TabsList>
          <div class="settings-scroll">
            <TabsContent value="work" class="m-0">
              <FieldSet :disabled="saving" class="min-w-0 gap-5">
                <FieldSet class="min-w-0 gap-2.5">
                  <FieldLegend variant="label" class="mb-0 flex items-center gap-2 text-sm"><CalendarDays class="size-4 text-primary" aria-hidden="true" />工作日</FieldLegend>
                  <div class="grid grid-cols-7 gap-1.5">
                    <Label v-for="day in WEEKDAYS" :key="day.value" :for="`day-${day.value}`" class="weekday-choice" :class="{ 'weekday-selected': form.workdays.includes(day.value) }">
                      {{ day.label }}
                      <Checkbox :id="`day-${day.value}`" :model-value="form.workdays.includes(day.value)" :aria-label="`星期${day.label}`" @update:model-value="(checked) => toggleDay(day.value, checked)" />
                    </Label>
                  </div>
                  <FieldDescription class="text-xs">收入累计与提醒按所选工作日生效。</FieldDescription>
                </FieldSet>
                <Separator />
                <div class="grid grid-cols-2 gap-3">
                  <Field class="gap-2">
                    <FieldLabel for="start-time" class="text-xs"><LogIn class="size-3.5 text-primary" aria-hidden="true" />上班时间</FieldLabel>
                    <WorkTimePicker id="start-time" v-model="form.startTime" label="上班时间" :disabled="saving" />
                  </Field>
                  <Field class="gap-2">
                    <FieldLabel for="end-time" class="text-xs"><LogOut class="size-3.5 text-primary" aria-hidden="true" />下班时间</FieldLabel>
                    <WorkTimePicker id="end-time" v-model="form.endTime" label="下班时间" :disabled="saving" />
                  </Field>
                </div>
                <Field class="gap-2">
                  <FieldLabel for="daily-salary" class="text-sm"><Wallet class="size-4 text-primary" aria-hidden="true" />日薪<span class="text-xs font-normal text-muted-foreground">元 / 工作日</span></FieldLabel>
                  <Input id="daily-salary" v-model="form.dailySalary" type="number" min="0" max="100000000" step="0.01" class="h-10 font-mono text-sm" placeholder="例如 300.00" required />
                  <FieldDescription class="text-xs leading-relaxed">按上下班之间的时长估算收入，不单独扣除午休。</FieldDescription>
                </Field>
              </FieldSet>
            </TabsContent>
            <TabsContent value="notifications" class="m-0">
              <FieldSet :disabled="saving" class="min-w-0 gap-4">
                <FieldGroup class="notification-group">
                  <Field orientation="horizontal" class="justify-between gap-2">
                    <FieldLabel for="reminder-enabled" class="text-sm"><Bell class="size-4 text-primary" aria-hidden="true" />下班提醒</FieldLabel>
                    <Switch id="reminder-enabled" v-model="form.reminderEnabled" aria-label="开启下班提醒" />
                  </Field>
                  <Field orientation="horizontal" class="gap-2 text-xs text-muted-foreground">
                    <FieldLabel for="reminder-minutes" class="grow-0! shrink-0 text-xs font-normal">下班前</FieldLabel>
                    <Input id="reminder-minutes" v-model="form.reminderMinutes" type="number" min="1" max="1439" step="1" class="h-9 w-20 font-mono text-sm" :disabled="!form.reminderEnabled" required />
                    <span>分钟提醒</span>
                  </Field>
                  <FieldDescription class="text-xs">通知：还有 xx 分钟就下班了！</FieldDescription>
                  <Button v-if="isExtension" type="button" variant="outline" size="sm" class="w-fit" @click="testNotification('off-work')"><Send class="size-3" aria-hidden="true" />测试通知</Button>
                  <Alert v-if="testMessage && testKind === 'off-work'" role="status" class="p-2.5"><AlertDescription class="text-xs">{{ testMessage }}</AlertDescription></Alert>
                </FieldGroup>
                <FieldGroup class="notification-group">
                  <Field orientation="horizontal" class="justify-between gap-2">
                    <FieldLabel for="punch-reminder-enabled" class="text-sm"><ClipboardCheck class="size-4 text-primary" aria-hidden="true" />下班打卡提醒</FieldLabel>
                    <Switch id="punch-reminder-enabled" v-model="form.punchReminderEnabled" aria-label="开启下班打卡提醒" />
                  </Field>
                  <Field orientation="horizontal" class="gap-2 text-xs text-muted-foreground">
                    <FieldLabel for="punch-reminder-offset" class="grow-0! shrink-0 gap-1 text-xs font-normal"><AlarmClock class="size-3.5" aria-hidden="true" />相对下班</FieldLabel>
                    <Input id="punch-reminder-offset" v-model="form.punchReminderOffsetMinutes" type="number" min="-1440" max="1440" step="1" class="h-9 w-20 font-mono text-sm" :disabled="!form.punchReminderEnabled" aria-describedby="punch-reminder-help" />
                    <span>分钟</span>
                  </Field>
                  <FieldDescription id="punch-reminder-help" class="text-xs">负数提前 · 正数延后 · 0 准点</FieldDescription>
                  <FieldDescription v-if="form.punchReminderEnabled" role="status" class="text-xs text-primary">{{ punchPreview }}</FieldDescription>
                  <Button v-if="isExtension" type="button" variant="outline" size="sm" class="w-fit" @click="testNotification('punch')"><Send class="size-3" aria-hidden="true" />测试打卡通知</Button>
                  <Alert v-if="testMessage && testKind === 'punch'" role="status" class="p-2.5"><AlertDescription class="text-xs">{{ testMessage }}</AlertDescription></Alert>
                </FieldGroup>
                <FieldDescription class="flex items-start gap-1.5 text-[11px] leading-relaxed"><Info class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{{ isExtension ? '提醒仅在工作日生效，请保持 Edge 运行。' : '系统通知仅在 Edge 插件中生效，网页可预览与保存设置。' }}</FieldDescription>
              </FieldSet>
            </TabsContent>
          </div>
        </Tabs>
        <div v-if="notificationDenied || error" class="px-5 pb-3">
          <Alert v-if="notificationDenied" variant="destructive" class="p-2.5"><AlertDescription class="text-xs">请在 Edge 和系统设置中允许通知。</AlertDescription></Alert>
          <FieldError v-if="error" class="rounded-lg bg-destructive/10 p-2.5 text-xs leading-relaxed">{{ error }}</FieldError>
        </div>
        <DialogFooter class="settings-footer">
          <Button type="button" variant="ghost" :disabled="saving" @click="open = false">取消</Button>
          <Button type="submit" :disabled="saving" class="min-w-28"><Spinner v-if="saving" class="size-3.5" /><Save v-else class="size-3.5" aria-hidden="true" />{{ saving ? '保存中…' : '保存设置' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>