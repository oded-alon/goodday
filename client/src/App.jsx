import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import * as store from './store.js'
import { getAuthSnapshot, getSync, scheduleSync, subscribeSync, syncNow } from './sync.js'
import { getWake, subscribeWake } from './wake.js'
import { getSettings, subscribeSettings } from './settings.js'
import { watchReminderPrefs } from './reminders.js'
import { strings } from './i18n.js'
import { cityById } from './core/cities.js'
import { resolveDate } from './core/hebrew.js'
import { isPersistent } from './db.js'
import { AppCtx } from './ctx.js'
import { CalendarIcon, HeartIcon, SettingsIcon, StarIcon } from './ui.jsx'
import TodayView from './TodayView.jsx'
import CalendarView from './CalendarView.jsx'
import FamilyView from './FamilyView.jsx'
import SettingsView from './SettingsView.jsx'
import WakeDialog from './WakeDialog.jsx'

export default function App() {
  const [tab, setTab] = useState('today')
  const [now, setNow] = useState(() => new Date())

  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  const { entries, profiles, loaded } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const wake = useSyncExternalStore(subscribeWake, getWake)
  const sync = useSyncExternalStore(subscribeSync, getSync)
  const auth = useSyncExternalStore(subscribeSync, getAuthSnapshot)

  const lang = settings.lang
  const t = strings(lang)
  const city = cityById(settings.cityId)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    document.title = t.appName
  }, [lang, t.appName])

  // Local data first; sync is a background courtesy
  useEffect(() => {
    store.setChangeHandler(() => scheduleSync())
    store.load()
    return watchReminderPrefs()
  }, [])
  useEffect(() => { if (wake.status === 'ready') syncNow() }, [wake.status])

  // Re-resolve "today" every 30 s so the Hebrew day flips by itself when the sun sets
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const resolvedRaw = resolveDate(now, city, settings.useSunset)
  const resolved = useMemo(() => resolvedRaw, [resolvedRaw.hebrew.year, resolvedRaw.hebrew.month, resolvedRaw.hebrew.day, resolvedRaw.afterNightfall, settings.cityId]) // eslint-disable-line react-hooks/exhaustive-deps

  // The Family tab exists only while the game is on
  const familyOn = settings.familyEnabled && profiles.length > 0
  const current = tab === 'family' && !familyOn ? 'today' : tab
  // Whose entries to show: the member holding the phone, or everyone when the game is off
  const visible = useMemo(
    () => (familyOn ? entries.filter((e) => e.profileId === settings.activeProfileId) : entries),
    [entries, familyOn, settings.activeProfileId],
  )
  const writersToday = useMemo(
    () => new Set(entries.filter((e) => e.hebYear === resolved.hebrew.year && e.hebMonth === resolved.hebrew.month && e.hebDay === resolved.hebrew.day).map((e) => e.profileId)),
    [entries, resolved],
  )

  const ctx = { settings, lang, t, city, now, resolved, entries, visible, profiles, familyOn, writersToday, auth, sync, wake }
  const tabs = [
    ['today', t.today, HeartIcon],
    ['calendar', t.calendar, CalendarIcon],
    ...(familyOn ? [['family', t.family, StarIcon]] : []),
    ['settings', t.settings, SettingsIcon],
  ]
  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        {wake.status === 'offline' && <p className="banner" role="status">{t.offlineBanner}</p>}
        {loaded && !isPersistent() && <p className="banner warn">{t.notPersistent}</p>}
        <main>
          {!loaded ? null : current === 'today' ? <TodayView /> : current === 'calendar' ? <CalendarView />
            : current === 'family' ? <FamilyView /> : <SettingsView />}
        </main>
        <nav className="tabs">
          {tabs.map(([k, label, Icon]) => (
            <button key={k} aria-current={current === k ? 'page' : undefined} onClick={() => setTab(k)}>
              <span className="ind"><Icon /></span>{label}
            </button>
          ))}
        </nav>
        <WakeDialog t={t} />
      </div>
    </AppCtx.Provider>
  )
}
