// Turning reminders on/off from the UI. Real scheduling happens on the server (see push.js).
import { getSettings, subscribeSettings, updateSettings } from './settings.js'
import { dropSubscription, permission, pushSupported, syncReminders } from './push.js'

/** Change one reminder ('evening' | 'morning'). Returns 'on' | 'off' | 'denied' | 'unsupported' | 'error'. */
export async function setReminder(kind, patch) {
  const prev = getSettings()[kind]
  updateSettings({ [kind]: { ...prev, ...patch } })
  const s = getSettings()
  try {
    if (!s.evening.enabled && !s.morning.enabled) {
      await dropSubscription()
      return 'off'
    }
    const result = await syncReminders()
    if (patch.enabled && result !== 'on') updateSettings({ [kind]: prev }) // could not enable: switch stays off
    return result
  } catch {
    if (patch.enabled) updateSettings({ [kind]: prev })
    return 'error'
  }
}

/** Keep the server's copy of the preferences current when language/city/family settings change. */
export function watchReminderPrefs() {
  let last = ''
  let timer = null
  return subscribeSettings(() => {
    const s = getSettings()
    const key = JSON.stringify([s.lang, s.cityId, s.useSunset, s.familyEnabled, s.evening, s.morning])
    if (key === last) return
    const first = last === ''
    last = key
    if (first || !(s.evening.enabled || s.morning.enabled)) return
    if (!pushSupported() || permission() !== 'granted') return
    clearTimeout(timer)
    timer = setTimeout(() => syncReminders().catch(() => {}), 1500)
  })
}
