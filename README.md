# Referee — powerlifting judging system

Web application for running powerlifting referee lights at a competition. Three judges (left, center, right) submit lift decisions from mobile devices; a display screen shows the lights, countdown timer, and current attempt. Optionally integrates with [VPortal](https://vportal-online.de) to pull live attempt data and push results back.

**Use this software only on a trusted private network.** Change all default passwords and referee tokens immediately after installation. Do not expose it to the public internet.

---

## How it works (high level)

```
┌─────────────────┐     QR code scan      ┌──────────────────┐
│  Admin laptop   │ ────────────────────► │  Android phone   │
│  /settings      │   http://IP/ref?token │  (referee app)   │
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

1. An **admin** logs in at `/login` and configures referee tokens in `/settings`.
2. Each referee position gets a **QR code** encoding a URL like `http://192.168.1.10:3030/ref?token=4711`.
3. Referees scan the code with the **Android referee app** (or open the URL in a mobile browser). The app authenticates with the token and shows colored decision buttons.
4. When a referee taps a button, the server records the decision and **broadcasts** the updated state to every connected client (display screen, countdown, attempt board) via **Socket.io**.
5. After all three judges have submitted, the majority decision can optionally be **sent to VPortal** and the lights **auto-reset** after a configurable delay.

---



## Android app interaction (QR code login)

The web app does not contain the Android app source code, but it defines the contract the app uses to connect.

### What the QR code contains

In **Settings**, each referee role (left, center, right, timekeeper) has a QR code. It encodes:

```
http://<HOST_IP>:<PORT>/ref?token=<REFeree_TOKEN>
```

Example: `http://192.168.1.10:3030/ref?token=4711`

- `HOST_IP` is the server’s LAN address (see environment variables below). Referee phones must reach this IP on the competition network.
- `token` is a unique secret per role, stored in the local database.



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



## Quick start with Docker (recommended)



### 1. Create project directory

```bash
mkdir referee && cd referee
mkdir database
```

The `database` folder persists settings, tokens, and VPortal credentials across restarts.

### 2. Create `docker-compose.yml`

**Linux** (including Raspberry Pi) — use host networking so the server can detect the correct LAN IP automatically:

```yaml
version: "3"
services:
  referee:
    image: ghcr.io/franknitschke/referee:latest
    restart: always
    network_mode: host
    volumes:
      - ./database:/home/app/server/db/database
    environment:
      DOCKER_RUNNING: "true"
      SECRET: "change-me-to-a-long-random-string"
      FETCH_INTERVAL: "2000"
      VPORTAL_URL: bvdk
```

**macOS and Windows** — Docker Desktop does not support `network_mode: host`. Map port 3030 and set `HOST_IP` to your machine’s LAN address:

```yaml
version: "3"
services:
  referee:
    image: ghcr.io/franknitschke/referee:latest
    restart: always
    ports:
      - "3030:3030"
    volumes:
      - ./database:/home/app/server/db/database
    environment:
      DOCKER_RUNNING: "true"
      HOST_IP: "192.168.1.10"   # replace with your LAN IP
      SECRET: "change-me-to-a-long-random-string"
      FETCH_INTERVAL: "2000"
      VPORTAL_URL: bvdk
```

Find your LAN IP:

- **macOS**: System Settings → Network, or run `ipconfig getifaddr en0`
- **Linux**: `hostname -I | awk '{print $1}'`



### 3. Start

```bash
docker compose up -d
```

Open **[http://localhost:3030](http://localhost:3030)** (or `http://<HOST_IP>:3030` from another device on the LAN).

### 4. Build from source (optional)

If you prefer a local image instead of pulling from GitHub Container Registry:

```bash
git clone https://github.com/franknitschke/referee.git
cd referee
docker build -t referee:latest .
# then set image: referee:latest in docker-compose.yml
docker compose up -d
```

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

All variables are optional unless noted. Set them in `docker-compose.yml`, a shell export, or a `.env` file (not committed to git).


| Variable         | Default                          | Description                                                                                                                                                                                                                   |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`           | `3030`                           | TCP port the HTTP and Socket.io server listens on.                                                                                                                                                                            |
| `HOST_IP`        | Auto-detected via `ip` package   | LAN IP address sent to clients over Socket.io and embedded in QR codes. **Required on macOS/Windows Docker** where port mapping hides the real IP. On Linux with `network_mode: host`, leave unset unless detection is wrong. |
| `SECRET`         | Random UUID generated at startup | Signing key for admin JWT tokens (`/auth/admin`). **Set a fixed value in production** or admin sessions invalidate on every restart.                                                                                          |
| `FETCH_INTERVAL` | `2000`                           | Milliseconds between VPortal polling requests for current attempt data. Do not set below `2000`.                                                                                                                              |
| `VPORTAL_URL`    | `dev`                            | Which VPortal instance to use. One of: `dev`, `staging`, `bvdk`, `oevk`. Maps to `*.vportal-online.de` hosts in `server/vportal/vportalHelper.js`.                                                                            |
| `DOCKER_RUNNING` | unset                            | When set (e.g. `true`), marks the instance as Docker-hosted in settings and **disables** the in-app git-pull update feature.                                                                                                  |


Example for local development:

```bash
export HOST_IP=192.168.1.10
export SECRET=my-dev-secret
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
| `/ref`       | Referee handset UI — login via token/QR, then decision buttons                    |
| `/settings`  | Admin — tokens, QR codes, VPortal link, options (requires admin login)            |
| `/login`     | Admin login                                                                       |




### Kiosk mode on Raspberry Pi (display screen)

On Raspberry Pi OS Bookworm, autostart Chromium in kiosk mode pointing at the display:

Edit `~/.config/wayfire.ini` and add under `[autostart]`:

```ini
chromium = sleep 15;chromium-browser "http://localhost:3030/display" --kiosk --noerrdialogs --disable-infobars --no-first-run --ozone-platform=wayland --enable-features=OverlayScrollbar --start-maximized
```

---



## Default credentials

Change these immediately after first login.


| Context          | Username / role | Password / token |
| ---------------- | --------------- | ---------------- |
| Admin (`/login`) | `admin`         | `admin`          |
| Left judge       | —               | `4711`           |
| Head judge       | —               | `6666`           |
| Right judge      | —               | `6969`           |
| Timekeeper       | —               | `7373`           |


Admin and token values are stored in PouchDB under `server/db/database/` (or the Docker volume mount).

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
├── docker-compose.yml      # Example compose file (customize HOST_IP, SECRET, etc.)
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
│   └── build/              # Production build output (served by Express)
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