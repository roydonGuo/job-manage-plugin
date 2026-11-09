export interface WorkSettings {
  workdays: number[]
  startTime: string
  endTime: string
  dailySalary: number
  reminderEnabled: boolean
  reminderMinutes: number
  punchReminderEnabled: boolean
  punchReminderOffsetMinutes: number
}

export const SETTINGS_KEY = 'workSettings'
export const LAST_REMINDER_KEY = 'lastReminderDate'
export const LAST_PUNCH_REMINDER_KEY = 'lastPunchReminderDate'
export const PUNCH_REMINDER_GRACE_MS = 60 * 60000
export const DEFAULT_SETTINGS: WorkSettings = {
  workdays: [1, 2, 3, 4, 5],
  startTime: '09:30',
  endTime: '18:30',
  dailySalary: 0,
  reminderEnabled: true,
  reminderMinutes: 10,
  punchReminderEnabled: false,
  punchReminderOffsetMinutes: 5,
}
export const WEEKDAYS = [
  { value: 1, label: '一' }, { value: 2, label: '二' }, { value: 3, label: '三' },
  { value: 4, label: '四' }, { value: 5, label: '五' }, { value: 6, label: '六' },
  { value: 0, label: '日' },
]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const minutesOfDay = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

export function validateSettings(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return '设置格式不正确，请重新填写。'
  const s = value as WorkSettings
  if (!Array.isArray(s.workdays) || !s.workdays.length || s.workdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return '请至少选择一个工作日。'
  }
  if (typeof s.startTime !== 'string' || !TIME_PATTERN.test(s.startTime) || typeof s.endTime !== 'string' || !TIME_PATTERN.test(s.endTime)) {
    return '请选择有效的上下班时间。'
  }
  const duration = minutesOfDay(s.endTime) - minutesOfDay(s.startTime)
  if (duration <= 0) return '下班时间必须晚于上班时间，目前支持当天班次。'
  if (typeof s.dailySalary !== 'number' || !Number.isFinite(s.dailySalary) || s.dailySalary < 0 || s.dailySalary > 100000000 || Math.abs(s.dailySalary * 100 - Math.round(s.dailySalary * 100)) > 0.000001) {
    return '日薪需为 0～100000000 元，最多两位小数。'
  }
  if (typeof s.reminderEnabled !== 'boolean') return '请选择是否开启下班提醒。'
  if (!Number.isInteger(s.reminderMinutes) || s.reminderMinutes < 1 || s.reminderMinutes > 1439) return '提醒时间需为 1～1439 的整数分钟。'
  if (s.reminderEnabled && s.reminderMinutes > duration) return '提前提醒的时间不能超过当天的工作时长。'
  if (typeof s.punchReminderEnabled !== 'boolean') return '请选择是否开启下班打卡提醒。'
  if (!Number.isInteger(s.punchReminderOffsetMinutes) || s.punchReminderOffsetMinutes < -1440 || s.punchReminderOffsetMinutes > 1440) {
    return '打卡提醒需填写 -1440～1440 的整数分钟，负数为下班前，正数为下班后。'
  }
}

export function normalizeSettings(value: unknown): WorkSettings {
  // 旧版设置仅补齐新增字段，保留已保存的工作时间、日薪和原有提醒。
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const migrated = {
    ...stored,
    punchReminderEnabled: stored.punchReminderEnabled === undefined ? DEFAULT_SETTINGS.punchReminderEnabled : stored.punchReminderEnabled,
    punchReminderOffsetMinutes: stored.punchReminderOffsetMinutes === undefined ? DEFAULT_SETTINGS.punchReminderOffsetMinutes : stored.punchReminderOffsetMinutes,
  }
  const settings = validateSettings(migrated) ? DEFAULT_SETTINGS : migrated as unknown as WorkSettings
  return { ...settings, workdays: [...new Set(settings.workdays)] }
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getWorkWindow(settings: WorkSettings, date: Date) {
  const atTime = (time: string) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutesOfDay(time) / 60), minutesOfDay(time) % 60)
  const start = atTime(settings.startTime)
  const end = atTime(settings.endTime)
  return { start, end, reminder: new Date(end.getTime() - settings.reminderMinutes * 60000) }
}

export function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

export function getWorkStatus(settings: WorkSettings, now: Date) {
  const { start, end } = getWorkWindow(settings, now)
  const isWorkday = settings.workdays.includes(now.getDay())
  const status: 'rest' | 'before' | 'finished' | 'working' = !isWorkday ? 'rest' : now < start ? 'before' : now >= end ? 'finished' : 'working'
  return {
    status,
    label: { rest: '今天休息', before: '尚未上班', finished: '已下班', working: '工作中' }[status],
    countdown: formatCountdown(isWorkday ? end.getTime() - now.getTime() : 0),
  }
}

export function getEarnings(settings: WorkSettings, now: Date) {
  const { start, end } = getWorkWindow(settings, now)
  const durationMs = end.getTime() - start.getTime()
  const isWorkday = settings.workdays.includes(now.getDay())
  const elapsedMs = isWorkday ? Math.min(durationMs, Math.max(0, now.getTime() - start.getTime())) : 0
  const progress = durationMs > 0 ? elapsedMs / durationMs : 0
  // 以分为工资基数，直接按系统时间重算，避免定时器累加误差和重开弹窗后丢失收入。
  const dailyCents = Math.round(settings.dailySalary * 100)
  const earnedCents = Math.min(dailyCents, Math.floor(dailyCents * progress))
  const hourlyRate = durationMs > 0 ? dailyCents / 100 / (durationMs / 3600000) : 0
  return {
    earnedCents,
    earned: earnedCents / 100,
    hourlyRate,
    perSecond: hourlyRate / 3600,
    progress: progress * 100,
    elapsedMs,
    durationMs,
  }
}

export function getDueReminder(settings: WorkSettings, now: Date, lastDate?: string) {
  if (!settings.reminderEnabled || !settings.workdays.includes(now.getDay()) || lastDate === localDateKey(now)) return null
  const { reminder, end } = getWorkWindow(settings, now)
  if (now < reminder || now >= end) return null
  return { dateKey: localDateKey(now), minutes: Math.ceil((end.getTime() - now.getTime()) / 60000) }
}

export function getNextReminder(settings: WorkSettings, now: Date, lastDate?: string): Date | null {
  if (!settings.reminderEnabled) return null
  for (let offset = 0; offset <= 7; offset++) {
    // 使用本地日历计算，每天的提醒跟随当地时区和夏令时。
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    if (!settings.workdays.includes(day.getDay()) || localDateKey(day) === lastDate) continue
    const { reminder } = getWorkWindow(settings, day)
    if (reminder > now) return reminder
  }
  return null
}

export function formatPunchReminderOffset(minutes: number): string {
  return minutes < 0 ? `下班前 ${Math.abs(minutes)} 分钟` : minutes > 0 ? `下班后 ${minutes} 分钟` : '下班时'
}

export function getPunchReminderMessage(end: Date, now: Date): string {
  const difference = now.getTime() - end.getTime()
  if (difference < 0) return `还有${Math.ceil(-difference / 60000)}分钟下班，记得打卡！`
  const minutes = Math.floor(difference / 60000)
  return minutes ? `已下班${minutes}分钟，别忘了打卡！` : '下班时间到了，别忘了打卡！'
}

function getPunchReminderWindow(settings: WorkSettings, workday: Date) {
  const { end } = getWorkWindow(settings, workday)
  return { end, reminder: new Date(end.getTime() + settings.punchReminderOffsetMinutes * 60000) }
}

export function getDuePunchReminder(settings: WorkSettings, now: Date, lastDate?: string) {
  if (!settings.punchReminderEnabled) return null
  // 按所属工作日去重，允许周五下班后的提醒跨到周六，也允许负偏移跨到前一天。
  for (let offset = -2; offset <= 1; offset++) {
    const workday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const dateKey = localDateKey(workday)
    if (!settings.workdays.includes(workday.getDay()) || dateKey === lastDate) continue
    const { end, reminder } = getPunchReminderWindow(settings, workday)
    const delay = now.getTime() - reminder.getTime()
    if (delay >= 0 && delay < PUNCH_REMINDER_GRACE_MS) {
      return { dateKey, message: getPunchReminderMessage(end, now) }
    }
  }
  return null
}

export function getNextPunchReminder(settings: WorkSettings, now: Date, lastDate?: string): Date | null {
  if (!settings.punchReminderEnabled) return null
  for (let offset = -1; offset <= 8; offset++) {
    const workday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    if (!settings.workdays.includes(workday.getDay()) || localDateKey(workday) === lastDate) continue
    const { reminder } = getPunchReminderWindow(settings, workday)
    if (reminder > now) return reminder
  }
  return null
}
