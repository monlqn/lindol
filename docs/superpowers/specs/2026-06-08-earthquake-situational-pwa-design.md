# Earthquake Situational PWA — Design

**Date:** 2026-06-08
**Context:** A major earthquake struck southern Mindanao on the morning of 2026-06-08. This app is a response tool for affected citizens.

## Goal

Build a mobile-first web app for southern Mindanao that is **useful with zero other users** (live earthquake data + offline safety guidance) and **gets better as people use it** (structured, geotagged, camera-verified citizen reports on a live map).

## Guiding principle — don't rebuild Facebook

Facebook already owns crowd-dependent features (Safety Check, status posts, groups, sharing). Competing there means losing on network effect. This app instead does what Facebook *structurally cannot*: turn the instinct to "post a photo of what's happening" into **structured data** — every report pinned to a location, timestamped, and categorized — so the information becomes a **queryable live map** instead of an unsearchable scroll. Only authoritative/curated data and structured citizen reports; never an anonymous free-for-all feed. This is also the core defense against misinformation.

## What we are building (v1)

A **Progressive Web App (PWA)**: one website that phones can install to the home screen and that keeps working when the network is flaky or down.

### Pillars
1. **Live earthquake data (zero maintenance, instantly useful).** Latest quake + aftershocks for the region, plotted on a map.
2. **Offline safety guidance (works with no signal).** Drop/Cover/Hold, aftershock preparation. Precached so it is available even on a first-load failure.
3. **Structured citizen reports (the differentiator).** Geotagged, categorized, camera-only photo reports on a live map.

## Stack

- **React + Vite** (JavaScript) — fast to ship, room to grow, no heavy build overhead.
- **vite-plugin-pwa** (Workbox) — offline caching + installability.
- **Leaflet + OpenStreetMap** — map with **no API key required** (critical in a crisis; avoids Google/Mapbox key + billing friction).
- **Supabase** — Postgres + **PostGIS** (true radius/"near me" queries), media storage, auth (admin only), realtime (live-updating map). Talked to directly from React via row-level security; minimal server code to maintain.
- **Vitest** — unit tests for the logic that matters.

## Architecture — built to grow

A small **app shell** (layout, map container, online/offline + "last updated" banner) plus self-contained **feature modules**. Each module owns its own data fetching and UI panel and registers with the shell. Adding a feature later = add one folder + register it; nothing else changes.

```
app-shell        → layout, map container, online/offline + "last updated" banner
features/
  quakes         → USGS feed: latest quake + aftershocks, plotted on map
  reports        → structured citizen reports (capture, map pins, feed, moderation)
  safety         → offline safety guidance (Drop/Cover/Hold, aftershock prep)
```

**Deferred — architected for, not built in v1:** `evac-centers` (curated evacuation centers), `needs-matching` (donor/volunteer matching), video reports, donation links, phone verification.

## Data sources

- **Earthquakes / aftershocks → USGS GeoJSON feed.** Real-time, reliable, CORS-friendly, queryable by a radius around southern Mindanao. PHIVOLCS has no public API (HTML bulletins only), so USGS is the live source.
- **Citizen reports → Supabase** (see below).
- **Safety guidance → static content bundled in the app**, always available offline.

## Report system (the structured layer)

### Data model
Each report:
- `location` (lat/lng, PostGIS point)
- `category` — one of: `damage`, `blocked_road`, `fire`, `need_help`, `safe_here`
- `text` (short note, optional)
- `photo` (optional, v1 = photo only, no video)
- `created_at`
- `status` — `visible` | `flagged` | `hidden`
- `flag_count`

### Capture flow
1. Tap **Report** → app captures **live GPS** (report must be near the device — kills fake locations).
2. Pick a **category**, optional short note.
3. **Camera-only photo** — opens the camera, **no gallery picker** (kills reposted/old photos from other events).
4. Submit → appears on the map near-instantly (realtime).

### Media scope (v1)
**Photos only — no video.** Video is far more expensive to store and much harder to moderate. Architected so video can be added later.

### Accounts
**Anonymous posting, no sign-up** (people won't make accounts mid-crisis). Quality kept up without accounts via: mandatory live GPS, camera-only photos, and per-device rate limiting. The **admin page is the only authenticated surface**.

## Moderation

In a real earthquake, expect graphic injuries, fakes, and spam. A solo dev cannot pre-approve everything in real time, so:

- **Text + location reports post instantly.**
- **Photos post immediately but blurred** behind a *"tap to reveal — may be distressing"* sensitivity gate.
- **Any user can flag**; a photo/report is **auto-hidden after N flags** (threshold configurable; start at e.g. 3).
- **Admin takedown page** (authenticated) to review flagged items and remove content fast.

This keeps the map real-time while staying sustainable for one person.

## Offline behavior (PWA)

- **Reading offline:** last-known quake data, safety guidance, and already-loaded reports remain visible with an *"offline — data as of [time]"* banner.
- **Writing offline:** a report filed with no signal is **queued on the device** and **auto-submits on reconnect** (common in a disaster — you often have a photo before you have bars).
- **Map tiles** for southern Mindanao are cached as the user pans, so the map still renders offline.
- **Caching strategy:** app shell precached; live feeds network-first with cache fallback; static safety content precached so it survives a first-load-offline.

## Screens (mobile-first)

1. **Home / Map** — status banner (latest magnitude, epicenter, time, online/offline); live map with quake epicenters + categorized report pins; layer toggles; prominent **Report** button.
2. **Report flow** — GPS → category → note → camera → submit.
3. **Feed / Near me** — reports sorted by distance + recency; sensitivity-gated photos; flag button.
4. **Safety** — always-offline Drop/Cover/Hold + aftershock prep.
5. **Admin** (hidden, authenticated) — review flagged items, remove content.

## Error handling

- Network failure → cached data + offline banner.
- First-ever load while offline → still shows precached safety guidance + "connect once to load live data."
- GPS denied → reading still works; reporting requires location (clearly explained, not a dead-end).
- Bad/oversized photo → friendly rejection.
- USGS schema/shape guard before rendering.

## Testing

Vitest for the logic that matters:
- Distance / radius ("near me") calculation.
- Report validation.
- Offline queue sync.
- Flag → auto-hide threshold.

Plus a manual offline pass in browser devtools.

## Out of scope for v1 (explicitly deferred)

Evacuation-center directory, needs/donation matching, video reports, donation links, phone/account verification. The architecture leaves slots for each.
