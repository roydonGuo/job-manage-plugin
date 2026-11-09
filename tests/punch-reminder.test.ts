import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_SETTINGS, formatPunchReminderOffset, getDuePunchReminder, getNextPunchReminder, normalizeSettings, validateSettings } from '../src/utils/work.ts'

const settings = { ...DEFAULT_SETTINGS, punchReminderEnabled: true }

test('升级旧设置只补齐打卡字段，保留工作时间、工作日、日薪和原提醒', () => {
  const legacy: Record<string, unknown> = { ...DEFAULT_SETTINGS, startTime: '10:15', endTime: '19:15', dailySalary: 450.75, workdays: [2, 4], reminderEnabled: false, reminderMinutes: 17 }
  delete legacy.punchReminderEnabled
  delete legacy.punchReminderOffsetMinutes
  assert.deepEqual(normalizeSettings(legacy), { ...legacy, punchReminderEnabled: false, punchReminderOffsetMinutes: 5 })
})

test('支持正数、负数和零，限制为正负一天的整数分钟', () => {
  for (const minutes of [-1440, -5, 0, 5, 1440]) assert.equal(validateSettings({ ...settings, punchReminderOffsetMinutes: minutes }), undefined)
  for (const minutes of [-1441, 1441, 1.5, NaN, Infinity]) assert.ok(validateSettings({ ...settings, punchReminderOffsetMinutes: minutes }))
  assert.equal(formatPunchReminderOffset(-5), '下班前 5 分钟')
  assert.equal(formatPunchReminderOffset(5), '下班后 5 分钟')
  assert.equal(formatPunchReminderOffset(0), '下班时')
})

test('正负和零偏移分别在下班后、下班前和下班时通知', () => {
  const cases = [
    { minutes: -5, due: new Date(2026, 9, 26, 18, 25), message: '还有5分钟下班，记得打卡！' },
    { minutes: 0, due: new Date(2026, 9, 26, 18, 30), message: '下班时间到了，别忘了打卡！' },
    { minutes: 5, due: new Date(2026, 9, 26, 18, 35), message: '已下班5分钟，别忘了打卡！' },
  ]
  for (const item of cases) {
    const config = { ...settings, punchReminderOffsetMinutes: item.minutes }
    assert.equal(getNextPunchReminder(config, new Date(2026, 9, 26, 9))?.getTime(), item.due.getTime())
    assert.equal(getDuePunchReminder(config, new Date(item.due.getTime() - 1)), null)
    assert.deepEqual(getDuePunchReminder(config, item.due), { dateKey: '2026-10-26', message: item.message })
    assert.equal(getDuePunchReminder(config, item.due, '2026-10-26'), null)
  }
})

test('周五下班后的提醒跨到周六仍触发，按周五去重', () => {
  const config = { ...settings, workdays: [5], endTime: '23:30', punchReminderOffsetMinutes: 60 }
  const due = new Date(2026, 9, 31, 0, 30)
  assert.equal(getNextPunchReminder(config, new Date(2026, 9, 31, 0, 20))?.getTime(), due.getTime())
  assert.equal(getDuePunchReminder(config, due)?.dateKey, '2026-10-30')
  assert.equal(getDuePunchReminder(config, due, '2026-10-30'), null)
  assert.equal(getNextPunchReminder(config, due, '2026-10-30')?.getTime(), new Date(2026, 10, 7, 0, 30).getTime())
})

test('负偏移跨到周日，提醒属于周一的工作日', () => {
  const config = { ...settings, workdays: [1], startTime: '00:00', endTime: '00:30', punchReminderOffsetMinutes: -60 }
  const due = new Date(2026, 9, 25, 23, 30)
  assert.equal(getNextPunchReminder(config, new Date(2026, 9, 25, 23))?.getTime(), due.getTime())
  assert.equal(getDuePunchReminder(config, due)?.dateKey, '2026-10-26')
  assert.equal(getDuePunchReminder(config, due, '2026-10-26'), null)
})

test('休眠后只在一小时内补发，消息按实际距离下班的时间生成', () => {
  assert.equal(getDuePunchReminder(settings, new Date(2026, 9, 26, 19, 34, 59))?.message, '已下班64分钟，别忘了打卡！')
  assert.equal(getDuePunchReminder(settings, new Date(2026, 9, 26, 19, 35)), null)
  assert.equal(getDuePunchReminder({ ...settings, punchReminderOffsetMinutes: -5 }, new Date(2026, 9, 26, 18, 40))?.message, '已下班10分钟，别忘了打卡！')
  const config = { ...settings, workdays: [5], endTime: '23:59', punchReminderOffsetMinutes: 1440 }
  assert.equal(getDuePunchReminder(config, new Date(2026, 10, 1, 0, 10))?.dateKey, '2026-10-30')
})

test('关闭后无提醒，休息日不单独建立提醒并跳到下个工作日', () => {
  assert.equal(getDuePunchReminder(DEFAULT_SETTINGS, new Date(2026, 9, 26, 18, 35)), null)
  assert.equal(getNextPunchReminder(DEFAULT_SETTINGS, new Date(2026, 9, 26, 18)), null)
  assert.equal(getDuePunchReminder(settings, new Date(2026, 9, 31, 18, 35)), null)
  assert.equal(getNextPunchReminder(settings, new Date(2026, 9, 31, 18))?.getTime(), new Date(2026, 10, 2, 18, 35).getTime())
})
