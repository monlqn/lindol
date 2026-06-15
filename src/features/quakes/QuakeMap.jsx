import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Circle, Polyline, Popup, Rectangle, Polygon, AttributionControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { REGION, AFFECTED_AREAS } from '../../config.js';
import { activeZone } from '../../lib/activeZone.js';
import { magFloorForZoom } from './mapDetail.js';
import { reportIcon } from '../reports/reportMarkers.js';
import { categoryColor, categoryIcon, CATEGORIES } from '../reports/reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime, formatClock } from '../../lib/time.js';

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

// The epicenter is the biggest marker, scales with BOTH magnitude and zoom (like the dots, so
// a zoomed-in aftershock can't out-size it), shows its magnitude, and glows.
function epicenterIcon(mag, zoom = 7) {
  const core = Math.round(dotRadius(mag, zoom) * 2 + 12);
  const box = core + 8;
  const fs = Math.max(10, Math.round(core * 0.34));
  return L.divIcon({
    className: '', iconSize: [box, box], iconAnchor: [box / 2, box / 2],
    html: `<div class="epi" style="width:${box}px;height:${box}px"><div class="ring"></div>`
      + `<div class="core" style="width:${core}px;height:${core}px;font-size:${fs}px;background:${magColor(mag)}">${mag.toFixed(1)}</div></div>`,
  });
}
const youIcon = L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11],
  html: '<div class="youdot"><span class="youpulse"></span><span class="youcore"></span></div>' });
const zoneLabelIcon = L.divIcon({ className: 'zone-label-wrap', iconSize: [210, 20], iconAnchor: [105, 10],
  html: '<span class="zone-label">Sarangani aftershock zone</span>' });
const focusIcon = L.divIcon({ className: '', iconSize: [48, 48], iconAnchor: [24, 24],
  html: '<div class="focus-ring"></div>' });
// Clearly-labelled "hard-hit area" marker (from news coverage) - distinct from citizen reports.
const affectedIcon = L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17],
  html: '<div class="affected-pin">⚠</div>' });
const HL = REGION.highlight;
const HL_BOUNDS = [[HL.minLat, HL.minLng], [HL.maxLat, HL.maxLng]];

// Esri free tile services for a Google-style hybrid: satellite imagery + roads + place labels.
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ROADS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';
const SAT_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const CITIES = [
  { name: 'Davao', c: [7.07, 125.61] },
  { name: 'Gen. Santos', c: [6.11, 125.17] },
  { name: 'Sarangani', c: [5.96, 125.20] },
  { name: 'Cotabato', c: [7.22, 124.25] },
  { name: 'Koronadal', c: [6.50, 124.85] },
];

// Luminous warm ramp: gold (small) -> orange -> hot crimson (large). Reads clearly on satellite.
function magColor(m) {
  return m >= 6 ? '#D81E34' : m >= 5 ? '#F0461E' : m >= 4 ? '#F5851B' : m >= 3 ? '#F2B01E' : '#E4C84A';
}
// Power curve so magnitude differences read clearly: M7.8 (~27) towers over M5 (~12) and M2 (~3).
function magRadius(m) { return Math.max(3, 1.5 * Math.pow(Math.max(m - 1, 0.5), 1.5)); }
// Recency as light: fresh quakes glow + stay saturated; older ones settle into calm dots.
const glowFor = (ageH) => Math.max(0, 1 - ageH / 36);                 // glow fades over ~1.5 days
const coreFor = (ageH) => 0.55 + 0.4 * Math.max(0, 1 - ageH / 168);  // 0.55 -> 0.95 over 7 days
// Dot size scales with zoom: same magnitude looks smaller when zoomed out, bigger when zoomed in.
function dotRadius(m, zoom) {
  const f = Math.pow(1.4, zoom - 7); // 1x at the default zoom (7)
  return Math.max(2, Math.min(magRadius(m) * f, magRadius(m) * 3.5));
}
// Approximate radius of perceptible shaking (metres) for the general public - a zoom-aware "felt
// area". Capped at 450 km so even an M7.8 doesn't overstate reach (e.g. into the Visayas).
function feltRadiusM(m) { return Math.min(450, Math.max(6, Math.pow(10, 0.46 * m - 0.7))) * 1000; }
// Inner zone of stronger shaking (~45% of the felt radius - keeps nearby cities like Davao inside).
function strongRadiusM(m) { return feltRadiusM(m) * 0.45; }

// Reports the current zoom up to the parent so markers can resize with it.
function ZoomWatcher({ onZoom }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const isRealFix = (u) => u && (u[0] !== REGION.defaultUser[0] || u[1] !== REGION.defaultUser[1]);

// Auto-center on the user once, when their first real GPS fix arrives.
function FollowUser({ user }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !isRealFix(user)) return;
    map.setView(user, 8);
    done.current = true;
  }, [user, map]);
  return null;
}

function MapClicker({ active, onPick }) {
  useMapEvents({ click(e) { if (active) onPick([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

// PHIVOLCS overlays, rendered as dynamic image layers (projection-matched to Web Mercator).
// The raw geometry query is locked, but image export is open.
const ARCGIS = 'https://gisweb.phivolcs.dost.gov.ph/arcgis/rest/services/PHIVOLCSPublic';
const FAULT_URL = `${ARCGIS}/ActiveFault/MapServer/export`;
const HAZARDS = [
  { key: 'shaking', label: 'Ground shaking', url: `${ARCGIS}/GroundShaking/MapServer/export` },
  { key: 'liquefaction', label: 'Liquefaction', url: `${ARCGIS}/Liquefaction/MapServer/export` },
  { key: 'tsunami', label: 'Tsunami', url: `${ARCGIS}/Tsunami/MapServer/export` },
  { key: 'landslide', label: 'Landslide', url: `${ARCGIS}/EarthquakeInducedLandslide/MapServer/export` },
];
const HAZARD_MAP = Object.fromEntries(HAZARDS.map((h) => [h.key, h]));

function ArcgisOverlay({ url, opacity = 0.85 }) {
  const map = useMap();
  const currentRef = useRef(null);
  const pendingRef = useRef(null);

  const draw = () => {
    if (pendingRef.current) { map.removeLayer(pendingRef.current); pendingRef.current = null; }
    const b = map.getBounds();
    const size = map.getSize();
    const crs = map.options.crs;
    const sw = crs.project(b.getSouthWest());
    const ne = crs.project(b.getNorthEast());
    const u = `${url}?bbox=${sw.x},${sw.y},${ne.x},${ne.y}&bboxSR=102100&imageSR=102100`
      + `&size=${Math.round(size.x)},${Math.round(size.y)}&dpi=96&format=png32&transparent=true&f=image`;
    const next = L.imageOverlay(u, b, { opacity: 0, interactive: false });
    next.on('load', () => {           // swap only once the new image is ready (no blank gap)
      next.setOpacity(opacity);
      const prev = currentRef.current;
      currentRef.current = next;
      pendingRef.current = null;
      if (prev && prev !== next) map.removeLayer(prev);
    });
    next.on('error', () => { if (pendingRef.current === next) pendingRef.current = null; map.removeLayer(next); });
    pendingRef.current = next;
    next.addTo(map);
  };

  useMapEvents({ moveend: draw, zoomend: draw });
  useEffect(() => {
    draw();
    return () => { [currentRef, pendingRef].forEach((r) => { if (r.current) { map.removeLayer(r.current); r.current = null; } }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, opacity]);
  return null;
}

// Quakes newer than this stay on the map even below the zoom magnitude floor, so fresh activity
// is never hidden by the level-of-detail thinning.
const RECENT_DOT_MS = 48 * 3600000;

// Optional density heatmap of the swarm: shows where activity concentrates at a glance, without the
// overlap of thousands of discrete dots. Weighted by magnitude. Toggled from the Layers panel.
function HeatLayer({ points, show }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) { map.removeLayer(ref.current); ref.current = null; }
    if (!show || !points.length) return undefined;
    const layer = L.heatLayer(points, {
      radius: 24, blur: 18, minOpacity: 0.25, maxZoom: 12,
      gradient: { 0.15: 'rgba(228,200,74,0.65)', 0.4: '#F2B01E', 0.6: '#F5851B', 0.8: '#F0461E', 1: '#D81E34' },
    });
    layer.addTo(map);
    ref.current = layer;
    return () => { if (ref.current) { map.removeLayer(ref.current); ref.current = null; } };
  }, [show, points, map]);
  return null;
}

// Flies the map to a focus point (e.g., a quake tapped in the list).
function FocusFlyer({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus && Number.isFinite(focus.lat) && Number.isFinite(focus.lng)) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 10), { duration: 0.8 });
    }
  }, [focus?.t]);
  return null;
}

export default function QuakeMap({
  mainshock, aftershocks = [], other = [], reports = [], user = REGION.defaultUser,
  fill = false, dark = false, onReportAt, focus, zone = null,
}) {
  const [showQuakes, setShowQuakes] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [showFaults, setShowFaults] = useState(false);
  // Satellite hybrid is the default basemap (richer + shows real terrain); remembered per device.
  const [satellite, setSatellite] = useState(() => {
    try { return localStorage.getItem('lindol:satellite') !== '0'; } catch { return true; }
  });
  const toggleSatellite = () => setSatellite((v) => {
    const n = !v;
    try { localStorage.setItem('lindol:satellite', n ? '1' : '0'); } catch { /* ignore */ }
    return n;
  });
  // Real USGS ShakeMap intensity contours (lazy-loaded the first time the layer is turned on).
  const [showIntensity, setShowIntensity] = useState(false);
  const [intensity, setIntensity] = useState(null);
  useEffect(() => {
    if (!showIntensity || intensity) return;
    fetch('/api/shakemap').then((r) => r.json()).then(setIntensity).catch(() => {});
  }, [showIntensity, intensity]);
  const [showHeat, setShowHeat] = useState(false);
  const [hazard, setHazard] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [catFilter, setCatFilter] = useState(() => new Set(CATEGORIES.map((c) => c.key)));
  const [hideResolved, setHideResolved] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const [zoom, setZoom] = useState(7);
  const [feltQuake, setFeltQuake] = useState(null);
  const feltTimer = useRef(null);
  const mapRef = useRef(null);

  // Tap any quake (dot or list) to flash its felt-area circle for a few seconds.
  const showFelt = (q) => {
    if (!q || !Number.isFinite(q.mag)) return;
    setFeltQuake(q);
    clearTimeout(feltTimer.current);
    feltTimer.current = setTimeout(() => setFeltQuake(null), 7000);
  };
  useEffect(() => () => clearTimeout(feltTimer.current), []);
  // A list tap (focus) carrying a magnitude also flashes the felt area.
  useEffect(() => { if (focus && Number.isFinite(focus.mag)) showFelt(focus); }, [focus?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Chronological replay: sweep a playback clock through the sequence so each quake flares
  // as it happens, then fades (the glow/core recency below reads off this clock during replay).
  const REPLAY_MS = 28000; // whole window plays in ~28s
  const [replayT, setReplayT] = useState(null); // null = live; a timestamp = playback position
  const [playing, setPlaying] = useState(false);
  const mainShownAtRef = useRef(0); // real-time stamp when the mainshock appears (drives its shockwave)
  const timeline = useMemo(() => {
    const ts = (mainshock ? [mainshock, ...aftershocks] : aftershocks).map((q) => q.time).filter(Number.isFinite);
    return ts.length ? { min: Math.min(...ts), max: Math.max(...ts) } : null;
  }, [aftershocks, mainshock]);
  const startReplay = () => { if (timeline) { mainShownAtRef.current = 0; setReplayT(timeline.min); setPlaying(true); } };
  const exitReplay = () => { mainShownAtRef.current = 0; setPlaying(false); setReplayT(null); };
  const togglePlay = () => {
    if (!timeline) return;
    if (replayT != null && replayT >= timeline.max) { mainShownAtRef.current = 0; setReplayT(timeline.min); }
    setPlaying((p) => !p);
  };
  useEffect(() => {
    if (!playing || !timeline) return undefined;
    const span = timeline.max - timeline.min || 1;
    const msT = mainshock?.time;
    const FRAME = 66; // ~15 fps
    const id = setInterval(() => {
      setReplayT((prev) => {
        const cur = prev ?? timeline.min;
        // Slow-motion beat right around the mainshock for dramatic emphasis.
        const near = msT && Math.abs(cur - msT) < span * 0.013;
        const next = cur + (span / REPLAY_MS) * FRAME * (near ? 0.13 : 1);
        if (next >= timeline.max) { setPlaying(false); return timeline.max; }
        return next;
      });
    }, FRAME);
    return () => clearInterval(id);
  }, [playing, timeline, mainshock]);

  const live = replayT == null;
  const refTime = live ? Date.now() : replayT;
  const shownAfter = live ? aftershocks : aftershocks.filter((q) => q.time <= replayT);
  const mainVisible = mainshock && (live || mainshock.time <= replayT);
  // Stamp the moment the mainshock first appears during replay - its shockwave animates off this.
  useEffect(() => {
    if (!live && mainVisible && !mainShownAtRef.current) mainShownAtRef.current = Date.now();
  }, [live, mainVisible]);

  // Heatmap points: the FULL swarm (not thinned by zoom) weighted by magnitude, so the density view
  // shows every quake's contribution. Only built when the layer is on.
  const heatPoints = useMemo(() => {
    if (!showHeat) return [];
    const all = mainshock ? [mainshock, ...shownAfter, ...other] : [...shownAfter, ...other];
    return all
      .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && Number.isFinite(q.mag))
      .map((q) => [q.lat, q.lng, Math.max(0.15, Math.min(1, (q.mag - 2) / 5))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHeat, shownAfter, other, mainshock, live ? false : shownAfter.length]);

  // Core dots, memoised so playback frames don't re-style every marker (the cause of the jank).
  // Live: recency-lit (rare re-renders). Replay: static style - only the wave layers animate, and
  // this list rebuilds only when a new quake appears (shownAfter.length changes), not every frame.
  const coreDots = useMemo(() => {
    if (!showQuakes) return null;
    const floor = magFloorForZoom(zoom);
    const cut = refTime - RECENT_DOT_MS;
    return shownAfter.filter((q) => q.mag >= floor || q.time >= cut).map((q) => {
      const ageH = (refTime - q.time) / 3600000;
      const op = live ? coreFor(ageH) : 0.65;
      const rad = live ? dotRadius(q.mag, zoom) * (1 + 0.5 * glowFor(ageH)) : dotRadius(q.mag, zoom);
      return (
        <CircleMarker key={q.id} center={[q.lat, q.lng]} radius={rad}
          eventHandlers={{ click: () => showFelt(q) }}
          pathOptions={{ color: 'rgba(18,14,10,0.5)', weight: live ? 1 : 0, stroke: live, fillColor: magColor(q.mag), fillOpacity: op }}>
          <Popup>
            <div className="pin-pop">
              <span className="pp-mag">M{q.mag.toFixed(1)}</span> aftershock
              <div className="pp-sub">{q.place}<br />{relativeTime(q.time)}
                {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)} from you` : ''}</div>
            </div>
          </Popup>
        </CircleMarker>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuakes, zoom, live, live ? refTime : shownAfter.length]);

  // Replay: significant quakes leave a faint felt footprint after their wave, so the shaken
  // area visibly accumulates as the sequence plays. Memoised - rebuilds only when one is added.
  const bigShownCount = !live && showQuakes ? shownAfter.filter((q) => q.mag >= 5).length : 0;
  const feltFootprints = useMemo(() => {
    if (live || !showQuakes) return null;
    const big = shownAfter.filter((q) => q.mag >= 5);
    const items = mainVisible ? [mainshock, ...big] : big;
    return items.map((q) => (
      <Circle key={`fp-${q.id ?? 'main'}`} center={[q.lat, q.lng]} radius={feltRadiusM(q.mag)} interactive={false}
        pathOptions={{ color: q === mainshock ? '#D81E34' : magColor(q.mag), weight: 1, opacity: 0.16, fill: false }} />
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, showQuakes, mainVisible, bigShownCount]);

  // The active zone as a real polygon hugging the actual epicentres (hull of the cluster around
  // the mainshock, outliers dropped), instead of a plain rectangle. Falls back to the box.
  const computedZone = useMemo(() => {
    const center = mainshock ? [mainshock.lat, mainshock.lng] : REGION.center;
    const pts = mainshock ? [mainshock, ...aftershocks] : aftershocks;
    return activeZone(pts, center);
  }, [aftershocks, mainshock]);
  // Prefer the zone passed from App (so the on-map shape and the dashboard count always match).
  const zonePolygon = zone ?? computedZone;
  const zoneLabelPos = useMemo(() => {
    if (zonePolygon) {
      const lats = zonePolygon.map((p) => p[0]);
      const lngs = zonePolygon.map((p) => p[1]);
      return [Math.max(...lats), (Math.min(...lngs) + Math.max(...lngs)) / 2];
    }
    return [HL.maxLat, (HL.minLng + HL.maxLng) / 2];
  }, [zonePolygon]);

  // Briefly mark the tapped quake/report with a pulsing ring so it's easy to spot.
  useEffect(() => {
    if (!focus) return undefined;
    setHighlight(focus);
    const id = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(id);
  }, [focus?.t]);

  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const ids = [50, 200, 450].map((d) => setTimeout(() => m.invalidateSize(), d));
    return () => ids.forEach(clearTimeout);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const toggleCat = (k) => setCatFilter((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const visibleReports = reports.filter(
    (r) => catFilter.has(r.category) && !(hideResolved && r.state === 'resolved'),
  );

  return (
    <div className={`mapwrap${fill ? ' mapwrap-fill' : ''}${pinMode ? ' pin-mode' : ''}`}>
      <div className="maptools">
        <div className={`chip${showQuakes ? ' on' : ''}`} onClick={() => setShowQuakes((v) => !v)}>
          <span className="sw" style={{ background: 'var(--ember)' }} />Quakes
        </div>
        <div className={`chip${showReports ? ' on' : ''}`} onClick={() => setShowReports((v) => !v)}>
          <span className="sw" style={{ background: 'var(--c-help)' }} />Reports
        </div>
        <div className={`chip${showFilters ? ' on' : ''}`} onClick={() => setShowFilters((v) => !v)}>⚙ Layers</div>
      </div>
      <span className="map-live"><span className="live-dot" />LIVE</span>

      {showFilters && (
        <div className="map-filters">
          <button className="mf-close" onClick={() => setShowFilters(false)} aria-label="Close">✕</button>

          <div className="mf-title">Basemap</div>
          <div className="mf-cats">
            <button className={`mf-cat${!satellite ? ' on' : ''}`} onClick={() => { if (satellite) toggleSatellite(); }}>🗺 Map</button>
            <button className={`mf-cat${satellite ? ' on' : ''}`} onClick={() => { if (!satellite) toggleSatellite(); }}>🛰 Satellite</button>
          </div>

          <div className="mf-title">Overlays</div>
          <div className="mf-cats">
            <button className={`mf-cat${showFaults ? ' on' : ''}`} onClick={() => setShowFaults((v) => !v)}>🟥 Active faults</button>
            <button className={`mf-cat${showIntensity ? ' on' : ''}`} onClick={() => setShowIntensity((v) => !v)}>🌈 Shaking intensity</button>
            <button className={`mf-cat${showHeat ? ' on' : ''}`} onClick={() => setShowHeat((v) => !v)}>🔥 Activity heatmap</button>
          </div>
          <div className="mf-cats">
            <button className={`mf-cat${!hazard ? ' on' : ''}`} onClick={() => setHazard(null)}>No hazard map</button>
            {HAZARDS.map((h) => (
              <button key={h.key} className={`mf-cat${hazard === h.key ? ' on' : ''}`} onClick={() => setHazard(h.key)}>{h.label}</button>
            ))}
          </div>

          <div className="mf-title">Report types</div>
          <div className="mf-cats">
            {CATEGORIES.map((c) => (
              <button key={c.key} className={`mf-cat${catFilter.has(c.key) ? ' on' : ''}`}
                onClick={() => toggleCat(c.key)}>{c.icon} {c.label}</button>
            ))}
          </div>
          <button className={`mf-line${hideResolved ? ' on' : ''}`} onClick={() => setHideResolved((h) => !h)}>
            {hideResolved ? '☑' : '☐'} Hide resolved reports
          </button>

          <div className="mf-title">Jump to a city</div>
          <div className="mf-cities">
            {CITIES.map((ci) => (
              <button key={ci.name} className="mf-city"
                onClick={() => { mapRef.current?.flyTo(ci.c, 10); setShowFilters(false); }}>{ci.name}</button>
            ))}
          </div>
        </div>
      )}

      {pinMode && <div className="pin-hint">📍 Tap the map where it happened</div>}

      <div className="map-canvas" style={{ height: fill ? '100%' : expanded ? '78vh' : 280, width: '100%' }}>
      <MapContainer ref={mapRef} center={REGION.center} zoom={7} zoomControl={false} preferCanvas
        attributionControl={false} style={{ height: '100%', width: '100%' }}>
        <AttributionControl position="topright" prefix={false} />
        {satellite ? (
          <>
            <TileLayer key="sat" url={SAT_URL} maxZoom={18}
              attribution='Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics' />
            <TileLayer key="sat-roads" url={SAT_ROADS} maxZoom={18} />
            <TileLayer key="sat-labels" url={SAT_LABELS} maxZoom={18} />
          </>
        ) : (
        <TileLayer key={dark ? 'dark' : 'light'} url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19} />
        )}
        {hazard && HAZARD_MAP[hazard] && <ArcgisOverlay key={hazard} url={HAZARD_MAP[hazard].url} opacity={0.55} />}
        {showFaults && <ArcgisOverlay url={FAULT_URL} opacity={0.85} />}
        <HeatLayer points={heatPoints} show={showHeat && showQuakes} />
        <FollowUser user={user} />
        <FocusFlyer focus={focus} />
        <ZoomWatcher onZoom={setZoom} />
        {highlight && Number.isFinite(highlight.lat) && Number.isFinite(highlight.lng) && (
          <Marker position={[highlight.lat, highlight.lng]} icon={focusIcon} interactive={false} zIndexOffset={1000} />
        )}
        <MapClicker active={pinMode} onPick={(loc) => { setPinMode(false); onReportAt?.(loc); }} />
        {zonePolygon
          ? <Polygon positions={zonePolygon} interactive={false}
              pathOptions={{ color: '#E0521B', weight: 2, dashArray: '6 5', fillColor: '#E0521B', fillOpacity: 0.07 }} />
          : <Rectangle bounds={HL_BOUNDS} interactive={false}
              pathOptions={{ color: '#E0521B', weight: 2, dashArray: '6 5', fillColor: '#E0521B', fillOpacity: 0.05 }} />}
        <Marker position={zoneLabelPos} icon={zoneLabelIcon} interactive={false} />
        {/* Real USGS ShakeMap intensity contours (when on, they replace the estimated circles). */}
        {live && showIntensity && intensity?.contours?.map((c, i) => c.lines.map((line, j) => (
          <Polyline key={`mmi-${i}-${j}`} positions={line.map(([lng, lat]) => [lat, lng])} interactive={false}
            pathOptions={{ color: c.color, weight: 2.5, opacity: 0.9 }} />
        )))}
        {/* Estimated felt areas (magnitude-based). Hidden during replay to keep the animation clean. */}
        {live && showQuakes && aftershocks.filter((q) => q.mag >= 4.5).map((q) => (
          <Circle key={`felt-${q.id}`} center={[q.lat, q.lng]} radius={feltRadiusM(q.mag)} interactive={false}
            pathOptions={{ color: magColor(q.mag), weight: 1, opacity: 0.3, fill: false }} />
        ))}
        {/* Other PH quakes outside the Sarangani sequence: shown with neutral labels (never
            called "aftershock"), distinguished by a dashed outline. Live only. */}
        {live && showQuakes && other.filter((q) => q.mag >= magFloorForZoom(zoom) || q.time >= Date.now() - RECENT_DOT_MS).map((q) => (
          <CircleMarker key={`other-${q.id}`} center={[q.lat, q.lng]} radius={dotRadius(q.mag, zoom)}
            eventHandlers={{ click: () => showFelt(q) }}
            pathOptions={{ color: 'rgba(18,14,10,0.55)', weight: 1, dashArray: '2 3',
              fillColor: magColor(q.mag), fillOpacity: 0.5 }}>
            <Popup>
              <div className="pin-pop">
                <span className="pp-mag">M{q.mag.toFixed(1)}</span> earthquake
                <div className="pp-sub">{q.place}<br />{relativeTime(q.time)}
                  {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)} from you` : ''}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {live && showQuakes && mainshock && (
          <>
            <Circle center={[mainshock.lat, mainshock.lng]} radius={feltRadiusM(mainshock.mag)} interactive={false}
              pathOptions={{ color: '#CC2A2A', weight: 2, opacity: 0.55, fillColor: '#CC2A2A', fillOpacity: 0.04 }} />
            <Circle center={[mainshock.lat, mainshock.lng]} radius={strongRadiusM(mainshock.mag)} interactive={false}
              pathOptions={{ color: '#CC2A2A', weight: 2, opacity: 0.7, fillColor: '#CC2A2A', fillOpacity: 0.12 }} />
          </>
        )}
        {live && showQuakes && feltQuake && (
          <Circle center={[feltQuake.lat, feltQuake.lng]} radius={feltRadiusM(feltQuake.mag)} interactive={false}
            pathOptions={{ color: magColor(feltQuake.mag), weight: 2, dashArray: '5 4', opacity: 0.75, fillColor: magColor(feltQuake.mag), fillOpacity: 0.1 }} />
        )}
        {/* dramatic mainshock shockwave: rings expand to its real felt + strong-shaking radius (replay) */}
        {!live && mainVisible && mainShownAtRef.current > 0 && (() => {
          const p = (Date.now() - mainShownAtRef.current) / 3200;
          if (p < 0 || p > 1) return null;
          const e = 1 - (1 - p) ** 2; // ease-out
          const f = (1 - p) ** 2;
          return (
            <>
              <Circle center={[mainshock.lat, mainshock.lng]} radius={feltRadiusM(mainshock.mag) * e} interactive={false}
                pathOptions={{ color: '#D81E34', weight: 3 * (1 - p) + 0.6, opacity: 0.72 * (1 - p),
                  fillColor: '#D81E34', fillOpacity: 0.3 * f }} />
              <Circle center={[mainshock.lat, mainshock.lng]} radius={strongRadiusM(mainshock.mag) * e} interactive={false}
                pathOptions={{ color: '#F0461E', weight: 2 * (1 - p) + 0.5, opacity: 0.6 * (1 - p), fill: false }} />
            </>
          );
        })()}
        {showQuakes && mainVisible && (
          <Marker position={[mainshock.lat, mainshock.lng]} icon={epicenterIcon(mainshock.mag, zoom)}
            eventHandlers={{ click: () => showFelt(mainshock) }}>
            <Popup>
              <div className="pin-pop">
                <span className="pp-mag">M{mainshock.mag.toFixed(1)}</span> · strongest
                <div className="pp-sub">{mainshock.place}<br />{formatClock(mainshock.time)} · {relativeTime(mainshock.time)}
                  {mainshock.depthKm != null ? ` · ${Math.round(mainshock.depthKm)} km deep` : ''}
                  {mainshock.distanceKm != null ? ` · ≈ ${formatKm(mainshock.distanceKm)} from you` : ''}</div>
                <div className="pp-felt">○ Rings = <b>estimated</b> felt area (modeled from magnitude); actual shaking varies with depth, soil &amp; distance.</div>
              </div>
            </Popup>
          </Marker>
        )}
        {/* glow layer (live only): every dot gets a soft halo (so it's luminous, not a flat disc),
            brighter for recent quakes. In replay the expanding waves carry the energy instead. */}
        {live && showQuakes && shownAfter.filter((q) => q.mag >= magFloorForZoom(zoom) || q.time >= refTime - RECENT_DOT_MS).map((q) => {
          const g = glowFor((refTime - q.time) / 3600000);
          return (
            <CircleMarker key={`glow-${q.id}`} center={[q.lat, q.lng]} radius={dotRadius(q.mag, zoom) * (1.9 + 0.5 * g)}
              interactive={false} pathOptions={{ stroke: false, fillColor: magColor(q.mag), fillOpacity: 0.12 + 0.26 * g }} />
          );
        })}
        {/* lasting footprints of the biggest quakes (replay) */}
        {feltFootprints}
        {/* Each quake is a RIPPLE seen from orbit: a bright point that erupts outward to its felt
            radius while its centre hollows and fades - then dissipates. (replay only) */}
        {!live && showQuakes && shownAfter.filter((q) => q.mag >= 2.5).map((q) => {
          const ageH = (refTime - q.time) / 3600000;
          if (ageH < 0 || ageH > 16) return null;
          const p = ageH / 16;
          const e = 1 - (1 - p) ** 2;          // ease-out expansion of the wavefront
          const f = (1 - p) ** 2;              // centre fill fades faster than the ring (hollows out)
          return (
            <Circle key={`rip-${q.id}`} center={[q.lat, q.lng]} radius={feltRadiusM(q.mag) * e} interactive={false}
              pathOptions={{ color: magColor(q.mag), weight: 2.2 * (1 - p) + 0.4, opacity: 0.72 * (1 - p),
                fillColor: magColor(q.mag), fillOpacity: 0.4 * f }} />
          );
        })}
        {/* core dots (memoised - see coreDots above) */}
        {coreDots}
        {showReports && visibleReports.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r.category, r.state === 'resolved')}>
            <Popup>
              <div className="pin-pop">
                <span className="cat-tag" style={{ background: categoryColor(r.category) }}>{categoryIcon(r.category)} {CAT_LABEL[r.category] || 'Report'}</span>
                <div className="pp-sub">{relativeTime(r.createdAt)}{r.distanceKm != null ? ` · ≈ ${formatKm(r.distanceKm)} from you` : ''}{r.state === 'resolved' ? ' · ✅ resolved' : r.state === 'confirmed' ? ' · ✓ confirmed' : ''}</div>
                {r.note && <div className="pp-note">{r.note}</div>}
                {r.photoUrl && <img className="pp-photo" src={r.photoUrl} alt="" />}
              </div>
            </Popup>
          </Marker>
        ))}
        {AFFECTED_AREAS.map((a) => (
          <Marker key={a.name} position={[a.lat, a.lng]} icon={affectedIcon}>
            <Popup>
              <div className="pin-pop">
                <span className="cat-tag" style={{ background: '#B03030' }}>⚠ Hard-hit area</span>
                <div className="pp-sub">{a.name}</div>
                <div className="pp-note">{a.note}</div>
                <div className="pp-src">Based on news coverage, not a pinpoint citizen report.</div>
              </div>
            </Popup>
          </Marker>
        ))}
        <Marker position={user} icon={youIcon}>
          <Popup>You are here</Popup>
        </Marker>
      </MapContainer>
      </div>

      {onReportAt && (
        <button className={`map-pin${pinMode ? ' on' : ''}`} onClick={() => setPinMode((p) => !p)}>
          {pinMode ? '✕ Cancel' : '📍 Report on map'}
        </button>
      )}
      {!fill && (
        <button className="map-btn map-expand" aria-label={expanded ? 'Exit fullscreen' : 'Expand map'}
          onClick={() => setExpanded((v) => !v)}>
          {expanded ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 9H4M9 9V4M15 9h5M15 9V4M9 15H4M9 15v5M15 15h5M15 15v5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          )}
        </button>
      )}
      <div className="map-ctrls">
        {timeline && live && (
          <button className="map-btn map-replay" aria-label="Replay the sequence" onClick={startReplay}>⏱</button>
        )}
        <button className="map-btn" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button className="map-btn" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14" /></svg>
        </button>
        <button className="map-btn" aria-label="Center on my location" onClick={() => mapRef.current?.flyTo(user, 12)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        </button>
      </div>

      {!live && mainShownAtRef.current > 0 && (Date.now() - mainShownAtRef.current) < 750 && (
        <div className="quake-flash" />
      )}
      {!live && mainShownAtRef.current > 0 && (Date.now() - mainShownAtRef.current) < 2800 && mainshock && (
        <div className="quake-callout">M{mainshock.mag.toFixed(1)} · mainshock</div>
      )}

      {!live && timeline && (
        <div className="replay-bar">
          <button className="replay-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸' : (replayT >= timeline.max ? '↻' : '▶')}
          </button>
          <div className="replay-main">
            <input className="replay-scrub" type="range" min={timeline.min} max={timeline.max} step={60000}
              value={replayT} onChange={(e) => { setPlaying(false); setReplayT(Number(e.target.value)); }}
              aria-label="Scrub the earthquake timeline" />
            <div className="replay-meta">
              <span className="replay-time">{new Date(replayT).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              <span className="replay-count">{shownAfter.length + (mainVisible ? 1 : 0)} quakes</span>
            </div>
          </div>
          <button className="replay-close" onClick={exitReplay} aria-label="Exit replay">✕</button>
        </div>
      )}

      <div className="legend">
        <span><i style={{ background: 'var(--ember)' }} />Epicenter</span>
        <span><i style={{ background: 'var(--c-damage)' }} />Damage</span>
        <span><i style={{ background: 'var(--c-road)' }} />Road</span>
        <span><i style={{ background: 'var(--c-fire)' }} />Fire</span>
        <span><i style={{ background: 'var(--c-help)' }} />Need help</span>
        <span><i style={{ background: 'var(--c-safe)' }} />Safe</span>
        <span>◯ Est. felt area · inner = stronger</span>
        {live && magFloorForZoom(zoom) >= 2.5 && <span>🔍 Zoom in for smaller quakes</span>}
        {showHeat && <span>🔥 Activity density</span>}
        {showIntensity && <span>🌈 Shaking intensity (MMI) · USGS</span>}
        {AFFECTED_AREAS.length > 0 && <span>⚠ Hard-hit area · news</span>}
        {showFaults && <span><i style={{ background: '#B03030' }} />Active fault · PHIVOLCS</span>}
        {hazard && HAZARD_MAP[hazard] && <span>⚠️ {HAZARD_MAP[hazard].label} hazard · PHIVOLCS</span>}
      </div>
    </div>
  );
}
