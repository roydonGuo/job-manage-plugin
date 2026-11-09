import { getDuePunchReminder, getDueReminder, getNextPunchReminder, getNextReminder, LAST_PUNCH_REMINDER_KEY, LAST_REMINDER_KEY, normalizeSettings, SETTINGS_KEY } from '../utils/work.ts'

export const REMINDER_ALARM = 'off-work-reminder'
export const RECONCILE_ALARM = 'off-work-reconcile'
export const PUNCH_REMINDER_ALARM = 'off-work-punch-reminder'
type ReminderApi = Pick<typeof chrome, 'alarms' | 'storage' | 'notifications' | 'runtime'>

export function createReminderScheduler(api: ReminderApi, now = () => new Date()) {
  // 同一 worker 内串行处理启动、设置变更和闹钟事件，避免重复通知及旧设置覆盖新闹钟。
  let pending = Promise.resolve()

  async function reconcile() {
    const stored = await api.storage.local.get([SETTINGS_KEY, LAST_REMINDER_KEY, LAST_PUNCH_REMINDER_KEY])
    const settings = normalizeSettings(stored[SETTINGS_KEY])
    // 先保留恢复检查；即使系统通知临时失败，下次仍可重试。
    const maintenance = await api.alarms.get(RECONCILE_ALARM)
    const enabled = settings.reminderEnabled || settings.punchReminderEnabled
    if (enabled && !maintenance) {
      await api.alarms.create(RECONCILE_ALARM, { periodInMinutes: 1 })
    } else if (!enabled && maintenance) await api.alarms.clear(RECONCILE_ALARM)
    const current = now()
    const reminders = [
      {
        alarm: REMINDER_ALARM, key: LAST_REMINDER_KEY, prefix: 'off-work', title: '下班提醒 · 此刻',
        due(lastDate?: string) {
          const due = getDueReminder(settings, current, lastDate)
          return due && { dateKey: due.dateKey, message: `还有${due.minutes}分钟就下班了！` }
        },
        next: (lastDate?: string) => getNextReminder(settings, current, lastDate),
      },
      {
        alarm: PUNCH_REMINDER_ALARM, key: LAST_PUNCH_REMINDER_KEY, prefix: 'off-work-punch', title: '下班打卡提醒 · 此刻',
        due: (lastDate?: string) => getDuePunchReminder(settings, current, lastDate),
        next: (lastDate?: string) => getNextPunchReminder(settings, current, lastDate),
      },
    ]
    const errors: unknown[] = []
    for (const reminder of reminders) {
      try {
        const savedDate = stored[reminder.key]
        let lastDate = typeof savedDate === 'string' ? savedDate : undefined
        const due = reminder.due(lastDate)
        if (due && await api.notifications.getPermissionLevel() === 'granted') {
          await api.notifications.create(`${reminder.prefix}-${due.dateKey}`, {
            type: 'basic', iconUrl: api.runtime.getURL('icons/icon-128.png'),
            title: reminder.title, message: due.message,
          })
          lastDate = due.dateKey
          await api.storage.local.set({ [reminder.key]: lastDate })
        }
        const next = reminder.next(lastDate)
        const alarm = await api.alarms.get(reminder.alarm)
        if (next) {
          if (!alarm || alarm.scheduledTime !== next.getTime()) await api.alarms.create(reminder.alarm, { when: next.getTime() })
        } else if (alarm) await api.alarms.clear(reminder.alarm)
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length) throw new AggregateError(errors, '提醒调度失败')
  }

  return {
    reconcile() {
      const task = pending.then(reconcile)
      pending = task.catch(() => {})
      return task
    },
  }
}
