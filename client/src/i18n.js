const STR = {
  he: {
    appName: 'יום טוב',
    today: 'היום', calendar: 'לוח שנה', settings: 'הגדרות',
    me: 'אני', world: 'העולם',
    hintMe: 'מה היה טוב היום?', hintMePast: 'מה היה טוב באותו יום?', hintWorld: 'מה טוב קרה בעולם?',
    save: 'שמירה', cancel: 'ביטול', del: 'מחיקה',
    nothingYet: 'עוד לא נכתב כלום ליום הזה.',
    addToDay: 'הוספה ליום הזה', backToToday: 'חזרה להיום',
    prevMonth: 'חודש קודם', nextMonth: 'חודש הבא',
    language: 'שפה', city: 'עיר (לשקיעה)', cityHelp: 'היום העברי מתחיל בשקיעה.',
    account: 'חשבון וסנכרון',
    accountHelp: 'ללא חשבון הכול נשמר רק במכשיר הזה. עם חשבון הרשומות מסתנכרנות בין מכשירים.',
    email: 'אימייל', password: 'סיסמה (8 תווים לפחות)', login: 'התחברות', register: 'הרשמה',
    haveAccount: 'כבר יש חשבון?', noAccount: 'אין חשבון?', signOut: 'התנתקות',
    signOutWarn: 'ההתנתקות תמחק את הרשומות מהמכשיר הזה (הן נשארות בשרת). להמשיך?',
    signedInAs: 'מחובר כ־', connecting: 'מתחבר…',
    errOffline: 'אין חיבור לאינטרנט.',
    errCreds: 'אימייל או סיסמה שגויים.', errExists: 'כבר קיים חשבון עם האימייל הזה.',
    errBadEmail: 'כתובת אימייל לא תקינה.', errBadPassword: 'הסיסמה צריכה להיות באורך 8 תווים לפחות.',
    errGeneric: 'משהו השתבש. נסו שוב.',
    syncLocal: 'נשמר במכשיר', syncWaiting: 'ממתין לשרת', syncSyncing: 'מסנכרן…',
    syncSynced: 'מסונכרן', syncError: 'הסנכרון ייבדק שוב',
    wakeTitle: 'יש זמן המתנה ארוך מהרגיל בתחילת השימוש באפליקציה.',
    wakeBody: 'השרת מתעורר, וזה יכול לקחת עד כדקה. אפשר להמשיך לכתוב בינתיים — הכול נשמר במכשיר ויסונכרן אוטומטית כשהשרת יהיה מוכן.',
    wakeUnreachable: 'עדיין אין תגובה מהשרת. אפשר להמשיך לעבוד כרגיל — נמשיך לנסות ברקע.',
    wakeContinue: 'להמשיך בינתיים', wakeElapsed: (s) => `עברו ${s} שניות`,
    wokeToast: 'השרת מוכן — הרשומות סונכרנו.',
    offlineBanner: 'אין חיבור — הכול נשמר במכשיר.',
    notPersistent: 'האחסון המקומי חסום בדפדפן הזה, הרשומות יאבדו בסגירה.',
    entriesCount: (n) => (n === 0 ? 'אין רשומות' : n === 1 ? 'רשומה אחת' : `${n} רשומות`),
    dayAbbr: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
  },
  en: {
    appName: 'Good Day',
    today: 'Today', calendar: 'Calendar', settings: 'Settings',
    me: 'Me', world: 'The world',
    hintMe: 'What was good today?', hintMePast: 'What was good that day?', hintWorld: 'What good happened in the world?',
    save: 'Save', cancel: 'Cancel', del: 'Delete',
    nothingYet: 'Nothing written for this day yet.',
    addToDay: 'Add to this day', backToToday: 'Back to today',
    prevMonth: 'Previous month', nextMonth: 'Next month',
    language: 'Language', city: 'City (for sunset)', cityHelp: 'The Hebrew day starts at sunset.',
    account: 'Account & sync',
    accountHelp: 'Without an account everything stays on this device only. With one, entries sync across your devices.',
    email: 'Email', password: 'Password (8+ characters)', login: 'Sign in', register: 'Create account',
    haveAccount: 'Already have an account?', noAccount: 'No account yet?', signOut: 'Sign out',
    signOutWarn: 'Signing out removes the entries from this device (they stay on the server). Continue?',
    signedInAs: 'Signed in as ', connecting: 'Connecting…',
    errOffline: 'You are offline.',
    errCreds: 'Wrong email or password.', errExists: 'An account with this email already exists.',
    errBadEmail: 'That email address is not valid.', errBadPassword: 'The password must be at least 8 characters.',
    errGeneric: 'Something went wrong. Please try again.',
    syncLocal: 'Saved on this device', syncWaiting: 'Waiting for server', syncSyncing: 'Syncing…',
    syncSynced: 'Synced', syncError: 'Will retry sync',
    wakeTitle: 'There is a longer-than-usual wait time when starting to use the app.',
    wakeBody: 'The server is waking up, which can take up to a minute. You can keep writing in the meantime: everything is saved on your device and will sync automatically once the server is ready.',
    wakeUnreachable: 'The server still is not answering. You can keep using the app as normal; we will keep trying in the background.',
    wakeContinue: 'Continue meanwhile', wakeElapsed: (s) => `${s} seconds so far`,
    wokeToast: 'Server is ready — your entries are synced.',
    offlineBanner: 'You are offline. Everything is saved on this device.',
    notPersistent: 'Local storage is blocked in this browser, entries will be lost when you close it.',
    entriesCount: (n) => (n === 0 ? 'no entries' : n === 1 ? '1 entry' : `${n} entries`),
    dayAbbr: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  },
}

export function getLang() {
  try {
    const saved = localStorage.getItem('goodday.lang')
    if (saved === 'he' || saved === 'en') return saved
  } catch { /* ignore */ }
  return 'he' // Hebrew by default, English in settings
}
export function saveLang(l) {
  try { localStorage.setItem('goodday.lang', l) } catch { /* ignore */ }
}
export const strings = (lang) => STR[lang]
