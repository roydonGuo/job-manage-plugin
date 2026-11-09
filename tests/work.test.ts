import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_SETTINGS, formatCountdown, getDueReminder, getNextReminder, getWorkStatus, localDateKey, normalizeSettings, validateSettings } from '../src/utils/work.ts'

const settings = normalizeSettings({ ...DEFAULT_SETTINGS, dailySalary: 300 })

test('默认配置合法，读取结果不共享工作日数组', () => {
  assert.equal(validateSettings(settings), undefined)
  const copy = normalizeSettings(undefined)
  copy.workdays.push(6)
  assert.equal(DEFAULT_SETTINGS.workdays.includes(6), false)
  assert.deepEqual(normalizeSettings({ broken: true }), DEFAULT_SETTINGS)
})

test('工作日上班前、工作中、下班后及休息日状态正确', () => {
  assert.equal(getWorkStatus(settings, new Date(2026, 9, 26, 8)).label, '尚未上班')
  const working = getWorkStatus(settings, new Date(2026, 9, 26, 9, 30))
  assert.equal(working.label, '工作中')
  assert.equal(working.countdown, '09:00:00')
  assert.equal(getWorkStatus(settings, new Date(2026, 9, 26, 18, 29, 59)).countdown, '00:00:01')
  assert.equal(getWorkStatus(settings, new Date(2026, 9, 26, 18, 30)).label, '已下班')
  assert.equal(getWorkStatus(settings, new Date(2026, 9, 26, 19)).countdown, '00:00:00')
  assert.equal(getWorkStatus(settings, new Date(2026, 9, 31, 10)).label, '今天休息')
  assert.equal(getWorkStatus(settings, new Date(2026, 9, 31, 10)).countdown, '00:00:00')
})

test('自定义周末工作日生效，秒数向上取整且不出现负数', () => {
  assert.equal(getWorkStatus({ ...settings, workdays: [6] }, new Date(2026, 9, 31, 10)).label, '工作中')
  assert.equal(formatCountdown(3600001), '01:00:01')
  assert.equal(formatCountdown(-100), '00:00:00')
})

test('拒绝空工作日、非法时间、跨夜班次、非法日薪及过长提醒', () => {
  for (const update of [
    { workdays: [] }, { workdays: [7] }, { workdays: [1.5] },
    { startTime: '25:00' }, { endTime: '08:30' }, { endTime: '09:30' },
    { dailySalary: -1 }, { dailySalary: Number.NaN }, { dailySalary: 1.234 },
    { reminderMinutes: 0 }, { reminderMinutes: 1.5 }, { reminderMinutes: 541 },
  ]) assert.ok(validateSettings({ ...settings, ...update }), JSON.stringify(update))
  assert.equal(validateSettings({ ...settings, reminderMinutes: 540 }), undefined)
  assert.equal(validateSettings({ ...settings, reminderEnabled: false, reminderMinutes: 541 }), undefined)
})

test('提醒仅在指定工作日的阈值到下班之间触发，并按日期去重', () => {
  assert.equal(getDueReminder(settings, new Date(2026, 9, 26, 18, 19, 59)), null)
  assert.deepEqual(getDueReminder(settings, new Date(2026, 9, 26, 18, 20)), { dateKey: '2026-10-26', minutes: 10 })
  assert.equal(getDueReminder(settings, new Date(2026, 9, 26, 18, 25))?.minutes, 5)
  assert.equal(getDueReminder(settings, new Date(2026, 9, 26, 18, 30)), null)
  assert.equal(getDueReminder(settings, new Date(2026, 9, 31, 18, 20)), null)
  assert.equal(getDueReminder(settings, new Date(2026, 9, 26, 18, 20), '2026-10-26'), null)
  assert.equal(getDueReminder({ ...settings, reminderEnabled: false }, new Date(2026, 9, 26, 18, 20)), null)
})

test('下一次提醒跳过周末，处理跨年以及每周仅工作一天', () => {
  assert.equal(getNextReminder(settings, new Date(2026, 9, 30, 19))?.getTime(), new Date(2026, 10, 2, 18, 20).getTime())
  assert.equal(getNextReminder(settings, new Date(2026, 11, 31, 19))?.getTime(), new Date(2027, 0, 1, 18, 20).getTime())
  const monday = new Date(2026, 9, 26, 18, 20)
  assert.equal(getNextReminder({ ...settings, workdays: [1] }, monday, localDateKey(monday))?.getTime(), new Date(2026, 10, 2, 18, 20).getTime())
  assert.equal(getNextReminder({ ...settings, reminderEnabled: false }, monday), null)
})
