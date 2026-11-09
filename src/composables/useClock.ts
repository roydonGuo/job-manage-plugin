import { onMounted, onUnmounted, shallowRef } from 'vue'
import { getClockSnapshot } from '../utils/clock'

export function useClock() {
  const clock = shallowRef(getClockSnapshot(new Date()))
  let timer: ReturnType<typeof setTimeout> | undefined

  function sync() {
    clearTimeout(timer)
    clock.value = getClockSnapshot(new Date())
    // 每次读取系统时间并对齐下一秒，避免累计计时误差。
    timer = setTimeout(sync, 1000 - (Date.now() % 1000))
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') sync()
  }

  onMounted(() => {
    sync()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    clearTimeout(timer)
    window.removeEventListener('focus', sync)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return clock
}
