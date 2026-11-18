import { useMemo, useState } from 'react'
import { addEntry, removeEntry } from './store.js'
import {
  CITIES, daysInMonth, dayLabel, fullLabel, gregorianOf, isAfter, keyOf, leadingBlanks, monthName,
  sameDay, shiftMonth, yearLabel,
} from './hebrew.js'
import { authenticate, signOut } from './sync.js'
import { saveLang } from './i18n.js'

const fmtGreg = (d, lang) =>
  gregorianOf(d).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

function EntryForm({ date, past, t, onDone }) {
  const [type, setType] = useState('me')
  const [text, setText] = useState('')
  const hint = type === 'world' ? t.hintWorld : past ? t.hintMePast : t.hintMe
  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    await addEntry({ text, type, date })
    setText('')
    onDone?.()
  }
  return (
    <form className="card form" onSubmit={submit}>
      <div className="chips" role="group">
        {['me', 'world'].map((k) => (
          <button type="button" key={k} className={'chip' + (type === k ? ' on' : '')} aria-pressed={type === k}
            onClick={() => setType(k)}>{t[k]}</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={hint} rows={3} maxLength={5000} />
      <div className="row end">
        {onDone && <button type="button" className="ghost" onClick={onDone}>{t.cancel}</button>}
        <button className="primary" disabled={!text.trim()}>{t.save}</button>
      </div>
    </form>
  )
}

function EntryList({ entries, t }) {
  if (!entries.length) return <p className="muted">{t.nothingYet}</p>
  return (
    <ul className="entries">
      {entries.map((e) => (
        <li key={e.id} className={'card entry ' + e.type}>
          <span className="tag">{t[e.type]}</span>
          <p>{e.text}</p>
          <button className="ghost small" onClick={() => removeEntry(e.id)} aria-label={t.del}>✕</button>
        </li>
      ))}
    </ul>
  )
}

const forDay = (list, d) =>
  list.filter((e) => e.hebYear === d.year && e.hebMonth === d.month && e.hebDay === d.day)
    .sort((a, b) => b.createdAt - a.createdAt)

export function TodayView({ entries, today, lang, t }) {
  const mine = useMemo(() => forDay(entries, today), [entries, today])
  return (
    <section>
      <header className="dayhead">
        <h1>{fullLabel(today, lang)}</h1>
        <p className="muted">{fmtGreg(today, lang)}</p>
      </header>
      <EntryForm date={today} t={t} />
      <EntryList entries={mine} t={t} />
    </section>
  )
}

export function CalendarView({ entries, today, lang, t }) {
  const [month, setMonth] = useState({ year: today.year, month: today.month })
  const [selected, setSelected] = useState(today)
  const [adding, setAdding] = useState(false)

  const counts = useMemo(() => {
    const c = {}
    for (const e of entries) if (e.hebYear === month.year && e.hebMonth === month.month) c[e.hebDay] = (c[e.hebDay] || 0) + 1
    return c
  }, [entries, month])

  const len = daysInMonth(month.year, month.month)
  const blanks = leadingBlanks(month.year, month.month)
  const cells = Array.from({ length: Math.ceil((blanks + len) / 7) * 7 }, (_, i) => i - blanks + 1)
  const go = (delta) => {
    const m = shiftMonth(month, delta)
    setMonth(m)
    setSelected(today.year === m.year && today.month === m.month ? today : { ...m, day: 1 })
    setAdding(false)
  }
  const canAdd = !isAfter(selected, today)
  const dayEntries = forDay(entries, selected)
  const away = !(sameDay(selected, today) && month.year === today.year && month.month === today.month)

  return (
    <section>
      <div className="monthbar">
        <button className="ghost" onClick={() => go(-1)} aria-label={t.prevMonth}>{lang === 'he' ? '›' : '‹'}</button>
        <h1>{monthName(month.year, month.month, lang)} {yearLabel(month.year, lang)}</h1>
        <button className="ghost" onClick={() => go(1)} aria-label={t.nextMonth}>{lang === 'he' ? '‹' : '›'}</button>
      </div>
      {away && (
        <p className="center">
          <button className="link" onClick={() => { setMonth({ year: today.year, month: today.month }); setSelected(today); setAdding(false) }}>
            {t.backToToday}
          </button>
        </p>
      )}
      <div className="grid card" role="grid">
        {t.dayAbbr.map((d, i) => <span key={i} className={'wd' + (i === 6 ? ' sat' : '')}>{d}</span>)}
        {cells.map((day, i) => {
          if (day < 1 || day > len) return <span key={i} />
          const d = { ...month, day }
          const n = counts[day] || 0
          const cls = ['day', n ? 'has' : '', keyOf(d) === keyOf(selected) ? 'sel' : '', sameDay(d, today) ? 'today' : '', i % 7 === 6 ? 'sat' : ''].join(' ')
          return (
            <button key={i} className={cls} style={n ? { '--heat': Math.min(n, 4) } : undefined}
              onClick={() => { setSelected(d); setAdding(false) }}
              aria-label={`${dayLabel(day, lang)} ${monthName(d.year, d.month, lang)}, ${t.entriesCount(n)}`}>
              <b>{dayLabel(day, lang)}</b><small>{gregorianOf(d).getDate()}</small>
            </button>
          )
        })}
      </div>
      <header className="dayhead">
        <h2>{fullLabel(selected, lang)}</h2>
        <p className="muted">{fmtGreg(selected, lang)}</p>
      </header>
      {canAdd && !adding && <button className="tonal" onClick={() => setAdding(true)}>{t.addToDay}</button>}
      {canAdd && adding && <EntryForm date={selected} past={!sameDay(selected, today)} t={t} onDone={() => setAdding(false)} />}
      <EntryList entries={dayEntries} t={t} />
    </section>
  )
}

export function SettingsView({ lang, setLang, cityId, setCityId, auth, t, online }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!online) return setError(t.errOffline)
    setBusy(true)
    try {
      await authenticate(mode, email.trim(), password)
      setPassword('')
    } catch (err) {
      setError(({
        invalid_credentials: t.errCreds, exists: t.errExists, bad_email: t.errBadEmail, bad_password: t.errBadPassword,
      })[err.message] || (err.network ? t.errOffline : t.errGeneric))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1>{t.settings}</h1>
      <div className="card field">
        <label>{t.language}
          <select value={lang} onChange={(e) => { saveLang(e.target.value); setLang(e.target.value) }}>
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>{t.city}
          <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{c[lang]}</option>)}
          </select>
        </label>
        <p className="muted small">{t.cityHelp}</p>
      </div>

      <div className="card field">
        <h2>{t.account}</h2>
        {auth ? (
          <>
            <p>{t.signedInAs}<strong dir="ltr">{auth.email}</strong></p>
            <button className="ghost" onClick={() => { if (confirm(t.signOutWarn)) signOut() }}>{t.signOut}</button>
          </>
        ) : (
          <form onSubmit={submit} className="field">
            <p className="muted small">{t.accountHelp}</p>
            <input type="email" dir="ltr" autoComplete="email" placeholder={t.email} value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" dir="ltr" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>{busy ? t.connecting : t[mode]}</button>
            <p className="center small">
              {mode === 'login' ? t.noAccount : t.haveAccount}{' '}
              <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
                {mode === 'login' ? t.register : t.login}
              </button>
            </p>
          </form>
        )}
      </div>
    </section>
  )
}
