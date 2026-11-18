# Good Day (יום טוב) – PWA

Write down the good things of each day, on the Hebrew calendar (the day starts at sunset). Offline-first
PWA with an Express + Firestore backend, designed for a **free Render instance that sleeps and takes
30–60 s to wake**.

## How it copes with the cold start

| Layer | What it does |
|---|---|
| Service worker (`client/public/sw.js`) | After the first visit, the app shell loads from cache instantly, even while the server sleeps or the phone is offline. |
| Local-first data (`db.js`, `store.js`) | Every entry is written to IndexedDB first. Writing, browsing and deleting never wait for the network. |
| Wake manager (`wake.js`) | Polls `/api/health` (must return our JSON, not Render's placeholder page). After 3.5 s without an answer it shows the "longer-than-usual wait" dialog; after 2 min it says the server is still unreachable and keeps retrying quietly. Re-checks on tab focus, coming back online, or a failed request. |
| Background sync (`sync.js`) | Runs only when signed in and the server is awake. One `POST /api/sync` pushes dirty entries and pulls changes (last-write-wins, deletes are tombstones). Failure just leaves entries dirty for the next try. |
| Accounts are optional | No login wall: guests keep everything on the device. Signing in is the only action that must wait for the server. |

## Features (same as the Android app)

- **Today**: Hebrew date header (night variant after sunset: "counts as tomorrow"), write a good thing (mine / in the world), "a year ago on this Hebrew date" memories, rotating prompts.
- **Calendar**: Hebrew month grid with activity heat, add entries to previous days (never the future).
- **Family game** (one shared phone, member profiles): "who is writing", private-by-default entries with optional sharing, team goal of 7 days, personal points, streaks, full-house bonus.
- **Shabbat and Yom Tov**: the app does not run. It shows a rest screen (with when it returns) and makes no network calls, using the same quiet window as notifications (40 min before the sunset that starts it to 72 min after the one that ends it, per the chosen city; Israel vs diaspora second day).
- **Settings**: Hebrew/English, light/dark/device theme, 105 bundled cities with search (62 of them Israeli) for sunset (no GPS), sunset on/off, reminders, backup export/import (the same JSON format as the Android app, so a journal moves between them).
- **Reminders** via Web Push, never on Shabbat or Yom Tov (see below). The Android home-screen widget has no web equivalent.

## Reminders (Web Push) on a free Render instance

A sleeping instance cannot send anything at 21:00, so something has to call it. Create a free job at
[cron-job.org](https://cron-job.org) (or any cron service) that requests this URL **every 5 minutes**:

```
https://YOUR-APP.onrender.com/api/push/tick?key=<CRON_SECRET from render-env.txt>
```

Each call wakes the server and sends whatever is due (a reminder is due for 10 minutes after its time, once per
day). It also keeps the instance warm, which removes the cold start entirely; one always-on free service fits
inside Render's 750 free hours per month. Rules enforced on every send: nothing during Shabbat or Yom Tov (from
40 minutes before the sunset that begins it to 72 minutes after the one that ends it, Israel vs diaspora second
day), at most one per kind per day, the evening reminder is skipped if you (or, in the family game, everyone)
already wrote today (needs an account, so the server knows), and an undelivered push expires after 10 minutes
instead of arriving late. iPhone only supports web push for apps added to the home screen.

Still unavoidable: the very first visit ever (nothing cached yet) must download the page from the sleeping
server. To remove even that, host `client/dist` on an always-on static host and set `VITE_API_URL` at build
time + `CLIENT_ORIGIN` on the server, or ping `/api/health` every ~10 min from a free uptime monitor.

## Develop

```
npm run install:all
# server/config/cred.json = Firestore service account (gitignored); server/.env needs JWT_SECRET
npm run dev:server     # http://localhost:3040
npm run dev:client     # http://localhost:5173 (proxies /api)
```
Tests: `npm test --prefix server`, `npm test --prefix client` (about 12 s: it includes a simulated cold start).
Manual checks against the real Firestore (each cleans up after itself): `node server/test/sync.manual.js` (with the server running) and `node server/test/reminders.manual.js`.

## Deploy to Render

1. `npm run render-env` writes `render-env.txt` (gitignored) from `server/config/cred.json` and a fresh `JWT_SECRET`.
2. Push this repo to a **private** GitHub repo, then create the service from `render.yaml` (New > Blueprint).
3. Paste the variables from `render-env.txt` in the dashboard, deploy, then delete `render-env.txt`.

Data lives in the same Firestore project as personal-diary, under separate collections
(`goodday_users/{hash(email)}/entries`), so nothing is shared with the diary data.
