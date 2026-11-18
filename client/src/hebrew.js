import { HDate, Locale, gematriya } from '@hebcal/core'

export const CITIES = [
  { id: 'jerusalem', he: 'ירושלים', en: 'Jerusalem', lat: 31.78, lon: 35.22 },
  { id: 'telaviv', he: 'תל אביב', en: 'Tel Aviv', lat: 32.08, lon: 34.78 },
  { id: 'haifa', he: 'חיפה', en: 'Haifa', lat: 32.79, lon: 34.99 },
  { id: 'beersheva', he: 'באר שבע', en: 'Beer Sheva', lat: 31.25, lon: 34.79 },
  { id: 'newyork', he: 'ניו יורק', en: 'New York', lat: 40.71, lon: -74.01 },
  { id: 'losangeles', he: 'לוס אנג׳לס', en: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { id: 'london', he: 'לונדון', en: 'London', lat: 51.51, lon: -0.13 },
  { id: 'paris', he: 'פריז', en: 'Paris', lat: 48.86, lon: 2.35 },
]
export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[0]

/** Sunset (NOAA "Almanac for Computers" algorithm) near the given instant; a Date. */
export function sunset(now, lat, lon) {
  const rad = Math.PI / 180
  const lngHour = lon / 15
  // The local civil day at this longitude, as a UTC date
  const local = new Date(now.getTime() + lngHour * 3600e3)
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
  if (cosH > 1 || cosH < -1) return null // polar day/night: not relevant to the bundled cities
  const H = Math.acos(cosH) / rad / 15
  const T = H + RA - 0.06571 * t - 6.622
  const UT = (((T - lngHour) % 24) + 24) % 24
  let at = Date.UTC(y, m, d) + UT * 3600e3
  // Keep it on this evening, whichever UTC day the formula landed on
  const eveningCenter = Date.UTC(y, m, d) + (12 - lngHour) * 3600e3 + 6 * 3600e3
  while (at - eveningCenter > 12 * 3600e3) at -= 86400e3
  while (eveningCenter - at > 12 * 3600e3) at += 86400e3
  return new Date(at)
}

const plain = (h) => ({ year: h.getFullYear(), month: h.getMonth(), day: h.getDate() })
const toH = (d) => new HDate(d.day, d.month, d.year)

/** Today's Hebrew date. The Hebrew day starts at sunset in the chosen city. */
export function hebrewToday(cityId, now = new Date()) {
  const c = cityById(cityId)
  const set = sunset(now, c.lat, c.lon)
  const civil = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (set && now >= set) civil.setDate(civil.getDate() + 1)
  return plain(new HDate(civil))
}

export const sameDay = (a, b) => a.year === b.year && a.month === b.month && a.day === b.day
export const dayNumber = (d) => toH(d).abs()
export const isAfter = (a, b) => dayNumber(a) > dayNumber(b)
export const keyOf = (d) => `${d.year}-${d.month}-${d.day}`
export const gregorianOf = (d) => toH(d).greg()

export function monthSequence(year) {
  return [7, 8, 9, 10, 11, 12, ...(HDate.isLeapYear(year) ? [13] : []), 1, 2, 3, 4, 5, 6]
}
export const daysInMonth = (year, month) => HDate.daysInMonth(month, year)

export function shiftMonth({ year, month }, delta) {
  let y = year
  let seq = monthSequence(y)
  let i = seq.indexOf(month) + delta
  while (i < 0) { y -= 1; seq = monthSequence(y); i += seq.length }
  while (i >= seq.length) { i -= seq.length; y += 1; seq = monthSequence(y) }
  return { year: y, month: seq[i] }
}

const noNiqqud = (s) => s.replace(/[֑-ׇ]/g, '')

export function monthName(year, month, lang) {
  const en = new HDate(1, month, year).getMonthName()
  return lang === 'he' ? noNiqqud(Locale.gettext(en, 'he')) : en
}
export const dayLabel = (day, lang) => (lang === 'he' ? gematriya(day) : String(day))
export const yearLabel = (year, lang) => (lang === 'he' ? gematriya(year % 1000) : String(year))

export function fullLabel(d, lang) {
  return `${dayLabel(d.day, lang)} ${monthName(d.year, d.month, lang)} ${yearLabel(d.year, lang)}`
}

/** Sunday-first weekday of the 1st of the month: 0..6 */
export const leadingBlanks = (year, month) => new HDate(1, month, year).greg().getDay()
