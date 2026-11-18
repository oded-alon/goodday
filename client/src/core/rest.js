// Shabbat and Yom Tov: the app must stay silent then (hard rule). Port of RestDays.kt.
// The Hebrew day starts at sunset, so the quiet window starts before the sunset that begins the day
// (candle lighting, whichever custom) and ends after the sunset that ends it (latest common nightfall).
import { HDate, HebrewCalendar, flags } from '@hebcal/core'
import { addCivilDays, sunsetOn, zonedParts } from './hebrew.js'
import { inIsrael } from './cities.js'

export const BEFORE_SUNSET_MS = 40 * 60e3
export const AFTER_SUNSET_MS = 72 * 60e3

/** Shabbat or Yom Tov (work forbidden) on a civil date. Chol Hamoed, Purim and fasts are not rest days. */
export function isRestDay({ y, m, d }, israel) {
  if (new Date(y, m - 1, d).getDay() === 6) return true
  const events = HebrewCalendar.getHolidaysOnDate(new HDate(new Date(y, m - 1, d)), israel) || []
  return events.some((e) => e.getFlags() & flags.CHAG)
}

function windowOf(city, restDay) {
  // Without a sunset fall back to a plain evening-to-evening day
  const fallback = (c, h) => new Date(Date.UTC(c.y, c.m - 1, c.d, h) - (city.lon / 15) * 3600e3)
  const eve = addCivilDays(restDay, -1)
  const start = sunsetOn(eve, city) || fallback(eve, 17)
  const end = sunsetOn(restDay, city) || fallback(restDay, 19)
  return [start.getTime() - BEFORE_SUNSET_MS, end.getTime() + AFTER_SUNSET_MS]
}

/** True when the instant is inside the quiet window of Shabbat or Yom Tov in the city. */
export function isRestTime(city, instant) {
  const today = zonedParts(instant, city.zone)
  const israel = inIsrael(city)
  const t = instant.getTime()
  // The window of a rest day D reaches back into the evening of D-1, so check today and tomorrow.
  return [today, addCivilDays(today, 1)].some((day) => {
    if (!isRestDay(day, israel)) return false
    const [from, to] = windowOf(city, day)
    return t >= from && t <= to
  })
}
