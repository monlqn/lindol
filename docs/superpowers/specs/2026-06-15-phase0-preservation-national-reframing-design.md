# Phase 0: Data Preservation + National Reframing (design)

Date: 2026-06-15 (one week after the M7.8 Sarangani earthquake of 8 June 2026)
Status: approved for planning

## Why this exists

Today is day 7 of the M7.8 sequence. Two problems are about to bite at once, and they share a single root cause: the app only knows about "the last 7 days."

1. **The mainshock is about to disappear or be mislabeled.** `useQuakes.js` derives the mainshock as "largest magnitude currently in the feed" (`byMag[0]`), and the feed is a rolling 7-day window (`config.js` `windowDays: 7`). Once the M7.8 rolls past the window, the hero card, ShakeMap, and About card silently re-anchor to whatever aftershock is now largest.
2. **Perishable PHIVOLCS data is aging off.** USGS and EMSC keep full archives, so their week-1 data is recoverable later. PHIVOLCS is a live scrape of the recent bulletin with no archive, so any week-1 PHIVOLCS aftershock that scrolls off the bulletin and was never stored is gone for good. The per-device IndexedDB cache does not count (it is ephemeral and not queryable by us).
3. **Everything is called an "aftershock."** Classification is `aftershocks: byMag.slice(1)`, i.e. every other quake in the whole-Philippines bbox. A quake in Luzon or the Visayas, on an unrelated fault 1,000+ km away, is rendered as an "aftershock" (`QuakeMap.jsx:260`, `QuakeMap.jsx:434`). This is scientifically wrong and violates the project's "never overstate" principle.

Phase 0 is the urgent foundation. It secures the data and fixes the labeling. The richer work (durable Supabase capture, USGS historical backfill, timeline UI, trench overlay) is deferred to Phases 1 to 3, each with its own spec.

## Goals

- The M7.8 mainshock is anchored statically so it can never drop off the window or be silently replaced.
- Week-1 PHIVOLCS data is snapshotted to a committed file before more of it ages off the live bulletin.
- Quakes are classified into three honest buckets, and only genuine sequence aftershocks are ever labeled "aftershock."
- The app is reframed as a Philippines-wide earthquake monitor in which the Sarangani sequence is the highlighted cluster, not the only subject.

## Non-goals (deferred to later phases)

- Durable Supabase `quake_history` table and cron upsert (Phase 1).
- USGS-anchored historical backfill across previous years, scopes 1/2/3 (Phase 2).
- Timeline UI: "days since", scrubber, aftershock-decay view, seismicity background layer (Phase 3).
- Trench / plate-boundary overlay (Phase 3, sibling of the existing Faults toggle).

## Design

### 1. Sarangani sequence definition (new, static)

New file `src/features/quakes/sequences.js` holds a single source of truth for the sequence:

```
SARANGANI_SEQUENCE = {
  id: 'sarangani-2026-06',
  name: 'Sarangani / Southern Mindanao sequence',
  mainshock: {            // the pinned anchor, used directly if the live feed lacks it
    id, time, lat, lng, mag: 7.8, depth, place, sources: ['PHIVOLCS','USGS','EMSC'],
  },
  center: [lat, lng],     // mainshock epicentre, used for the zone radius test
  radiusKm: 150,          // a quake within this radius AND at/after the mainshock counts as an aftershock
  startTime,              // = mainshock.time
}
```

The exact anchor values come from the authoritative bulletins (PHIVOLCS preferred, USGS as backstop) at implementation time. `radiusKm` is consistent in spirit with `activeZone.js` (`maxKm` 130), set slightly wider so the polygon sits inside the classification boundary.

### 2. Pure classification function (new, tested)

`classifyQuakes(quakes, sequence)` in `sequences.js`, returning `{ mainshock, aftershocks, other }`:

- **mainshock**: the feed event matching the anchor (matched by proximity in time and space, reusing the same tolerance idea as `mergeQuakes`). If the feed has no match, the static anchor record itself is used. Never "largest in feed."
- **aftershocks**: quakes where `haversineKm(sequence.center, [lat,lng]) <= sequence.radiusKm` AND `time >= sequence.startTime`, excluding the mainshock.
- **other**: everything else in the feed (other PH regions, and any pre-mainshock events near the zone, which are not aftershocks).

Pure and total: handles empty input, missing fields, and a feed that does not contain the mainshock.

### 3. Static week-1 snapshot (new, committed)

New file `src/features/quakes/snapshots/sarangani-2026-06.json`: the merged quake set captured from the live sources today (PHIVOLCS first), in the same shape the parsers emit. Captured during implementation by calling the deployed `api/phivolcs.js` (and USGS/EMSC for the same window) and saving the parsed output.

`useQuakes` merges this snapshot into the live feed via the existing `mergeQuakes` (which de-dupes the same physical event), so:

- week-1 PHIVOLCS aftershocks persist after they age off the live bulletin, and
- the data shows immediately, even offline, before any network call returns.

This is a one-time freeze for Phase 0. Phase 1 replaces the "keeps growing" need with the Supabase table.

### 4. Window handling

The static anchor and snapshot are what guarantee correctness, so the live query window no longer carries that burden. We still widen it so the live feed keeps the recent sequence visible:

- Decouple "the sequence" (static, durable) from "recent live activity" (rolling).
- Increase `windowDays` enough to comfortably cover the active sequence with margin (target ~30 days), with the understanding that the anchor, not the window, is the correctness guarantee.

### 5. useQuakes shape change

`useQuakes` now returns `{ all, latest, mainshock, aftershocks, other, status, updatedAt }`. Build order inside `recommit`:

1. merge live sources (PHIVOLCS, USGS, EMSC, WS) as today,
2. merge in the static snapshot,
3. merge in the anchor,
4. `classifyQuakes(merged, SARANGANI_SEQUENCE)`,
5. enrich each with distance from the user.

`latest` stays "newest by time across the whole feed."

### 6. UI and copy (national reframing, honest labels)

- `QuakeMap.jsx`: render `other` quakes with a neutral style distinct from sequence aftershocks; popup says "M{x} earthquake near {place}" for `other`, "M{x} aftershock" only for sequence aftershocks. The significant-event markers (`:434`) split accordingly. The dynamic `activeZone` polygon now builds from genuine aftershocks only, which tightens it correctly.
- `App.jsx`: pass `other` to the map; reframe the headline and source note from "Southern Mindanao aftershocks" toward "Philippine earthquakes, with the active Sarangani sequence highlighted."
- Light copy pass on the most visible strings only (`IntroOverlay`, source note, the in-zone count label). Full marketing-copy polish is out of scope for Phase 0.
- Copy avoids em dashes per project preference and keeps the "awareness, not early warning" framing.

## Data flow

```
live sources (PHIVOLCS, USGS, EMSC, WS)
        |  mergeQuakes (existing de-dupe)
        v
   + static week-1 snapshot   (mergeQuakes)
        v
   + static mainshock anchor  (mergeQuakes)
        v
   classifyQuakes(merged, SARANGANI_SEQUENCE)
        v
   { mainshock, aftershocks, other } -> enrich(distance) -> UI
```

## Error handling and resilience

- Anchor and snapshot are static imports: always present, so the sequence headline survives total network failure and works offline.
- `classifyQuakes` is pure and total; empty or malformed feeds degrade to "anchor-only."
- No new external dependency or service in Phase 0, so nothing new can fail at runtime.

## Testing

New `src/features/quakes/sequences.test.js`:

- mainshock is the anchor even when an unrelated quake has higher magnitude in the feed.
- a Luzon / Visayas quake lands in `other`, never `aftershocks`.
- a post-mainshock quake within `radiusKm` lands in `aftershocks`.
- a pre-mainshock quake within `radiusKm` lands in `other` (not an aftershock).
- empty feed returns the static anchor as mainshock with empty `aftershocks`/`other`.
- snapshot events appear after the live merge and de-dupe against live duplicates.

Existing `quakeMerge.test.js` and the suite must stay green. UI label changes verified by a quick manual map check (an `other` marker shows the neutral label).

## Rollout

1. Build `sequences.js` + tests (red to green).
2. Capture and commit the week-1 snapshot.
3. Wire `useQuakes` to inject anchor + snapshot and return the 3-bucket shape.
4. Update `QuakeMap.jsx` / `App.jsx` rendering and copy.
5. Widen the window.
6. `npm run build` + full test run, then commit.
