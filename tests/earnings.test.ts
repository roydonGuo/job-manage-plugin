import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_SETTINGS, getEarnings } from '../src/utils/work.ts'

const settings = { ...DEFAULT_SETTINGS, dailySalary: 900 }
const at = (hour: number, minute = 0, second = 0) => new Date(2026, 9, 26, hour, minute, second)

test('按日薪和实际工作时长计算，半天获得一半收入', () => {
  const stats = getEarnings(settings, at(14))
  assert.equal(stats.earned, 450)
  assert.equal(stats.progress, 50)
  assert.equal(stats.hourlyRate, 100)
  assert.equal(stats.perSecond, 100 / 3600)
  assert.equal(stats.elapsedMs, 4.5 * 3600000)
})

test('上班前和开始瞬间收入为零，下班及之后最多为日薪', () => {
  assert.equal(getEarnings(settings, at(8)).earned, 0)
  assert.equal(getEarnings(settings, at(9, 30)).earned, 0)
  assert.equal(getEarnings(settings, at(18, 30)).earned, 900)
  assert.equal(getEarnings(settings, at(23, 59)).earned, 900)
  assert.equal(getEarnings(settings, at(23, 59)).progress, 100)
})

test('休息日与下一工作日凌晨清零，自定义周末工作日有效', () => {
  const saturday = new Date(2026, 9, 31, 14)
  assert.equal(getEarnings(settings, saturday).earned, 0)
  assert.equal(getEarnings(settings, saturday).progress, 0)
  assert.equal(getEarnings({ ...settings, workdays: [6] }, saturday).earned, 450)
  assert.equal(getEarnings(settings, new Date(2026, 9, 27, 0)).earned, 0)
})

test('每秒按绝对时间重算，不因关闭弹窗或漏过刷新而少算', () => {
  const first = getEarnings(settings, at(9, 30, 1))
  const next = getEarnings(settings, at(9, 30, 2))
  assert.equal(first.earnedCents, 2)
  assert.equal(next.earnedCents, 5)
  assert.ok(next.earnedCents > first.earnedCents)
  assert.equal(getEarnings(settings, at(14)).earned, 450)
})

test('零日薪和不足一分钱的累计不产生虚假收入', () => {
  const zero = getEarnings({ ...settings, dailySalary: 0 }, at(14))
  assert.equal(zero.earned, 0)
  assert.equal(zero.hourlyRate, 0)
  assert.equal(zero.perSecond, 0)
  assert.equal(getEarnings({ ...settings, dailySalary: 0.01 }, at(14)).earned, 0)
  assert.equal(getEarnings({ ...settings, dailySalary: 0.01 }, at(18, 30)).earned, 0.01)
})

test('修改工资和上下班时间后立即按新规则计算', () => {
  assert.equal(getEarnings({ ...settings, dailySalary: 450 }, at(14)).earned, 225)
  const shortDay = getEarnings({ ...settings, startTime: '10:00', endTime: '18:00' }, at(14))
  assert.equal(shortDay.earned, 450)
  assert.equal(shortDay.hourlyRate, 112.5)
  const decimalSalary = getEarnings({ ...settings, dailySalary: 350.57 }, at(18, 30))
  assert.equal(decimalSalary.earned, 350.57)
})
