const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const pad = (value: number) => String(value).padStart(2, '0')

export function formatUtcOffset(offsetMinutes: number): string {
  const absolute = Math.abs(offsetMinutes)
  return `UTC${offsetMinutes <= 0 ? '+' : '-'}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}

export function getClockSnapshot(date: Date) {
  return {
    timestamp: date.getTime(),
    hours: pad(date.getHours()),
    minutes: pad(date.getMinutes()),
    seconds: pad(date.getSeconds()),
    date: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
    weekday: weekdays[date.getDay()],
    // getTimezoneOffset 使用当前日期，自动遵循系统时区及夏令时。
    offset: formatUtcOffset(date.getTimezoneOffset()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区',
  }
}
