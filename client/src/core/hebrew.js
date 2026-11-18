// Pure date logic (no DOM): shared by the client and the server's reminder job.
import { HDate, Locale, gematriya } from '@hebcal/core'

// ---- plain-object helpers ---------------------------------------------------------------------
// A Hebrew date is {year, month, day}; months follow KosherJava/hebcal: 1 Nissan ... 7 Tishrei,
// 12 Adar (Adar I in a leap year), 13 Adar II.
const toH = (d) => new HDate(d.day, d.month, d.year)
const plain = (h) => ({ year: h.getFullYear(), month: h.getMonth(), day: h.getDate() })

export const sameDay = (a, b) => a.year === b.year && a.month === b.month && a.day === b.day
export const keyOf = (d) => `${d.year}-${d.month}-${d.day}`
export const gregorianOf = (d) => toH(d).greg()
export const isLeapYear = (y) => HDate.isLeapYear(y)
export const daysInMonth = (year, month) => HDate.daysInMonth(month, year)
/** Whole days since 1970-01-01 of the Gregorian date of a Hebrew date: a stable integer day id. */
export const dayId = (d) => {
  const g = gregorianOf(d)
  return Math.round(Date.UTC(g.getFullYear(), g.getMonth(), g.getDate()) / 86400000)
}
export const isAfter = (a, b) => dayId(a) > dayId(b)
export const fromDayId = (id) => {
  const g = new Date(id * 86400000)
  return plain(new HDate(new Date(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate())))
}
export const hebrewOfCivil = ({ y, m, d }) => plain(new HDate(new Date(y, m - 1, d)))

// ---- time zones ---------------------------------------------------------------------------------
/** Wall-clock parts of an instant in an IANA zone. */
export function zonedParts(instant, zone) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute }
}
export const addCivilDays = ({ y, m, d }, n) => {
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}
export const civilKey = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// ---- sunset ---------------------------------------------------------------------------------------
/** Sunset (NOAA "Almanac for Computers") on the civil day containing `near`, at the city's longitude. */
export function sunsetNear(near, lat, lon) {
  const rad = Math.PI / 180
  const lngHour = lon / 15
  const local = new Date(near.getTime() + lngHour * 3600e3)
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate()
  const N = Math.floor((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 86400e3)
  const t = N + (18 - lngHour) / 24
  const M = 0.9856 * t - 3.289
  const L = (M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634 + 720) % 360
  let RA = (Math.atan(0.91764 * Math.tan(L * rad)) / rad + 360) % 360
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90
  RA /= 15
  const sinDec = 0.39782 * Math.sin(L * rad)
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad))
  if (cosH > 1 || cosH < -1) return null // the sun does not set
  const H = Math.acos(cosH) / rad / 15
  const T = H + RA - 0.06571 * t - 6.622
  const UT = (((T - lngHour) % 24) + 24) % 24
  let at = Date.UTC(y, m, d) + UT * 3600e3
  const eveningCenter = Date.UTC(y, m, d) + (12 - lngHour) * 3600e3 + 6 * 3600e3
  while (at - eveningCenter > 12 * 3600e3) at -= 86400e3
  while (eveningCenter - at > 12 * 3600e3) at += 86400e3
  return new Date(at)
}

/** Sunset of a civil date {y,m,d} in a city. */
export function sunsetOn(civil, city) {
  const solarNoon = Date.UTC(civil.y, civil.m - 1, civil.d, 12) - (city.lon / 15) * 3600e3
  return sunsetNear(new Date(solarNoon), city.lat, city.lon)
}

/**
 * Which Hebrew day an instant belongs to. With `useSunset`, the day starts at sunset, so the
 * evening counts for the next Hebrew date (`afterNightfall`).
 */
export function resolveDate(instant, city, useSunset = true) {
  const civil = zonedParts(instant, city.zone)
  const sunset = sunsetOn(civil, city)
  const afterNightfall = !!(useSunset && sunset && instant >= sunset)
  const hebrewCivil = afterNightfall ? addCivilDays(civil, 1) : civil
  return { civil, hebrew: hebrewOfCivil(hebrewCivil), afterNightfall, sunset }
}

// ---- months ---------------------------------------------------------------------------------------
export function monthSequence(year) {
  return [7, 8, 9, 10, 11, 12, ...(isLeapYear(year) ? [13] : []), 1, 2, 3, 4, 5, 6]
}
export function shiftMonth({ year, month }, delta) {
  let y = year
  let seq = monthSequence(y)
  let i = seq.indexOf(month) + delta
  while (i < 0) { y -= 1; seq = monthSequence(y); i += seq.length }
  while (i >= seq.length) { i -= seq.length; y += 1; seq = monthSequence(y) }
  return { year: y, month: seq[i] }
}
/** Sunday-first weekday of the 1st of the month: 0..6 */
export const leadingBlanks = (year, month) => new HDate(1, month, year).greg().getDay()

// ---- formatting -----------------------------------------------------------------------------------
const noNiqqud = (s) => s.replace(/[֑-ׇ]/g, '')
export function monthName(year, month, lang) {
  const en = new HDate(1, month, year).getMonthName()
  return lang === 'he' ? noNiqqud(Locale.gettext(en, 'he')) : en
}
export const dayLabel = (day, lang) => (lang === 'he' ? gematriya(day) : String(day))
export const yearLabel = (year, lang) => (lang === 'he' ? gematriya(year % 1000) : String(year))
export const fullLabel = (d, lang) => `${dayLabel(d.day, lang)} ${monthName(d.year, d.month, lang)} ${yearLabel(d.year, lang)}`

// ---- anniversaries ("a year ago on this Hebrew date") -------------------------------------------------
const ADAR = 12
const ADAR_II = 13
/** Same Hebrew day in another year; Adar I/II and day 30 edge cases handled like the Android app. */
export function inYear(d, targetYear) {
  let month = d.month
  if (d.month === ADAR_II && !isLeapYear(targetYear)) month = ADAR
  else if (d.month === ADAR && !isLeapYear(d.year) && isLeapYear(targetYear)) month = ADAR_II
  return { year: targetYear, month, day: Math.min(d.day, daysInMonth(targetYear, month)) }
}
export const DEFAULT_YEARS_BACK = 10
export function anniversaryTargets(today, back = DEFAULT_YEARS_BACK) {
  return Array.from({ length: back }, (_, i) => today.year - (i + 1))
    .filter((y) => y >= 3761)
    .map((y) => inYear(today, y))
}
