import { useMemo } from 'react'
import { restEnd } from './core/rest.js'
import { timeText } from './ui.jsx'

/** Shown instead of the app during Shabbat and Yom Tov. No controls, no network. */
export default function RestScreen({ city, now, lang, t }) {
  const minuteBucket = Math.floor(now.getTime() / 600_000)
  const end = useMemo(() => restEnd(city, now), [city, minuteBucket]) // eslint-disable-line react-hooks/exhaustive-deps
  const when = end
    ? end.toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: city.zone })
    : null
  return (
    <main className="rest" role="main">
      <div className="inner">
        <img src="/icon-192.png" alt="" />
        <h1>{t.restTitle}</h1>
        <p>{t.restBody}</p>
        {when && <p className="until">{t.restUntil(when)}</p>}
      </div>
    </main>
  )
}
