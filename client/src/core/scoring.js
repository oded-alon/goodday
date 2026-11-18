// Family game scoring, a straight port of FamilyScoring.kt. Everything derives from the entries,
// so deleting an entry removes its points. A "day" is a dayId (see hebrew.js) of the entry's Hebrew date.
export const FIRST_ENTRY_POINTS = 3
export const EXTRA_ENTRY_POINTS = 1
export const MAX_EXTRA_ENTRIES = 3
export const FULL_HOUSE_BONUS = 5
export const WEEK_GOAL_DAYS = 7

/** First entry of the day is worth the most; a few extras count, the rest do not (no spamming). */
export const pointsForDay = (n) => (n <= 0 ? 0 : FIRST_ENTRY_POINTS + Math.min(n - 1, MAX_EXTRA_ENTRIES) * EXTRA_ENTRY_POINTS)

/** The Sunday that starts the week containing the day (the Hebrew week runs Sunday to Shabbat). */
export const weekStart = (day) => day - (((day + 4) % 7) + 7) % 7 // 1970-01-01 was a Thursday

const perDay = (entries, memberId) => {
  const m = new Map()
  for (const e of entries) if (e.memberId === memberId) m.set(e.day, (m.get(e.day) || 0) + 1)
  return m
}

export const daysWritten = (entries, memberId) => new Set(perDay(entries, memberId).keys())
export const personalPoints = (entries, memberId) =>
  [...perDay(entries, memberId).values()].reduce((s, n) => s + pointsForDay(n), 0)

/** Days on which every member wrote at least once. */
export function fullHouseDays(entries, memberIds) {
  if (!memberIds.length) return new Set()
  const ids = new Set(memberIds)
  const byDay = new Map()
  for (const e of entries) {
    if (!ids.has(e.memberId)) continue
    if (!byDay.has(e.day)) byDay.set(e.day, new Set())
    byDay.get(e.day).add(e.memberId)
  }
  return new Set([...byDay].filter(([, s]) => s.size === ids.size).map(([d]) => d))
}

/** Consecutive days ending today, or yesterday if today is still open (no penalty in the morning). */
export function streak(days, today) {
  let cursor = days.has(today) ? today : today - 1
  let n = 0
  while (days.has(cursor)) { n++; cursor-- }
  return n
}

export function weekSummary(entries, memberIds, start) {
  const inWeek = entries.filter((e) => e.day >= start && e.day <= start + 6)
  const members = {}
  for (const id of memberIds) {
    const p = perDay(inWeek, id)
    members[id] = { points: [...p.values()].reduce((s, n) => s + pointsForDay(n), 0), daysWritten: p.size }
  }
  const fullHouse = fullHouseDays(inWeek, memberIds).size
  const teamPoints = Object.values(members).reduce((s, m) => s + m.points, 0) + fullHouse * FULL_HOUSE_BONUS
  return { weekStart: start, fullHouseDays: fullHouse, teamPoints, members }
}
