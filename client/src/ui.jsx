// Small shared UI pieces: icons (Material paths, same set as the Android app), avatar, switch, dialog, entry card.
import { useEffect, useRef } from 'react'
import { cityById } from './core/cities.js'

const icon = (d) => function Icon({ flip }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}><path d={d} /></svg>
}
export const HeartIcon = icon('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z')
export const CalendarIcon = icon('M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z')
export const StarIcon = icon('M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z')
export const SettingsIcon = icon('M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z')
export const DeleteIcon = icon('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z')
export const CheckIcon = icon('M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z')
export const ArrowIcon = icon('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z') // points "back" (left)

export const AVATAR_PALETTE = ['#1F4E79', '#8A6D1F', '#2E7D6B', '#B04A4A', '#6A4C93', '#CC7A00', '#3A7CA5', '#7A8B2E']

/** A coloured circle with the member's initial; `done` adds a gold check, `selected` a ring. */
export function Avatar({ name, colorIndex, size = 40, done = false, selected = false }) {
  const bg = AVATAR_PALETTE[((colorIndex % 8) + 8) % 8]
  return (
    <span className={'avatar' + (selected ? ' sel' : '')} style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}>
      {(name.trim()[0] || '?').toUpperCase()}
      {done && <span className="check"><CheckIcon /></span>}
    </span>
  )
}

export function Switch({ checked, onChange, label }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
}

/** Modal dialog: closes on Escape and on a click outside, focus goes to the first control. */
export function Dialog({ title, onClose, children, actions }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('input, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  )
}

export const fullGregorian = (date, lang) =>
  date.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const timeText = (minuteOfDay, lang) =>
  new Date(2000, 0, 1, Math.floor(minuteOfDay / 60), minuteOfDay % 60)
    .toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' })

export function EntryCard({ entry, lang, cityId, t, onDelete }) {
  const zone = cityById(cityId).zone
  const time = new Date(entry.createdAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone })
  const label = entry.type === 'me' ? t.typeMe : t.typeWorld
  return (
    <li className={'entry ' + entry.type}>
      <span className="dot" />
      <div className="grow">
        <p>{entry.text}</p>
        <p className="meta">{label} · {time}{entry.shared ? ' · ' + t.sharedBadge : ''}</p>
      </div>
      <button className="icon-btn" onClick={onDelete} aria-label={t.del}><DeleteIcon /></button>
    </li>
  )
}
