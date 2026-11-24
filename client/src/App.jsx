import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import * as store from './store.js'
import { getAuthSnapshot, getSync, scheduleSync, subscribeSync, syncNow } from './sync.js'
import { getWake, initWake, subscribeWake } from './wake.js'
import { getSettings, subscribeSettings } from './settings.js'
import { watchReminderPrefs } from './reminders.js'
import { strings } from './i18n.js'
import { cityById } from './core/cities.js'
import { resolveDate } from './core/hebrew.js'
import { isRestTime } from './core/rest.js'
import { isPersistent } from './db.js'
import { AppCtx } from './ctx.js'
import { CalendarIcon, HeartIcon, SettingsIcon, StarIcon } from './ui.jsx'
import TodayView from './TodayView.jsx'
import CalendarView from './CalendarView.jsx'
import FamilyView from './FamilyView.jsx'
import SettingsView from './SettingsView.jsx'
import { visibleEntries } from './core/visibility.js'
import { ViewerBar } from './FamilyPickers.jsx'
import WakeDialog from './WakeDialog.jsx'
import RestScreen from './RestScreen.jsx'

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

  // Theme: follow the device unless the user picked light or dark
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme
    else delete root.dataset.theme
  }, [settings.theme])

  // Shabbat and Yom Tov: the app does not run. (Quiet window as for notifications.)
  const rest = useMemo(() => isRestTime(city, now), [city, now])

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
  // Nothing talks to the network during the rest window; it starts when the rest ends
  useEffect(() => { if (!rest) initWake() }, [rest])
  useEffect(() => { if (wake.status === 'ready' && !rest) syncNow() }, [wake.status, rest])

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
  // What to show: everything when the game is off; otherwise shared entries plus the private ones of
  // the member being viewed as (none by default)
  const viewerId = familyOn && profiles.some((p) => p.id === settings.viewerId) ? settings.viewerId : ''
  const visible = useMemo(
    () => visibleEntries(entries, familyOn, viewerId),
    [entries, familyOn, viewerId],
  )
  const writersToday = useMemo(
    () => new Set(entries.filter((e) => e.hebYear === resolved.hebrew.year && e.hebMonth === resolved.hebrew.month && e.hebDay === resolved.hebrew.day).map((e) => e.profileId)),
    [entries, resolved],
  )

  if (rest) return <RestScreen city={city} now={now} lang={lang} t={t} />

  const ctx = { settings, lang, t, city, now, resolved, entries, visible, viewerId, profiles, familyOn, writersToday, auth, sync, wake }
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
        {familyOn && (current === 'today' || current === 'calendar') && <ViewerBar />}
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
