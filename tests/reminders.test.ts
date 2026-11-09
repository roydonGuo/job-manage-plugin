import assert from 'node:assert/strict'
import test from 'node:test'
import { createReminderScheduler, PUNCH_REMINDER_ALARM, RECONCILE_ALARM, REMINDER_ALARM } from '../src/services/reminders.ts'
import { DEFAULT_SETTINGS, LAST_PUNCH_REMINDER_KEY, LAST_REMINDER_KEY, SETTINGS_KEY } from '../src/utils/work.ts'

function fixture(current = new Date(2026, 9, 26, 18, 20)) {
  const stored: Record<string, unknown> = { [SETTINGS_KEY]: structuredClone(DEFAULT_SETTINGS) }
  const alarms = new Map<string, { name: string, scheduledTime?: number, periodInMinutes?: number }>()
  const notifications: Array<{ id: string, options: { message: string } }> = []
  const state = { current, permission: 'granted', failNotification: false, failId: '' }
  const api = {
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    storage: { local: { get: async () => ({ ...stored }), set: async (value: object) => { Object.assign(stored, value) } } },
    alarms: {
      get: async (name: string) => alarms.get(name),
      create: async (name: string, value: { when?: number, periodInMinutes?: number }) => { alarms.set(name, { name, scheduledTime: value.when, periodInMinutes: value.periodInMinutes }) },
      clear: async (name: string) => alarms.delete(name),
    },
    notifications: {
      getPermissionLevel: async () => state.permission,
      create: async (id: string, options: { message: string }) => {
        if (state.failNotification || id === state.failId) throw new Error('通知暂时不可用')
        notifications.push({ id, options })
        return id
      },
    },
  } as unknown as Parameters<typeof createReminderScheduler>[0]
  return { stored, alarms, notifications, state, api, scheduler: createReminderScheduler(api, () => state.current) }
}

test('到点调用系统通知 API，持久化去重并安排下个工作日', async () => {
  const f = fixture()
  await Promise.all([f.scheduler.reconcile(), f.scheduler.reconcile(), f.scheduler.reconcile()])
  assert.equal(f.notifications.length, 1)
  assert.equal(f.notifications[0].options.message, '还有10分钟就下班了！')
  assert.equal(f.stored[LAST_REMINDER_KEY], '2026-10-26')
  assert.equal(f.alarms.get(REMINDER_ALARM)?.scheduledTime, new Date(2026, 9, 27, 18, 20).getTime())
  // 模拟 worker 重启，内存队列丢失后也不会再次通知。
  await createReminderScheduler(f.api, () => f.state.current).reconcile()
  assert.equal(f.notifications.length, 1)
})

test('保存新时间会替换旧闹钟，关闭提醒会清除所有提醒闹钟', async () => {
  const f = fixture(new Date(2026, 9, 26, 10))
  await f.scheduler.reconcile()
  assert.equal(f.alarms.get(REMINDER_ALARM)?.scheduledTime, new Date(2026, 9, 26, 18, 20).getTime())
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, endTime: '17:30', reminderMinutes: 30 }
  await f.scheduler.reconcile()
  assert.equal(f.alarms.get(REMINDER_ALARM)?.scheduledTime, new Date(2026, 9, 26, 17).getTime())
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, reminderEnabled: false }
  await f.scheduler.reconcile()
  assert.equal(f.alarms.size, 0)
  assert.equal(f.notifications.length, 0)
})

test('休眠恢复后仅在下班前补发，消息使用实际剩余分钟', async () => {
  const f = fixture(new Date(2026, 9, 26, 18, 27))
  await f.scheduler.reconcile()
  assert.equal(f.notifications[0].options.message, '还有3分钟就下班了！')
  f.state.current = new Date(2026, 9, 27, 19)
  await f.scheduler.reconcile()
  assert.equal(f.notifications.length, 1)
})

test('通知权限被拒绝时不标记已发；权限恢复后可发送', async () => {
  const f = fixture()
  f.state.permission = 'denied'
  await f.scheduler.reconcile()
  assert.equal(f.notifications.length, 0)
  assert.equal(f.stored[LAST_REMINDER_KEY], undefined)
  f.state.permission = 'granted'
  await f.scheduler.reconcile()
  assert.equal(f.notifications.length, 1)
})

test('通知临时失败保留恢复闹钟，重试成功后避免重复', async () => {
  const f = fixture()
  f.state.failNotification = true
  await assert.rejects(f.scheduler.reconcile())
  assert.ok(f.alarms.has(RECONCILE_ALARM))
  assert.equal(f.stored[LAST_REMINDER_KEY], undefined)
  f.state.failNotification = false
  await f.scheduler.reconcile()
  await f.scheduler.reconcile()
  assert.equal(f.notifications.length, 1)
})

test('原提醒与打卡提醒同刻独立触发，独立持久去重', async () => {
  const f = fixture()
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, punchReminderEnabled: true, punchReminderOffsetMinutes: -10 }
  await f.scheduler.reconcile()
  assert.deepEqual(f.notifications.map(item => item.id), ['off-work-2026-10-26', 'off-work-punch-2026-10-26'])
  assert.equal(f.stored[LAST_REMINDER_KEY], '2026-10-26')
  assert.equal(f.stored[LAST_PUNCH_REMINDER_KEY], '2026-10-26')
  await createReminderScheduler(f.api, () => f.state.current).reconcile()
  assert.equal(f.notifications.length, 2)
})

test('只开启打卡提醒仍有恢复闹钟；正负偏移修改后重排且可单独关闭', async () => {
  const f = fixture(new Date(2026, 9, 26, 10))
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, reminderEnabled: false, punchReminderEnabled: true }
  await f.scheduler.reconcile()
  assert.ok(f.alarms.has(RECONCILE_ALARM))
  assert.equal(f.alarms.has(REMINDER_ALARM), false)
  assert.equal(f.alarms.get(PUNCH_REMINDER_ALARM)?.scheduledTime, new Date(2026, 9, 26, 18, 35).getTime())
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, punchReminderEnabled: true, punchReminderOffsetMinutes: -5 }
  await f.scheduler.reconcile()
  assert.equal(f.alarms.get(PUNCH_REMINDER_ALARM)?.scheduledTime, new Date(2026, 9, 26, 18, 25).getTime())
  assert.ok(f.alarms.has(REMINDER_ALARM))
  f.stored[SETTINGS_KEY] = DEFAULT_SETTINGS
  await f.scheduler.reconcile()
  assert.equal(f.alarms.has(PUNCH_REMINDER_ALARM), false)
  assert.ok(f.alarms.has(REMINDER_ALARM))
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, reminderEnabled: false }
  await f.scheduler.reconcile()
  assert.equal(f.alarms.size, 0)
})

test('一种提醒发送失败不会阻断另一种，恢复后只补发失败的通知', async () => {
  const f = fixture()
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, punchReminderEnabled: true, punchReminderOffsetMinutes: -10 }
  f.state.failId = 'off-work-2026-10-26'
  await assert.rejects(f.scheduler.reconcile())
  assert.equal(f.notifications.length, 1)
  assert.equal(f.notifications[0].id, 'off-work-punch-2026-10-26')
  f.state.failId = ''
  await f.scheduler.reconcile()
  assert.equal(f.notifications.length, 2)
})

test('下班后照常发打卡提醒，不受原提醒下班后停止的逻辑影响', async () => {
  const f = fixture(new Date(2026, 9, 26, 18, 35))
  f.stored[SETTINGS_KEY] = { ...DEFAULT_SETTINGS, punchReminderEnabled: true }
  await f.scheduler.reconcile()
  assert.equal(f.notifications.length, 1)
  assert.equal(f.notifications[0].options.message, '已下班5分钟，别忘了打卡！')
  assert.equal(f.stored[LAST_REMINDER_KEY], undefined)
  assert.equal(f.stored[LAST_PUNCH_REMINDER_KEY], '2026-10-26')
})
