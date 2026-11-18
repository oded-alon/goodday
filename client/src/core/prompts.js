// Rotating prompts (same sets as the Android app). Index changes every day.
export const PROMPTS = {
  he: {
    empty: ['דבר טוב אחד מספיק.', 'מי הצחיק או שימח אותך היום?', 'מה הלך טוב יותר ממה שציפית?', 'על איזה דבר קטן אתה אסיר תודה?', 'איזו בשורה טובה שמעת?'],
    evening: ['מה היה טוב היום?', 'דבר טוב אחד מספיק. מה היה שלך?', 'מי או מה הצחיק אותך היום?', 'רגע של עצירה: מה הלך טוב היום?', 'יש בשורה טובה היום, גדולה או קטנה?'],
    morning: ['מה יהפוך את היום הזה ליום טוב?', 'חפשו היום דבר טוב אחד.', 'למה אתם מצפים היום?', 'שימו לב היום למשהו טוב.', 'יום חדש. איזה דבר טוב קטן תמצאו?'],
    family: ['למי עוד יש דבר טוב להוסיף היום?', 'המשפחה מחכה לדבר הטוב שלך!', 'דבר טוב מכל אחד, וכל המשפחה מנצחת.'],
  },
  en: {
    empty: ['One good thing is enough.', 'Who made you smile today?', 'What went better than expected?', 'What small thing are you grateful for?', 'What good news did you hear?'],
    evening: ['What was good today?', 'One good thing is enough. What was yours?', 'Who or what made you smile today?', 'Take a moment: what went well today?', 'Any good news today, big or small?'],
    morning: ['What would make today a good day?', 'Look for one good thing today.', 'What are you looking forward to?', 'Notice something good today.', 'A new day. What small good thing can you find?'],
    family: ['Who still has a good thing to add today?', 'The family is waiting for your good thing!', 'One good thing each, and the whole family scores.'],
  },
}

/** Which of `size` prompts to use on a civil date; never out of range. */
export function promptIndex(size, { y, m, d }) {
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000)
  return ((dayOfYear % size) + size) % size
}
export const pickPrompt = (kind, lang, civil) => {
  const list = PROMPTS[lang][kind]
  return list[promptIndex(list.length, civil)]
}
