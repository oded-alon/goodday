import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from './ctx.js'
import { addEntry, removeEntry } from './store.js'
import { updateSettings } from './settings.js'
import { WriterStrip } from './FamilyPickers.jsx'
import { setReminder } from './reminders.js'
import { anniversaryTargets, dayLabel, keyOf, monthName, resolveDate, yearLabel } from './core/hebrew.js'
import { cityById } from './core/cities.js'
import { PROMPTS, promptIndex } from './core/prompts.js'
import { pointsForDay } from './core/scoring.js'
import { Avatar, EntryCard, fullGregorian, timeText } from './ui.jsx'

const MAX_MEMORIES = 6

export const sameDate = (e, d) => e.hebYear === d.year && e.hebMonth === d.month && e.hebDay === d.day

function DateHeader() {
  const { resolved, lang, t } = useApp()
  const h = resolved.hebrew
  const night = resolved.afterNightfall
  return (
    <header className={'date-header' + (night ? ' night' : '')}>
      <div className="big">{dayLabel(h.day, lang)} {monthName(h.year, h.month, lang)}</div>
      <div className="title-md sub">{yearLabel(h.year, lang)}</div>
      <div className="sub">{fullGregorian(new Date(resolved.civil.y, resolved.civil.m - 1, resolved.civil.d), lang)}</div>
      {night && <span className="pill">{t.afterNightfall}</span>}
    </header>
  )
}

function ReminderPrompt() {
  const { settings, lang, t } = useApp()
  const [busy, setBusy] = useState(false)
  if (settings.reminderPromptDismissed || settings.evening.enabled) return null
  const dismiss = () => updateSettings({ reminderPromptDismissed: true })
  return (
    <div className="card tertiary lg stack" style={{ gap: 8 }}>
      <p className="title-md">{t.reminderCardTitle}</p>
      <div className="row">
        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true)
          await setReminder('evening', { enabled: true })
          setBusy(false)
          dismiss()
        }}>{t.reminderYes(timeText(settings.evening.minute, lang))}</button>
        <button className="btn text" onClick={dismiss}>{t.reminderNo}</button>
      </div>
    </div>
  )
}

function Composer({ todayEntries }) {
  const { settings, familyOn, t } = useApp()
  const [type, setType] = useState('me')
  const [text, setText] = useState('')
  const [share, setShare] = useState(false)
  const [writer, setWriter] = useState('')
  const [glow, setGlow] = useState(false)
  const [gain, setGain] = useState(0)
  const area = useRef(null)

  // Open the app with the cursor in the box (desktop only: on a phone it would pop the keyboard)
  useEffect(() => { if (matchMedia('(pointer: fine)').matches) area.current?.focus() }, [])

  const save = async () => {
    if (!text.trim() || (familyOn && !writer)) return
    const before = todayEntries.length
    // Resolve at the moment of saving, not from the 30 s-old tick
    const at = resolveDate(new Date(), cityById(settings.cityId), settings.useSunset)
    await addEntry({ text, type, date: at.hebrew, afterNightfall: at.afterNightfall, shared: share, profileId: writer })
    setGain(pointsForDay(before + 1) - pointsForDay(before))
    setText('')
    setShare(false)
    setWriter('') // nobody stays selected after an entry
    setGlow(true)
    navigator.vibrate?.(30)
    setTimeout(() => setGlow(false), 80) // snap to gold, then the CSS transition fades it out
  }

  return (
    <div className={'card lg composer' + (glow ? ' glow' : '')}>
      {familyOn && <WriterStrip value={writer} onChange={setWriter} />}
      <div className="row">
        {[['me', t.typeMe], ['world', t.typeWorld]].map(([k, label]) => (
          <button key={k} className={'chip' + (type === k ? ' on' : '')} aria-pressed={type === k} onClick={() => setType(k)}>{label}</button>
        ))}
      </div>
      <textarea ref={area} value={text} rows={3} maxLength={10000} onChange={(e) => setText(e.target.value)}
        placeholder={type === 'me' ? t.hintMe : t.hintWorld} aria-label={type === 'me' ? t.hintMe : t.hintWorld} />
      <div className="row">
        {familyOn && <button className={'chip' + (share ? ' on' : '')} aria-pressed={share} onClick={() => setShare(!share)}>{t.shareWithFamily}</button>}
        <span className="grow" />
        {familyOn && <span className={'gain' + (glow ? ' show' : '')} dir="ltr">+{gain}</span>}
        <button className="btn" onClick={save} disabled={!text.trim() || (familyOn && !writer)}>{t.save}</button>
      </div>
    </div>
  )
}

function Memories({ list }) {
  const { lang, t } = useApp()
  let prev = -1
  return (
    <div className="card tertiary lg stack memories" style={{ gap: 10, padding: 18 }}>
      <h2 className="title-md">{t.memoriesTitle}</h2>
      {list.map((m) => {
        const heading = m.yearsAgo !== prev
        prev = m.yearsAgo
        return (
          <div key={m.entry.id} className="stack" style={{ gap: 10 }}>
            {heading && <p className="years">{t.yearsAgo(m.yearsAgo)}</p>}
            <p>{m.entry.text}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function TodayView() {
  const { resolved, visible, lang, settings, familyOn, profiles, t } = useApp()
  const today = resolved.hebrew
  const todayEntries = useMemo(() => visible.filter((e) => sameDate(e, today)).sort((a, b) => b.createdAt - a.createdAt), [visible, today])

  // "A year ago on this Hebrew date": the same day in earlier years, nearest first
  const memories = useMemo(() => {
    const targets = new Map(anniversaryTargets(today).map((d) => [keyOf(d), today.year - d.year]))
    return visible
      .map((entry) => ({ entry, yearsAgo: targets.get(`${entry.hebYear}-${entry.hebMonth}-${entry.hebDay}`) }))
      .filter((m) => m.yearsAgo)
      .sort((a, b) => a.yearsAgo - b.yearsAgo || a.entry.createdAt - b.entry.createdAt)
      .slice(0, MAX_MEMORIES)
  }, [visible, today])

  const prompts = PROMPTS[lang].empty
  return (
    <section className="stack">
      <DateHeader />
      <ReminderPrompt />
      <Composer todayEntries={todayEntries} />
      {memories.length > 0 && <Memories list={memories} />}
      {todayEntries.length === 0 ? (
        <p className="title-md center muted" style={{ fontSize: 18, padding: '24px 8px' }}>
          {prompts[promptIndex(prompts.length, resolved.civil)]}
        </p>
      ) : (
        <>
          <p className="label-lg muted">{t.todayCount(todayEntries.length)}</p>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 14 }}>
            {todayEntries.map((e) => (
              <EntryCard key={e.id} entry={e} lang={lang} cityId={settings.cityId} t={t} onDelete={() => removeEntry(e.id)} author={familyOn ? profiles.find((p) => p.id === e.profileId)?.name : ''} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
