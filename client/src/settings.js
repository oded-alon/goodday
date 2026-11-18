// App settings (per device, in localStorage) as a tiny external store.
const KEY = 'goodday.settings'

export const DEFAULTS = {
  lang: 'he', // Hebrew by default, English in settings (not tied to the phone language)
  cityId: 'jerusalem',
  useSunset: true,
  familyEnabled: false,
  activeProfileId: '',
  evening: { enabled: false, minute: 21 * 60 },
  morning: { enabled: false, minute: 8 * 60 },
  reminderPromptDismissed: false,
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) || {}
    // Carry over the first version's separate keys
    const lang = saved.lang ?? localStorage.getItem('goodday.lang')
    const cityId = saved.cityId ?? localStorage.getItem('goodday.city')
    return {
      ...DEFAULTS, ...saved,
      ...(lang === 'he' || lang === 'en' ? { lang } : {}),
      ...(cityId ? { cityId } : {}),
      evening: { ...DEFAULTS.evening, ...saved.evening },
      morning: { ...DEFAULTS.morning, ...saved.morning },
    }
  } catch {
    return { ...DEFAULTS }
  }
}

let state = read()
const listeners = new Set()

export const getSettings = () => state
export const subscribeSettings = (fn) => (listeners.add(fn), () => listeners.delete(fn))

export function updateSettings(patch) {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: keep in memory */ }
  listeners.forEach((f) => f())
}
