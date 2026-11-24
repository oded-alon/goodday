import { useApp } from './ctx.js'
import { updateSettings } from './settings.js'
import { Avatar } from './ui.jsx'

/** Per-entry writer choice. Nobody is preselected, so every entry is attributed on purpose. */
export function WriterStrip({ value, onChange }) {
  const { profiles, writersToday, t } = useApp()
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row">
        <h2 className="title-md grow">{t.whoWriting}</h2>
        <span className="label-lg muted">{t.wroteCount(profiles.filter((p) => writersToday.has(p.id)).length, profiles.length)}</span>
      </div>
      <div className="strip" role="group" aria-label={t.whoWriting}>
        {profiles.map((p) => {
          const sel = p.id === value
          return (
            <button key={p.id} onClick={() => onChange(sel ? '' : p.id)} aria-pressed={sel}>
              <Avatar name={p.name} colorIndex={p.colorIndex} size={48} done={writersToday.has(p.id)} selected={sel} />
              <span className="name" style={{ fontWeight: sel ? 700 : 400 }}>{p.name}</span>
            </button>
          )
        })}
      </div>
      {!value && <p className="label-lg muted">{t.pickWriter}</p>}
    </div>
  )
}

/** Whose private entries to show next to the shared ones. UI-level only: it is not a lock. */
export function ViewerBar() {
  const { profiles, viewerId, t } = useApp()
  const set = (id) => updateSettings({ viewerId: id })
  return (
    <div className="viewerbar" role="group" aria-label={t.viewAs}>
      <span className="label-lg muted">{t.viewAs}</span>
      <button className={'chip' + (!viewerId ? ' on' : '')} aria-pressed={!viewerId} onClick={() => set('')}>{t.sharedOnly}</button>
      {profiles.map((p) => (
        <button key={p.id} className={'chip' + (p.id === viewerId ? ' on' : '')} aria-pressed={p.id === viewerId}
          onClick={() => set(p.id === viewerId ? '' : p.id)}>{p.name}</button>
      ))}
    </div>
  )
}
