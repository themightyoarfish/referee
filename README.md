# Referee — powerlifting judging system

Web application for running powerlifting referee lights at a competition. Three judges (left, center, right) submit lift decisions from mobile devices; a display screen shows the lights, countdown timer, and current attempt. Optionally integrates with [VPortal](https://vportal-online.de) to pull live attempt data and push results back.

**Use this software only on a trusted private network.** Change all default passwords and referee tokens immediately after installation. Do not expose it to the public internet.

---

## How it works (high level)

```
┌─────────────────┐     QR on /display    ┌──────────────────┐
│  Projector PC   │ ────────────────────► │  Judge phone     │
│  /display       │   http://IP/ref?token │  (browser or app)│
└────────┬────────┘                       └────────┬─────────┘
         │                                         │
         │  Socket.io (real-time)                  │  REST API
         ▼                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Node.js server (:3030)                  │
│  • Stores settings & tokens (PouchDB)                       │
│  • Holds current rating state in memory                     │
│  • Broadcasts lights/timer to all connected browsers        │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     optional        ┌──────────────────┐
│  Display TV /   │                     │  VPortal API     │
│  projector      │ ◄── attempt data ── │  (competition    │
│  /display       │ ── lift result ──►  │   management)    │
└─────────────────┘                     └──────────────────┘
```

1. Start the server (Docker or Node). On each start, **new random tokens** are generated for the three judge positions (left, main, right).
2. Open **`/display`** on the projector or competition laptop. Three **QR codes** (left, main, right) appear below the lights unless disabled in Settings.
3. Each judge scans **their** QR code with a phone camera or the Android referee app. The link opens **`/ref?token=…`** in the mobile browser (or the app). Tokens are long random hex strings; guessing a URL is not practical.
4. An **admin** logs in at `/login` for home, settings, and VPortal configuration. Kiosk routes (`/display`, `/countdown`, `/versuch`, `/ref`) stay available without admin login.
5. Only **one active connection per judge position** is allowed at a time (a second device receives an error until the first disconnects).
6. When a referee taps a button, the server records the decision and **broadcasts** the updated state to every connected client (display screen, countdown, attempt board) via **Socket.io**.
7. After all three judges have submitted, the majority decision can optionally be **sent to VPortal** and the lights **auto-reset** after a configurable delay.

---



## Web referee handsets (browser)

Judges can use any modern mobile browser instead of the Android app. The flow is the same as for the app: scan a QR code, land on `/ref`, submit lights and (for the head judge) start/reset when no separate timekeeper is enabled.

### Setup on competition day

1. Start the server and note the LAN URL (shown on `/` after admin login, or in server logs), e.g. `http://192.168.1.10:3030`.
2. On the **display machine**, open **`http://<HOST_IP>:3030/display`** in full screen (kiosk mode on a Raspberry Pi is described below).
3. Confirm the three QR codes under the lights label **Links**, **Haupt**, and **Rechts**.
4. Each judge scans only their code. After login they see the colored decision buttons (Weiß, Rot, Blau, Gelb). The head judge also sees **Start** and **Reset** when **Separater Zeitnehmer** is off in Settings.
5. Optional: enable **Ref Menu anzeigen** in Settings if judges should see the navigation bar on `/ref`.

### Tips

- Phones must be on the **same Wi‑Fi / LAN** as the server.
- If QR codes show wrong hostnames, set **`HOST_IP`** (required on macOS/Windows Docker).
- After a **server restart**, tokens change; judges must **scan again** (new QR codes on `/display`).
- To hide QR codes on the projector, turn off **KaRi-QR auf Display** in Settings.

### Timekeeper

The timekeeper role is **not** shown on the display QR row. Use the timekeeper QR in **Settings** (after admin login) or enter that token manually on `/ref`.

---

## Android app interaction (QR code login)

The web app does not contain the Android app source code, but it defines the same contract the app uses to connect.

### What the QR code contains

On **`/display`**, each of the three judge roles has a QR code. In **Settings**, all referee roles (including timekeeper) also have QR codes. They encode:

```
http://<HOST_IP>:<PORT>/ref?token=<REFeree_TOKEN>
```

Example: `http://192.168.1.10:3030/ref?token=a3f91c2b`

- `HOST_IP` is the server’s LAN address (see environment variables below). Referee phones must reach this IP on the competition network.
- `token` is a unique secret per role. For **left**, **main**, and **right**, a **new random token is generated every time the server process starts**. The timekeeper token stays in the database until changed in Settings.



### Login flow

1. **Scan** — The Android app scans the QR code and extracts the URL (or the user enters the token manually on the `/ref` page).
2. **Authenticate** — The client calls `GET /auth/ref?token=<token>`. The server looks up the token in PouchDB and returns the referee record, for example:
  ```json
   { "_id": "left", "position": "left", "token": "4711", "role": "ref" }
  ```
3. **Session** — The web UI stores the token in `localStorage` as `refToken` so the referee stays logged in across page reloads.
4. **Submit decisions** — Tapping a light button sends:
  ```
   GET /api/ref?token=<token>&light=white|red|blue|yellow
  ```
   The server maps the token to a position (`left`, `main`, or `right`) and records that judge’s decision.
5. **Real-time sync** — All connected browsers receive updates on the `rating` Socket.io event, so the display updates instantly without polling.



### Referee roles


| Role (`_id`) | Purpose                                                                             |
| ------------ | ----------------------------------------------------------------------------------- |
| `left`       | Left side judge — submits white/red/blue/yellow                                     |
| `main`       | Head judge — submits decisions; can start timer and reset if no separate timekeeper |
| `right`      | Right side judge — submits white/red/blue/yellow                                    |
| `timekeeper` | Starts/stops the 60-second countdown and can reset the rating                       |




### Decision rules

- Each judge may submit **once** per attempt. After all three judges (`left`, `main`, `right`) have submitted, further changes are blocked until reset.
- **Valid lift**: at least two of three judges selected white.
- **No lift**: fewer than two whites (red, blue, or yellow count as no-lift signals).

---



## Prerequisites


| Requirement              | Notes                                                 |
| ------------------------ | ----------------------------------------------------- |
| **Docker** (recommended) | Easiest way to run in production                      |
| **Node.js ≥ 18.18.2**    | Only if running without Docker                        |
| **npm**                  | Comes with Node.js                                    |
| **Network**              | All devices (server, phones, display) on the same LAN |


For Raspberry Pi: use a **64-bit** OS. The Docker image will not start on 32-bit ARM.

---

## Run on macOS (no Terminal)

For a meet laptop, use **Referee.app** instead of Docker or the command line.

1. On a Mac, from the project root, run `./build-app.sh` (requires network once to download Node.js). Output: `build/macos/Referee.app`.
2. Copy **Referee.app** to Applications and double-click it.
3. **First launch:** dialogs ask for an admin username and password (for `/login` in the browser). Values are stored in the **macOS Keychain**, not in a text file.
4. **Every launch:** a short dialog lets you **Server starten** or **Server beenden** (or **Abbrechen**). The same dialog explains that you stop the server by opening Referee again later and choosing **Server beenden**. **Server starten** always starts fresh: if a server is already running, it is stopped first, then you get the network picker and a new server.
5. After **Server starten**, choose which **local network address** judges should use (Wi‑Fi or Ethernet). The app does **not** remember last week’s address on disk.
6. The browser opens the display page. Judges scan QR codes on that network. Referee itself can close; the server keeps running in the background until you **Server beenden** from a later launch.

Data is stored under `~/Library/Application Support/Referee/` (database and logs).

**Troubleshooting:** After `./build-app.sh`, copy the new `build/macos/Referee.app` into Applications (replace the old one). If you see “Referee wird bereits gestartet…” on every launch with no window, update to a build that uses the `mkdir` launcher lock (older builds mistakenly required `flock`, which macOS does not include). Run `packaging/macos/cleanup-stale-referee.sh`, then try again. If the Dock icon bounces and nothing opens, or macOS says the app is not open anymore, a previous server may still be on port 3030 or a second launch overlapped the first. Run the cleanup script, wait a few seconds, then open Referee again. Do not double-click Referee repeatedly while it is starting.

**Cannot delete or replace Referee.app (“application is open”):** A server process may still be running. Open Referee and choose **Server beenden**, or run `packaging/macos/cleanup-stale-referee.sh`. In Activity Monitor, look for `node` under `/Applications/Referee.app/...` and quit it, then try deleting the app again.

To change the network address during the same day without restarting: log in as admin → **Settings** → **Adresse für QR-Codes** (until the server is stopped).

**Security:** The signing key for admin sessions and the admin password are read from Keychain inside the server process—they are not passed on the command line. The chosen LAN IP is passed only for that run (`HOST_IP`), which is expected.

---

## Quick start with Docker (recommended)

The repository ships a ready-to-use `docker-compose.yml`. It maps port **3030**, persists data in `./database`, loads secrets from an env file, and **builds the image from the local checkout** by default (`build: .` → `referee:latest`).

### 1. Clone and prepare data directory

```bash
git clone https://github.com/franknitschke/referee.git
cd referee
mkdir -p database
```

The `database` folder persists settings, tokens, and VPortal credentials across container restarts.

### 2. Secrets and `HOST_IP`

Compose loads `SECRET`, `ADMIN_USER`, and `ADMIN_PASSWORD` from **`env_file`** (the repo points at `.env.example` for a quick dev bootstrap). For anything beyond local testing, copy it to a private file and point compose at that file:

```bash
cp .env.example .env
# edit .env: long random SECRET, admin username/password
```

In `docker-compose.yml`, change `env_file: .env.example` to `env_file: .env` (do not commit `.env`).

Set **`HOST_IP`** in `docker-compose.yml` to this machine’s **LAN** address (the IP phones and the display use to reach the server). That is required with port-mapped Docker (macOS, Windows, and typical Linux setups). The checked-in value is only an example; replace it with yours.

Find your LAN IP:

- **macOS**: System Settings → Network, or `ipconfig getifaddr en0`
- **Linux**: `hostname -I | awk '{print $1}'`

Current compose file (customize `HOST_IP` and `env_file`):

```yaml
services:
  referee:
    build: .
    image: referee:latest
    restart: no
    ports:
      - 3030:3030
    volumes:
      - ./database:/home/app/server/db/database
    env_file: .env.example
    environment:
      DOCKER_RUNNING: true
      HOST_IP: 192.168.1.128   # replace with your LAN IP
      FETCH_INTERVAL: 2000
      VPORTAL_URL: bvdk
```

For production, consider `restart: unless-stopped` or `restart: always`.

### 3. Start — build image locally (default)

From the repo root:

```bash
docker compose up --build
```

Use **`--build`** after you pull git changes so the Dockerfile re-runs `npm run build` in `client/` and picks up server changes. The image is tagged **`referee:latest`**.

Open **[http://localhost:3030](http://localhost:3030)** on the host, or **`http://<HOST_IP>:3030`** from other devices on the LAN.

You can build the same image without compose:

```bash
docker build -t referee:latest .
```

### 4. Start — pull pre-built image from GHCR

To run a published image instead of building from source, edit `docker-compose.yml`:

1. Remove the **`build: .`** line.
2. Set **`image: ghcr.io/franknitschke/referee:latest`** (keep or drop the local `referee:latest` name; compose only needs one `image` key).

Then:

```bash
docker compose pull
docker compose up
```

If `pull` fails with an authorization error, log in to GitHub Container Registry (`docker login ghcr.io`) or build locally (section 3).

---



## Local development (without Docker)

Useful when changing frontend or backend code.

### macOS

```bash
# Install Node.js 18+ (e.g. via https://nodejs.org or nvm)

git clone https://github.com/franknitschke/referee.git
cd referee

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
npm run build    # production build served by Express

# Start server (serves API + built React app on port 3030)
cd ../server
npm run dev      # nodemon with auto-restart
```

For **frontend hot reload** during development, run the server and client in two terminals:

```bash
# Terminal 1 — API + Socket.io
cd server && npm run dev

# Terminal 2 — React dev server (proxies API calls to :3030)
cd client && npm start
```

The React dev server runs on **[http://localhost:3000](http://localhost:3000)** and proxies `/api`, `/auth`, and Socket.io to port 3030 (configured in `client/package.json`).

### Linux

Same steps as macOS. On Raspberry Pi or a competition laptop:

```bash
sudo apt update && sudo apt install -y nodejs npm git
# Ensure Node >= 18.18.2; use nvm if the distro package is too old

git clone https://github.com/franknitschke/referee.git
cd referee/server && npm install
cd ../client && npm install && npm run build
cd ../server && npm start
```

Set `HOST_IP` if auto-detection picks the wrong interface:

```bash
HOST_IP=192.168.1.10 npm start
```

---



## Environment variables

All variables are optional unless noted. Set them in `docker-compose.yml` (`environment:` block), via **`env_file`** in compose (see `.env.example`), a shell export, or a private `.env` file (not committed to git).


| Variable         | Default                          | Description                                                                                                                                                                                                                   |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`           | `3030`                           | TCP port the HTTP and Socket.io server listens on.                                                                                                                                                                            |
| `HOST_IP`        | Auto if exactly one LAN IPv4     | LAN IP in QR codes and Socket.io. **Referee.app sets this each launch.** Required on Docker Desktop (macOS/Windows). If unset and multiple LAN addresses exist, the server exits with an error instead of guessing.          |
| `SECRET`         | Random UUID generated at startup | Signing key for admin JWT tokens (`/auth/admin`). **Set a fixed value in production** or admin sessions invalidate on every restart. On macOS, use Referee.app (Keychain) instead of committing this in compose files.       |
| `ADMIN_USER`     | unset                            | With `ADMIN_PASSWORD`, bootstraps the admin account on startup (development/Docker). Not used when Keychain credentials exist.                                                                                                |
| `ADMIN_PASSWORD` | unset                            | Plain-text bootstrap password for first server start (hashed into the database). **Visible in process listings**—prefer Referee.app on macOS.                                                                                 |
| `REFEREE_DATA_DIR` | server `./db`                  | Root folder for the database (Referee.app sets this to Application Support).                                                                                                                                                  |
| `REFEREE_SECRETS` | unset                         | Set to `keychain` (with `REFEREE_APP_BUNDLE`) to load `SECRET` and admin credentials from macOS Keychain service `de.referee.app`.                                                                                            |
| `FETCH_INTERVAL` | `2000`                           | Milliseconds between VPortal polling requests for current attempt data. Do not set below `2000`.                                                                                                                              |
| `VPORTAL_URL`    | `dev`                            | Which VPortal instance to use. One of: `dev`, `staging`, `bvdk`, `oevk`. Maps to `*.vportal-online.de` hosts in `server/vportal/vportalHelper.js`.                                                                            |
| `DOCKER_RUNNING` | unset                            | When set (e.g. `true`), marks the instance as Docker-hosted in settings and **disables** the in-app git-pull update feature.                                                                                                  |


Example for local development:

```bash
export HOST_IP=192.168.1.10
export SECRET=my-dev-secret
export ADMIN_USER=admin
export ADMIN_PASSWORD=your-dev-password
export VPORTAL_URL=dev
export FETCH_INTERVAL=2000
cd server && npm start
```

---



## Application routes (web UI)


| Path         | Purpose                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| `/`          | Home — shows server URL, connection status, app version                           |
| `/display`   | **Main referee display** — lights, timer, athlete/attempt info (for projector/TV) |
| `/countdown` | Full-screen countdown timer only                                                  |
| `/versuch`   | Full-screen current attempt details (German route name; “attempt” in English)     |
| `/ref`       | Referee handset UI — login via token/QR, then decision buttons (no admin login)   |
| `/settings`  | Admin — tokens, QR codes, VPortal link, options (requires admin login)            |
| `/login`     | Admin login (required for `/`, `/settings`; not for kiosk or referee routes)      |




### Kiosk mode on Raspberry Pi (display screen)

On Raspberry Pi OS Bookworm, autostart Chromium in kiosk mode pointing at the display:

Edit `~/.config/wayfire.ini` and add under `[autostart]`:

```ini
chromium = sleep 15;chromium-browser "http://localhost:3030/display" --kiosk --noerrdialogs --disable-infobars --no-first-run --ozone-platform=wayland --enable-features=OverlayScrollbar --start-maximized
```

---



## Default credentials

New installations have **no default admin password** until you complete setup (Referee.app or `ADMIN_USER` / `ADMIN_PASSWORD`). Existing databases may still have the legacy pair below—change it in Settings or re-run setup.


| Context          | Username / role | Password / token |
| ---------------- | --------------- | ---------------- |
| Admin (`/login`) | (you choose)    | (you choose)     |
| Legacy seed only | `admin`         | `admin`          |
| Left judge       | —               | Random per server start (was `4711` on first install) |
| Head judge       | —               | Random per server start (was `6666` on first install) |
| Right judge      | —               | Random per server start (was `6969` on first install) |
| Timekeeper       | —               | `7373` until changed in Settings                      |


Admin and token values are stored in PouchDB under `server/db/database/` (or the Docker volume mount). Judge tokens are **rotated on every server restart**; use the QR codes on `/display` or Settings for the current values.

---



## VPortal integration (optional)

VPortal is external competition-management software. When enabled in Settings:

1. Admin logs into VPortal from the Settings page (`POST /api/vportal/login`).
2. With **Fetch VPortal data** enabled, the server polls GraphQL every `FETCH_INTERVAL` ms for the current attempt and athlete.
3. With **Send rating** enabled, when all three judges have decided, the majority result is pushed back to VPortal.

This requires valid VPortal credentials and a running competition in VPortal.

---



## Source map

Overview of frameworks and where logic lives. The project is a **monorepo**: a React frontend built into static files, served by a single Express server.

### Tech stack


| Layer        | Technology                                                                      |
| ------------ | ------------------------------------------------------------------------------- |
| Runtime      | Node.js 18                                                                      |
| HTTP API     | Express 4                                                                       |
| Real-time    | Socket.io 4                                                                     |
| Database     | PouchDB (on-disk + in-memory replica)                                           |
| Frontend     | React 18, TypeScript, React Router 6                                            |
| Styling      | Tailwind CSS, DaisyUI                                                           |
| Auth         | bcrypt (admin password), jsonwebtoken (admin sessions), plain tokens (referees) |
| External API | VPortal GraphQL over HTTPS                                                      |
| Container    | Docker (Alpine Node image)                                                      |




### Directory layout

```
referee/
├── Dockerfile              # Multi-stage: install deps, copy app, run server
├── docker-compose.yml      # Default: local build + port 3030; customize HOST_IP, env_file
├── client/                 # React frontend (TypeScript)
│   ├── public/             # Static assets (favicon, manifest)
│   ├── src/
│   │   ├── App.tsx         # Root layout, Socket.io subscriptions, route definitions
│   │   ├── socket.ts       # Socket.io client connection
│   │   ├── index.tsx       # React entry point
│   │   ├── pages/          # One component per route (screen)
│   │   │   ├── Home.tsx        # Landing / status
│   │   │   ├── Display.tsx     # Projector display (lights + timer + attempt)
│   │   │   ├── Countdown.tsx   # Timer-only fullscreen view
│   │   │   ├── Attempt.tsx     # Attempt details fullscreen view
│   │   │   ├── Ref.tsx         # Referee handset (buttons + login gate)
│   │   │   ├── Settings.tsx    # Admin dashboard
│   │   │   └── Login.tsx       # Admin authentication form
│   │   ├── components/     # Reusable UI pieces
│   │   │   ├── RefButton.tsx       # Colored decision button (calls REST API)
│   │   │   ├── RefButtonLogin.tsx  # Token entry / QR URL param handling
│   │   │   ├── SettingsTokenCard.tsx # Token editor + QR code generator
│   │   │   ├── SettingsVPortalCard.tsx # VPortal login & stage selection
│   │   │   ├── Light.tsx           # Single judge light indicator
│   │   │   ├── Timer.tsx           # Countdown display widget
│   │   │   ├── Timekeeper.tsx      # Timekeeper control panel
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useSubmit.ts    # Shared fetch wrapper (loading/error/success states)
│   │   ├── helper/
│   │   │   └── helper.ts       # Rating display helpers, form utilities
│   │   └── types/
│   │       └── global.d.ts     # Shared TypeScript types (RatingObject, SettingsObject, …)
│   └── build/              # Production build output (gitignored; `npm run build` or Docker)
│
└── server/                 # Node.js backend
    ├── app.js              # Express + Socket.io setup, static file serving, connection handlers
    ├── const.js            # In-memory rating state (DefaultRefValue), online users map, JWT secret
    ├── helper.js           # PouchDB helpers, JWT middleware, object cleanup
    ├── db/
    │   └── db.js           # PouchDB init, seed data (admin + default tokens), migrations
    ├── routes/
    │   ├── api.js          # Referee decisions, timer, reset (/api/ref, /api/timer)
    │   ├── auth.js         # Referee token auth + admin login (/auth/ref, /auth/admin)
    │   ├── settings.js     # Admin settings CRUD, token updates (/api/settings)
    │   ├── vportal.js      # VPortal login, stage selection, settings sync
    │   └── update.js       # Git pull self-update (disabled in Docker)
    └── vportal/
        ├── vportalHelper.js    # VPortal HTTP/GraphQL client (login, fetch, send result)
        ├── getCompetitionData.js # Polling loop for live attempt data
        └── queries.js          # GraphQL query strings
```



### Request flow: referee submits a decision

1. Referee taps **White** in `Ref.tsx` → `RefButton.tsx` calls `GET /api/ref?token=…&light=white`.
2. `server/routes/api.js` validates the token, sets `refValue.white = position` in `const.js`.
3. Server emits `rating` on Socket.io → `App.tsx` updates state → `Display.tsx` re-renders lights.
4. If all three judges have submitted and `sendRating` is enabled, `vportalHelper.sendRating()` posts the result to VPortal.
5. If `autoReset` is enabled, after `autoResetTimer` seconds the state resets and the next attempt data is emitted.



### Socket.io events


| Event        | Direction       | Payload                        | Purpose                                  |
| ------------ | --------------- | ------------------------------ | ---------------------------------------- |
| `ip`         | server → client | `http://HOST_IP:PORT`          | Show connection URL / build QR codes     |
| `getIp`      | client → server | —                              | Request host URL if the initial `ip` was missed |
| `judgeLinks` | server → client | `{ left, main, right }` URLs   | QR payloads for the three judges on `/display` |
| `refRegister`| client → server | `{ token }`                    | Claim a judge slot (one device per position) |
| `rating`     | server → client | `{ left, main, right, timer }` | Current judge lights and countdown       |
| `settings`   | server → client | Settings object                | Sync toggles (auto-reset, VPortal, etc.) |
| `intervall`  | server → client | Attempt array                  | Current lift/athlete from VPortal        |
| `lastRating` | server → client | Final rating before reset      | Optional; used before auto-reset         |
| `users`      | client → server | `{ user: pathname }`           | Track which pages are open               |
| `getUsers`   | server → client | Online user list               | Presence tracking                        |


---



## Troubleshooting


| Problem                            | Likely cause                     | Fix                                                                        |
| ---------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| QR code URL unreachable from phone | Wrong `HOST_IP` or firewall      | Set `HOST_IP` to the machine’s LAN IP; ensure port 3030 is open on the LAN |
| Display shows “not connected”      | Socket.io blocked or server down | Check server logs; ensure clients use the same host/port as the server     |
| VPortal data missing               | Not logged in or fetch disabled  | Log in via Settings; enable “Fetch VPortal data”                           |
| Admin login fails after restart    | `SECRET` not fixed               | Set a stable `SECRET` in environment variables                             |
| Docker on Mac: wrong IP in QR      | Missing `HOST_IP`                | Set `HOST_IP` explicitly in `docker-compose.yml`                           |


---



## License

See repository license. Releases: [github.com/franknitschke/referee/releases](https://github.com/franknitschke/referee/releases)