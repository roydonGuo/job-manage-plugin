import assert from 'node:assert/strict'
import test from 'node:test'
import { getClockSnapshot, formatUtcOffset } from '../src/utils/clock.ts'

test('使用本地日期并为时分秒补零', () => {
  const clock = getClockSnapshot(new Date(2026, 9, 26, 9, 5, 3))
  assert.equal(clock.date, '2026年10月26日')
  assert.equal(clock.weekday, '星期一')
  assert.equal(`${clock.hours}:${clock.minutes}:${clock.seconds}`, '09:05:03')
})

test('跨年午夜同步切换时间、日期和星期', () => {
  const date = new Date(2026, 11, 31, 23, 59, 59)
  assert.equal(getClockSnapshot(date).weekday, '星期四')
  date.setSeconds(date.getSeconds() + 1)
  const clock = getClockSnapshot(date)
  assert.equal(clock.date, '2027年1月1日')
  assert.equal(clock.weekday, '星期五')
  assert.equal(`${clock.hours}:${clock.minutes}:${clock.seconds}`, '00:00:00')
})

test('支持闰年和月份边界', () => {
  const date = new Date(2028, 1, 28, 23, 59, 59)
  date.setSeconds(date.getSeconds() + 1)
  assert.equal(getClockSnapshot(date).date, '2028年2月29日')
  date.setDate(date.getDate() + 1)
  assert.equal(getClockSnapshot(date).date, '2028年3月1日')
})

test('正确显示正负、零和非整小时 UTC 偏移', () => {
  assert.equal(formatUtcOffset(-480), 'UTC+08:00')
  assert.equal(formatUtcOffset(300), 'UTC-05:00')
  assert.equal(formatUtcOffset(0), 'UTC+00:00')
  assert.equal(formatUtcOffset(-345), 'UTC+05:45')
  assert.equal(formatUtcOffset(210), 'UTC-03:30')
})
