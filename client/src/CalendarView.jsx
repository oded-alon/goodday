import { useMemo, useState } from 'react'
import { useApp } from './ctx.js'
import { addEntry, removeEntry } from './store.js'
import {
  daysInMonth, dayLabel, fullLabel, gregorianOf, isAfter, keyOf, leadingBlanks, monthName, sameDay, shiftMonth, yearLabel,
} from './core/hebrew.js'
import { ArrowIcon, Dialog, EntryCard, fullGregorian } from './ui.jsx'
import { sameDate } from './TodayView.jsx'
import { WriterStrip } from './FamilyPickers.jsx'

/** Write a good thing for a day that already passed. The title names the day, so it is always clear where it lands. */
function AddToDayDialog({ date, onClose }) {
  const { lang, familyOn, t } = useApp()
  const [type, setType] = useState('me')
  const [text, setText] = useState('')
  const [share, setShare] = useState(false)
  const [writer, setWriter] = useState('')
  const label = `${dayLabel(date.day, lang)} ${monthName(date.year, date.month, lang)}`
  const save = async () => {
    // Written later, so it was not written after that day's sunset: afterNightfall stays false
    await addEntry({ text, type, date, shared: share, profileId: writer })
    onClose()
  }
  return (
    <Dialog
      title={t.addToDayTitle(label)} onClose={onClose}
      actions={<>
        <button className="btn text" onClick={onClose}>{t.cancel}</button>
        <button className="btn text" onClick={save} disabled={!text.trim() || (familyOn && !writer)}>{t.save}</button>
      </>}
    >
      {familyOn && <WriterStrip value={writer} onChange={setWriter} />}
      <div className="row">
        {[['me', t.typeMe], ['world', t.typeWorld]].map(([k, l]) => (
          <button key={k} className={'chip' + (type === k ? ' on' : '')} aria-pressed={type === k} onClick={() => setType(k)}>{l}</button>
        ))}
      </div>
      <textarea value={text} rows={3} maxLength={10000} onChange={(e) => setText(e.target.value)}
        placeholder={type === 'me' ? t.hintMePast : t.hintWorld} aria-label={type === 'me' ? t.hintMePast : t.hintWorld} />
      {familyOn && (
        <div><button className={'chip' + (share ? ' on' : '')} aria-pressed={share} onClick={() => setShare(!share)}>{t.shareWithFamily}</button></div>
      )}
    </Dialog>
  )
}

export default function CalendarView() {
  const { resolved, visible, lang, settings, familyOn, profiles, t } = useApp()
  const today = resolved.hebrew
  const [month, setMonth] = useState({ year: today.year, month: today.month })
  const [selected, setSelected] = useState(today)
  const [adding, setAdding] = useState(false)
  const rtl = lang === 'he'

  const counts = useMemo(() => {
    const c = {}
    for (const e of visible) if (e.hebYear === month.year && e.hebMonth === month.month) c[e.hebDay] = (c[e.hebDay] || 0) + 1
    return c
  }, [visible, month])

  const len = daysInMonth(month.year, month.month)
  const blanks = leadingBlanks(month.year, month.month)
  const cells = Array.from({ length: Math.ceil((blanks + len) / 7) * 7 }, (_, i) => i - blanks + 1)
  const go = (delta) => {
    const m = shiftMonth(month, delta)
    setMonth(m)
    // Keep the selection inside the month being shown
    setSelected(today.year === m.year && today.month === m.month ? today : { ...m, day: 1 })
  }
  const inMonthOfToday = month.year === today.year && month.month === today.month
  const canAdd = !isAfter(selected, today) // past days (and today) can be written to; the future cannot
  const dayEntries = visible.filter((e) => sameDate(e, selected)).sort((a, b) => b.createdAt - a.createdAt)

  return (
    <section className="stack">
      <div className="monthbar">
        <button className="icon-btn" onClick={() => go(-1)} aria-label={t.prevMonth}><ArrowIcon flip={rtl} /></button>
        <div className="mid">
          <h1 className="headline">{monthName(month.year, month.month, lang)} {yearLabel(month.year, lang)}</h1>
          <p className="muted">{gregorianRange(month, lang)}</p>
        </div>
        <button className="icon-btn" onClick={() => go(1)} aria-label={t.nextMonth}><ArrowIcon flip={!rtl} /></button>
      </div>
      {!(inMonthOfToday && sameDay(selected, today)) && (
        <p className="center">
          <button className="btn text" onClick={() => { setMonth({ year: today.year, month: today.month }); setSelected(today) }}>{t.goToToday}</button>
        </p>
      )}
      <div className="grid" role="grid">
        {t.dayAbbr.map((d, i) => <span key={i} className={'wd' + (i === 6 ? ' sat' : '')}>{d}</span>)}
        {cells.map((day, i) => {
          if (day < 1 || day > len) return <span key={i} />
          const d = { ...month, day }
          const n = counts[day] || 0
          const cls = ['day', n ? 'has' : '', keyOf(d) === keyOf(selected) ? 'sel' : '', sameDay(d, today) ? 'today' : '', i % 7 === 6 ? 'sat' : ''].join(' ')
          return (
            <button key={i} className={cls} style={n ? { '--heat': Math.min(n, 4) } : undefined} onClick={() => setSelected(d)}
              aria-label={`${dayLabel(day, lang)} ${monthName(d.year, d.month, lang)}, ${t.entriesCount(n)}`}>
              <b>{dayLabel(day, lang)}</b><small>{gregorianOf(d).getDate()}</small>
            </button>
          )
        })}
      </div>
      <div>
        <h2 className="title-lg">{fullLabel(selected, lang)}</h2>
        <p className="muted">{fullGregorian(gregorianOf(selected), lang)}</p>
      </div>
      {canAdd && <button className="btn tonal" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>{t.addToDay}</button>}
      {adding && canAdd && <AddToDayDialog date={selected} onClose={() => setAdding(false)} />}
      {dayEntries.length === 0 ? (
        <p className="muted" style={{ fontSize: 16 }}>{t.nothingThisDay}</p>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {dayEntries.map((e) => <EntryCard key={e.id} entry={e} lang={lang} cityId={settings.cityId} t={t} onDelete={() => removeEntry(e.id)} author={familyOn ? profiles.find((p) => p.id === e.profileId)?.name : ''} />)}
        </ul>
      )}
    </section>
  )
}

function gregorianRange(month, lang) {
  const first = gregorianOf({ ...month, day: 1 })
  const last = gregorianOf({ ...month, day: daysInMonth(month.year, month.month) })
  const f = (d) => d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { month: 'long', year: 'numeric' })
  const a = f(first), b = f(last)
  return a === b ? a : `${a} – ${b}`
}
