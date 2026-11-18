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
Tests: `npm test --prefix server`, `npm test --prefix client` (the client test takes ~12 s: it simulates a cold start).

## Deploy to Render

1. `npm run render-env` writes `render-env.txt` (gitignored) from `server/config/cred.json` and a fresh `JWT_SECRET`.
2. Push this repo to a **private** GitHub repo, then create the service from `render.yaml` (New > Blueprint).
3. Paste the variables from `render-env.txt` in the dashboard, deploy, then delete `render-env.txt`.

Data lives in the same Firestore project as personal-diary, under separate collections
(`goodday_users/{hash(email)}/entries`), so nothing is shared with the diary data.
