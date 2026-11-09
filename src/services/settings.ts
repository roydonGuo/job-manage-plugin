import { normalizeSettings, SETTINGS_KEY, validateSettings, type WorkSettings } from '../utils/work.ts'

export const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)

export async function loadSettings(): Promise<WorkSettings> {
  if (isExtension) {
    const result = await chrome.storage.local.get(SETTINGS_KEY)
    return normalizeSettings(result[SETTINGS_KEY])
  }
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return normalizeSettings(undefined)
  try { return normalizeSettings(JSON.parse(raw)) } catch { return normalizeSettings(undefined) }
}

export async function saveSettings(settings: WorkSettings): Promise<void> {
  const error = validateSettings(settings)
  if (error) throw new Error(error)
  const value = normalizeSettings(settings)
  if (isExtension) await chrome.storage.local.set({ [SETTINGS_KEY]: value })
  else localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
}
