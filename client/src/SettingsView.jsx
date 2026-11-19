import { useRef, useState } from 'react'
import { useApp } from './ctx.js'
import { addMember, importBackup, removeMember } from './store.js'
import { updateSettings } from './settings.js'
import { setReminder } from './reminders.js'
import { promptInstall, useInstallState } from './install.js'
import { permission, pushSupported } from './push.js'
import { authenticate, signOut } from './sync.js'
import { cityById, cityName, searchCities } from './core/cities.js'
import { sunsetOn } from './core/hebrew.js'
import { BackupError, MAX_NAME, parseBackup, writeBackup } from './core/backup.js'
import { Avatar, DeleteIcon, Dialog, Switch, timeText } from './ui.jsx'

const QUIET_UNTIL_HOUR = 6

function InstallCard() {
  const { t } = useApp()
  const state = useInstallState()
  if (state === 'installed' || state === 'none') return null
  return (
    <Card>
      <h2 className="title-md">{t.installTitle}</h2>
      <p className="muted">{t.installDesc}</p>
      {state === 'prompt'
        ? <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={promptInstall}>{t.installBtn}</button>
        : <p>{t.installIos}</p>}
    </Card>
  )
}

const Card = ({ children }) => <div className="card lg field">{children}</div>

function SwitchRow({ title, desc, checked, onChange, extra }) {
  return (
    <div className="switch-row">
      <div className="grow">
        <div className="title-md">{title}</div>
        {desc && <div className="label-lg muted" style={{ fontWeight: 400 }}>{desc}</div>}
        {extra}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

function ReminderRow({ kind, title, desc }) {
  const { settings, lang, t } = useApp()
  const cfg = settings[kind]
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const toggle = async (on) => {
    setNote('')
    const r = await setReminder(kind, { enabled: on })
    if (r === 'denied') setNote(t.notifBlocked)
    else if (r === 'unsupported') setNote(t.notifUnsupported)
    else if (r === 'error') setNote(t.notifTrouble)
  }
  const open = () => {
    setTime(`${String(Math.floor(cfg.minute / 60)).padStart(2, '0')}:${String(cfg.minute % 60).padStart(2, '0')}`)
    setEditing(true)
  }
  // The cron job that triggers reminders only runs 06:00-24:00.
  const quiet = /^\d\d:\d\d$/.test(time) && Number(time.slice(0, 2)) < QUIET_UNTIL_HOUR
  return (
    <>
      <SwitchRow
        title={title} desc={desc} checked={cfg.enabled} onChange={toggle}
        extra={<button className="btn text" style={{ padding: 0, minHeight: 32 }} onClick={open}>{timeText(cfg.minute, lang)} · {t.setTime}</button>}
      />
      {note && <p className="error label-lg">{note}</p>}
      {editing && (
        <Dialog title={t.setTime} onClose={() => setEditing(false)}
          actions={<>
            <button className="btn text" onClick={() => setEditing(false)}>{t.cancel}</button>
            <button className="btn text" disabled={!time || quiet} onClick={() => {
              const [h, m] = time.split(':').map(Number)
              setReminder(kind, { minute: h * 60 + m })
              setEditing(false)
            }}>{t.ok}</button>
          </>}>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} dir="ltr" />
          {quiet && <p className="error label-lg">{t.nightWarn}</p>}
        </Dialog>
      )}
    </>
  )
}

function CityPicker({ onClose }) {
  const { settings, lang, t } = useApp()
  const [query, setQuery] = useState('')
  const found = searchCities(query)
  return (
    <Dialog title={t.city} onClose={onClose} actions={<button className="btn text" onClick={onClose}>{t.close}</button>}>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchCity} aria-label={t.searchCity}
        autoComplete="off" enterKeyHint="search"
        onKeyDown={(e) => { if (e.key === 'Enter' && found.length === 1) { updateSettings({ cityId: found[0].id }); onClose() } }} />
      <div role="listbox" aria-label={t.city} style={{ overflowY: 'auto', minHeight: 0 }}>
        {found.length === 0 && <p className="muted" style={{ padding: 12 }}>{t.noCities}</p>}
        {found.map((c) => (
          <button key={c.id} role="option" aria-selected={c.id === settings.cityId} className="list-item"
            style={{ fontWeight: c.id === settings.cityId ? 700 : 400 }}
            onClick={() => { updateSettings({ cityId: c.id }); onClose() }}>{cityName(c, lang)}</button>
        ))}
      </div>
    </Dialog>
  )
}

function Backup() {
  const { entries, profiles, settings, t } = useApp()
  const file = useRef(null)
  const [result, setResult] = useState(null)

  const exportFile = () => {
    const json = writeBackup({ entries, profiles, settings })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = `yomtov-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setResult({ lines: [t.exported(entries.length)] })
  }
  const importFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 100 * 1024 * 1024) return setResult({ lines: [t.errLarge] })
    try {
      const r = await importBackup(parseBackup(await f.text()))
      const lines = [t.importAdded(r.added), t.importDupes(r.dupes)]
      if (r.members) lines.push(t.importMembers(r.members))
      if (r.skipped) lines.push(t.importSkipped(r.skipped))
      setResult({ title: t.importTitle, lines })
    } catch (err) {
      setResult({ lines: [err instanceof BackupError ? ({ not_backup: t.errNotBackup, newer: t.errNewer, too_large: t.errLarge })[err.kind] : t.errRead] })
    }
  }
  return (
    <Card>
      <h2 className="title-lg">{t.backup}</h2>
      <p className="muted">{t.backupDesc}</p>
      <div className="row">
        <button className="btn tonal" onClick={exportFile}>{t.export}</button>
        <button className="btn tonal" onClick={() => file.current.click()}>{t.import}</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={importFile} />
      </div>
      {result && (
        <Dialog title={result.title || t.backup} onClose={() => setResult(null)} actions={<button className="btn text" onClick={() => setResult(null)}>{t.ok}</button>}>
          {result.lines.map((l) => <p key={l}>{l}</p>)}
        </Dialog>
      )}
    </Card>
  )
}

function Account() {
  const { auth, sync, wake, t } = useApp()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const offline = wake.status === 'offline'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (offline) return setError(t.errOffline)
    setBusy(true)
    try {
      await authenticate(mode, email.trim(), password)
      setPassword('')
    } catch (err) {
      setError(({ invalid_credentials: t.errCreds, exists: t.errExists, bad_email: t.errBadEmail, bad_password: t.errBadPassword })[err.message] || (err.network ? t.errOffline : t.errGeneric))
    } finally {
      setBusy(false)
    }
  }
  const status = !auth || offline ? t.syncLocal : sync.status === 'synced' ? t.syncSynced : sync.status === 'syncing' ? t.syncSyncing : sync.status === 'error' ? t.syncError : t.syncWaiting
  return (
    <Card>
      <h2 className="title-lg">{t.account}</h2>
      {auth ? (
        <>
          <p>{t.signedInAs}<strong dir="ltr">{auth.email}</strong></p>
          <p className="muted">{status}</p>
          <button className="btn text" style={{ alignSelf: 'flex-start' }} onClick={() => { if (confirm(t.signOutWarn)) signOut() }}>{t.signOut}</button>
        </>
      ) : (
        <form onSubmit={submit} className="field">
          <p className="muted">{t.accountHelp}</p>
          <input type="email" dir="ltr" autoComplete="email" placeholder={t.email} aria-label={t.email} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" dir="ltr" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={t.password} aria-label={t.password}
            value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? t.connecting : t[mode]}</button>
          <p className="center muted">
            {mode === 'login' ? t.noAccount : t.haveAccount}{' '}
            <button type="button" className="btn text" style={{ padding: '0 4px', minHeight: 0 }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
              {mode === 'login' ? t.register : t.login}
            </button>
          </p>
        </form>
      )}
    </Card>
  )
}

export default function SettingsView() {
  const { settings, profiles, lang, now, t } = useApp()
  const [cityOpen, setCityOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [toRemove, setToRemove] = useState(null)
  const city = cityById(settings.cityId)
  const sunset = sunsetOn({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }, city)
  const sunsetText = sunset?.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: city.zone })
  const blocked = pushSupported() && permission() === 'denied'

  return (
    <section className="stack">
      <h1 className="headline">{t.settings}</h1>

      <InstallCard />

      <Card>
        <h2 className="title-md">{t.appearance}</h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {[['system', t.themeSystem], ['light', t.themeLight], ['dark', t.themeDark]].map(([k, label]) => (
            <button key={k} className={'chip' + (settings.theme === k ? ' on' : '')} aria-pressed={settings.theme === k} onClick={() => updateSettings({ theme: k })}>{label}</button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="title-md">{t.language}</h2>
        <div className="row">
          {[['he', 'עברית'], ['en', 'English']].map(([k, label]) => (
            <button key={k} className={'chip' + (lang === k ? ' on' : '')} aria-pressed={lang === k} onClick={() => updateSettings({ lang: k })}>{label}</button>
          ))}
        </div>
      </Card>

      <Card>
        <SwitchRow title={t.familyEnable} desc={t.familyEnableDesc} checked={settings.familyEnabled && profiles.length > 0}
          onChange={(on) => { if (on && profiles.length === 0) setAddOpen(true); else updateSettings({ familyEnabled: on }) }} />
        {profiles.map((p) => (
          <div key={p.id} className="row" style={{ gap: 12 }}>
            <Avatar name={p.name} colorIndex={p.colorIndex} size={36} />
            <span className="grow">{p.name}</span>
            <button className="icon-btn" aria-label={t.remove} onClick={() => setToRemove(p)}><DeleteIcon /></button>
          </div>
        ))}
        <button className="btn tonal" style={{ alignSelf: 'flex-start' }} onClick={() => setAddOpen(true)}>{t.addMember}</button>
      </Card>

      <Card>
        <button className="list-item" style={{ padding: 0 }} onClick={() => setCityOpen(true)}>
          <div className="title-md">{t.city}</div>
          <div className="muted">{cityName(city, lang)}{sunsetText ? ' · ' + t.sunsetToday(sunsetText) : ''}</div>
        </button>
        <SwitchRow title={t.useSunset} desc={t.useSunsetDesc} checked={settings.useSunset} onChange={(v) => updateSettings({ useSunset: v })} />
      </Card>

      <h2 className="title-lg">{t.reminders}</h2>
      <p className="muted">{t.restNote}</p>
      <div className="card tertiary"><p>{t.nightNote}</p></div>
      {blocked && <div className="card tertiary"><p>{t.notifBlocked}</p></div>}
      <Card>
        <ReminderRow kind="evening" title={t.evening} desc={t.eveningDesc} />
        <ReminderRow kind="morning" title={t.morning} desc={t.morningDesc} />
      </Card>

      <Backup />
      <Account />

      {cityOpen && <CityPicker onClose={() => setCityOpen(false)} />}
      {addOpen && (
        <Dialog title={t.addMember} onClose={() => { setAddOpen(false); setName('') }}
          actions={<>
            <button className="btn text" onClick={() => { setAddOpen(false); setName('') }}>{t.cancel}</button>
            <button className="btn text" disabled={!name.trim()} onClick={async () => { await addMember(name); setAddOpen(false); setName('') }}>{t.add}</button>
          </>}>
          <input type="text" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder={t.memberName} aria-label={t.memberName}
            onKeyDown={async (e) => { if (e.key === 'Enter' && name.trim()) { await addMember(name); setAddOpen(false); setName('') } }} />
          {profiles.length === 0 && <p className="muted label-lg" style={{ fontWeight: 400 }}>{t.firstMemberHint}</p>}
        </Dialog>
      )}
      {toRemove && (
        <Dialog title={t.removeTitle(toRemove.name)} onClose={() => setToRemove(null)}
          actions={<>
            <button className="btn text" onClick={() => setToRemove(null)}>{t.cancel}</button>
            <button className="btn text danger" onClick={() => { removeMember(toRemove.id); setToRemove(null) }}>{t.remove}</button>
          </>}>
          <p>{t.removeBody}</p>
        </Dialog>
      )}
    </section>
  )
}
