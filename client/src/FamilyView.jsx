import { useApp } from './ctx.js'
import { Avatar } from './ui.jsx'
import { dayId } from './core/hebrew.js'
import * as S from './core/scoring.js'
import { sameDate } from './TodayView.jsx'

function TeamCard({ s }) {
  const { t } = useApp()
  const { dayAbbr } = t
  return (
    <div className="team">
      <h2 className="title-md" style={{ opacity: 0.8 }}>{t.weekTitle}</h2>
      <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
        <span className="score" dir="ltr">{s.fullHouse.length}/{S.WEEK_GOAL_DAYS}</span>
        <span style={{ paddingBottom: 6 }}>{t.daysEveryone}</span>
      </div>
      {/* One dot per day of the week: gold when everyone wrote, ringed for today, faded for the future */}
      <div className="week-dots">
        {dayAbbr.map((label, i) => {
          const day = s.weekStart + i
          const cls = day > s.today ? 'future' : s.fullHouse.includes(day) ? 'full' : ''
          return <div key={i} className={cls + (day === s.today ? ' today' : '')}><i />{label}</div>
        })}
      </div>
      <div className="row title-md" style={{ gap: 18, flexWrap: 'wrap' }}>
        <span>{t.teamPoints(s.teamPoints)}</span>
        {s.familyStreak > 0 && <span>🔥 {t.streak(s.familyStreak)}</span>}
      </div>
      {s.everyoneToday && <div className="bonus">🎉 {t.everyoneToday(S.FULL_HOUSE_BONUS)}</div>}
    </div>
  )
}

function MemberRow({ stat, top }) {
  const { t } = useApp()
  return (
    <div className="card row" style={{ gap: 14 }}>
      <Avatar name={stat.profile.name} colorIndex={stat.profile.colorIndex} size={48} done={stat.wroteToday} />
      <div className="grow stack" style={{ gap: 4 }}>
        <span className="title-md">{stat.profile.name}</span>
        <span className="label-md muted">{stat.wroteToday ? t.memberDone : t.memberNot}</span>
        <div className="progress-track"><i style={{ width: `${(stat.weekPoints / top) * 100}%` }} /></div>
        <span className="label-md muted">{t.pointsLine(stat.weekPoints, stat.totalPoints)}{stat.streak > 0 ? `  ·  🔥 ${stat.streak}` : ''}</span>
      </div>
    </div>
  )
}

export default function FamilyView() {
  const { entries, profiles, resolved, t } = useApp()
  const ids = profiles.map((p) => p.id)
  const idSet = new Set(ids)
  const today = dayId(resolved.hebrew)
  const scoreRows = entries.filter((e) => idSet.has(e.profileId)).map((e) => ({ memberId: e.profileId, day: dayId({ year: e.hebYear, month: e.hebMonth, day: e.hebDay }) }))
  const start = S.weekStart(today)
  const week = S.weekSummary(scoreRows, ids, start)
  const fullAll = S.fullHouseDays(scoreRows, ids)
  const s = {
    weekStart: start, today,
    fullHouse: [...fullAll].filter((d) => d >= start && d <= start + 6),
    teamPoints: week.teamPoints,
    familyStreak: S.streak(fullAll, today),
    everyoneToday: fullAll.has(today),
  }
  const stats = profiles.map((p) => {
    const days = S.daysWritten(scoreRows, p.id)
    return {
      profile: p, weekPoints: week.members[p.id]?.points || 0, totalPoints: S.personalPoints(scoreRows, p.id),
      streak: S.streak(days, today), wroteToday: days.has(today),
    }
  })
  const top = Math.max(1, ...stats.map((m) => m.weekPoints))
  const shared = entries.filter((e) => e.shared && sameDate(e, resolved.hebrew)).sort((a, b) => b.createdAt - a.createdAt)

  return (
    <section className="stack">
      <TeamCard s={s} />
      <h2 className="title-lg">{t.membersTitle}</h2>
      {stats.map((m) => <MemberRow key={m.profile.id} stat={m} top={top} />)}
      <h2 className="title-lg">{t.sharedToday}</h2>
      {shared.length === 0 ? (
        <p className="muted">{t.nothingShared}</p>
      ) : shared.map((e) => {
        const a = profiles.find((p) => p.id === e.profileId)
        return (
          <div key={e.id} className="card row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Avatar name={a?.name || '?'} colorIndex={a?.colorIndex || 0} size={36} />
            <div className="stack" style={{ gap: 2 }}>
              <span className="label-lg muted">{a?.name || '?'}</span>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text}</p>
            </div>
          </div>
        )
      })}
    </section>
  )
}
