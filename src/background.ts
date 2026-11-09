import { createReminderScheduler, PUNCH_REMINDER_ALARM, RECONCILE_ALARM, REMINDER_ALARM } from './services/reminders'
import { SETTINGS_KEY } from './utils/work'

const scheduler = createReminderScheduler(chrome)
const sync = () => { void scheduler.reconcile().catch((error: unknown) => console.error('更新下班提醒失败', error)) }

chrome.runtime.onInstalled.addListener(sync)
chrome.runtime.onStartup.addListener(sync)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SETTINGS_KEY]) sync()
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REMINDER_ALARM || alarm.name === PUNCH_REMINDER_ALARM || alarm.name === RECONCILE_ALARM) sync()
})

// worker 被重新唤醒时检查闹钟，补偿浏览器重启、设备休眠和系统时区变化。
sync()
