# LINDOL: App Overview

LINDOL is a free, installable earthquake-response PWA for the Philippines, built in response to the June 2026 M7.8 Sarangani/Mindanao earthquake. It is an **awareness tool, not an early-warning system**, and that honesty is wired into the copy throughout the app. It is an independent, non-commercial public-safety project.

## Stack

- **Frontend:** React 18 + Vite, no UI framework. Plain CSS with design tokens (`src/styles/tokens.css`, `src/styles/global.css`).
- **Maps:** Leaflet + react-leaflet.
- **Backend:** Supabase (Postgres + Realtime + Edge Functions) for citizen reports, push notifications, and the community layer.
- **Serverless proxies:** Vercel functions in `api/` (PHIVOLCS scraping, news, shakemaps).
- **PWA:** `vite-plugin-pwa` plus a custom service worker (`public/push-sw.js`) for offline use and push.
- **Offline storage:** `idb-keyval` (IndexedDB) for caching and the offline report queue.
- **Tests:** Vitest + Testing Library, with extensive coverage across the data layer.

## Architecture at a glance

`src/App.jsx` is the orchestrator. It is a hash-routed single page (`#admin`, `#privacy`, otherwise the main app) with three tabs (**Home / Reports / Safety**) plus a Map view, driven by a bottom nav. On wide screens it becomes a two-pane desktop layout (content on the left, persistent map on the right). All state flows through a handful of custom hooks; features live in `src/features/*` and pure logic in `src/lib/*`.

## Core feature 1: Multi-source quake feed

The heart of the app (`src/features/quakes/useQuakes.js` + `quakeMerge.js`). It pulls from three complementary sources and merges them:

- **PHIVOLCS** (the local authority, preferred): no public API and a broken TLS cert, so `api/phivolcs.js` scrapes the bulletin server-side, ignoring the cert for that one host only, and CDN-caches it so PHIVOLCS receives roughly one request every few minutes regardless of how many users we have.
- **USGS** (the dependable backbone, cached for offline use).
- **EMSC** (a fast independent cross-check), including a **real-time WebSocket** so freshly detected quakes appear instantly instead of waiting for the next 60-second poll.

`mergeQuakes` de-dupes the same physical event (within 90 seconds, 1.2 magnitude, 80 km) while consolidating which agencies reported it. PHIVOLCS wins on values; the feed degrades gracefully if any source fails. Each quake is enriched with distance from the user. From the merged set it derives the `latest` event, the `mainshock`, and the `aftershocks`.

## Core feature 2: The map

`QuakeMap.jsx` shows quakes (sized and colored by magnitude), citizen reports, the user's location, and:

- An **active aftershock zone** polygon (`src/lib/activeZone.js`) with a live in-zone count.
- A **PHIVOLCS Active Faults** overlay and a **hazard picker** (ground shaking, liquefaction, tsunami, landslide) via ArcGIS layers, all credited.
- **USGS ShakeMap** MMI intensity contours (`api/shakemap.js`, `useShakemaps.js`) for the mainshock: the authoritative version of the estimated felt circles.
- A pulsing highlight ring on a tapped quake or report, tap-to-recenter, and theme-aware zoom/locate controls.

## Core feature 3: Citizen reports (the social layer)

A crowd-sourced situation map backed by Supabase (`useReports.js`, `reportsApi.js`, schema in `supabase/`):

- Six categories (damage, blocked road, fire, need help, safe here, other), an optional 280-character note, a photo, and location.
- **Realtime:** new nearby reports stream in live and surface a toast.
- **Offline-first:** reports queue in IndexedDB (`reportQueue.js`) and auto-send when the device is back online.
- **Community moderation and lifecycle:** confirm, flag (with reasons), vote-to-resolve, and escalate, plus sensitive-photo blurring and dedup. SQL files cover rate-limiting, device-id hardening, retention, and comments.
- **Gamification** (`src/lib/rewards.js`): points, nicknames, a leaderboard, and levels (Newcomer, Watcher, Reporter, Responder, Guardian) to encourage useful reporting.

## Core feature 4: Alerts (two channels)

- **In-app alarm** (`useQuakeAlerts.js`, `src/lib/alarm.js`): a loud looping alarm plus vibration for M4.5+ quakes within 300 km while the app is open, with a preview/test button. Honest copy explains that a web app cannot override Silent mode or raise the phone's volume.
- **Background push** (Supabase Edge Function `supabase/functions/alerts/index.ts` plus `pg_cron`): fires every minute even when the app is closed, merges PHIVOLCS/USGS/EMSC, uses a magnitude-scaled "felt radius" so only people who would plausibly feel the quake are notified, advances a watermark to avoid duplicate alerts, and prunes dead subscriptions. Uses VAPID/web-push.

## Supporting features

- **Safety panel:** offline-capable Drop, Cover, Hold On guidance, emergency hotlines, and a 911 call-to-action.
- **Situation updates / news** (`api/news.js`): GDELT as the primary source with Google News RSS as a fallback, with article images, CDN-cached so neither source is hit per user.
- **About this quake:** a sourced context card (the M7.8 event, plate tectonics, aftershock history), credited.
- **Onboarding:** an intro overlay plus a guided tour, replayable from settings.
- **PWA niceties:** install prompt, update prompt, pull-to-refresh, offline banner, dark mode, live viewer count (presence), and share cards.
- **Admin page** and a **Privacy Policy** page.
- **Support card:** an optional GCash donation, rendered only when a number is configured so nothing placeholder or fake is ever shown publicly.

## Design principles baked in

1. **Honesty:** "awareness, not early warning" is repeated wherever alerts appear. The app never overstates what it can do.
2. **Resilience:** every data source has a fallback; the app works offline and never hard-breaks.
3. **Politeness to sources:** server-side scraping plus CDN caching keeps load off PHIVOLCS and the other providers.
4. **Local-first authority:** PHIVOLCS is preferred, with the global networks (USGS, EMSC) as backup.

## Credits and disclaimers

- Quake data: PHIVOLCS, USGS, and EMSC. Hazard and fault maps: PHIVOLCS (DOST).
- Not an official emergency service. In a life-threatening emergency, call 911.
- Built by moncodes as an independent, non-commercial public-safety project.
