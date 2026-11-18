import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import * as store from './store.js'
import { getAuthSnapshot, getSync, scheduleSync, subscribeSync, syncNow } from './sync.js'
import { getWake, subscribeWake } from './wake.js'
import { getLang, strings } from './i18n.js'
import { hebrewToday } from './hebrew.js'
import { isPersistent } from './db.js'
import { CalendarView, SettingsView, TodayView } from './views.jsx'
import WakeDialog from './WakeDialog.jsx'

const getCity = () => {
  try { return localStorage.getItem('goodday.city') || 'jerusalem' } catch { return 'jerusalem' }
}

export default function App() {
  const [lang, setLang] = useState(getLang)
  const [cityId, setCity] = useState(getCity)
  const [tab, setTab] = useState('today')
  const [tick, setTick] = useState(0)

  const t = strings(lang)
  const { list, loaded } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const wake = useSyncExternalStore(subscribeWake, getWake)
  const sync = useSyncExternalStore(subscribeSync, getSync)
  const auth = useSyncExternalStore(subscribeSync, getAuthSnapshot)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    document.title = t.appName
  }, [lang, t.appName])

  // Local data first; sync is a background courtesy
  useEffect(() => {
    store.setChangeHandler(() => scheduleSync())
    store.load()
  }, [])

  useEffect(() => { if (wake.status === 'ready') syncNow() }, [wake.status])

  // Re-evaluate "today" every minute so the Hebrew day flips at sunset while the app is open
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => hebrewToday(cityId), [cityId, tick])
  const todayKey = `${today.year}-${today.month}-${today.day}`
  const stableToday = useMemo(() => today, [todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const setCityId = (id) => {
    try { localStorage.setItem('goodday.city', id) } catch { /* ignore */ }
    setCity(id)
  }

  const badge = !auth ? t.syncLocal
    : wake.status === 'offline' ? t.syncLocal
    : sync.status === 'synced' ? t.syncSynced
    : sync.status === 'syncing' ? t.syncSyncing
    : sync.status === 'error' ? t.syncError
    : t.syncWaiting

  const tabs = [['today', t.today], ['calendar', t.calendar], ['settings', t.settings]]
  return (
    <div className="app">
      <header className="top">
        <span className="brand">{t.appName}</span>
        <span className={'badge ' + (auth ? sync.status : 'local')}>{badge}</span>
      </header>
      {wake.status === 'offline' && <p className="banner">{t.offlineBanner}</p>}
      {loaded && !isPersistent() && <p className="banner warn">{t.notPersistent}</p>}
      <main>
        {!loaded ? null : tab === 'today' ? (
          <TodayView entries={list} today={stableToday} lang={lang} t={t} />
        ) : tab === 'calendar' ? (
          <CalendarView entries={list} today={stableToday} lang={lang} t={t} />
        ) : (
          <SettingsView lang={lang} setLang={setLang} cityId={cityId} setCityId={setCityId} auth={auth} t={t}
            online={wake.status !== 'offline'} />
        )}
      </main>
      <nav className="tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}
            onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
      <WakeDialog t={t} />
    </div>
  )
}
