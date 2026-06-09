import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, Rectangle, AttributionControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { REGION } from '../../config.js';
import { reportIcon } from '../reports/reportMarkers.js';
import { categoryColor, categoryIcon, CATEGORIES } from '../reports/reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime, formatClock } from '../../lib/time.js';

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

// The epicenter scales with its magnitude (so it's the biggest marker) and shows it.
function epicenterIcon(mag) {
  const core = Math.round(magRadius(mag) * 2 + 8);
  const box = core + 6;
  return L.divIcon({
    className: '', iconSize: [box, box], iconAnchor: [box / 2, box / 2],
    html: `<div class="epi" style="width:${box}px;height:${box}px"><div class="ring"></div>`
      + `<div class="core" style="width:${core}px;height:${core}px;background:${magColor(mag)}">${mag.toFixed(1)}</div></div>`,
  });
}
const youIcon = L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11],
  html: '<div class="youdot"><span class="youpulse"></span><span class="youcore"></span></div>' });
const zoneLabelIcon = L.divIcon({ className: 'zone-label-wrap', iconSize: [190, 20], iconAnchor: [95, 10],
  html: '<span class="zone-label">Active aftershock zone</span>' });
const focusIcon = L.divIcon({ className: '', iconSize: [48, 48], iconAnchor: [24, 24],
  html: '<div class="focus-ring"></div>' });
const HL = REGION.highlight;
const HL_BOUNDS = [[HL.minLat, HL.minLng], [HL.maxLat, HL.maxLng]];

const CITIES = [
  { name: 'Davao', c: [7.07, 125.61] },
  { name: 'Gen. Santos', c: [6.11, 125.17] },
  { name: 'Sarangani', c: [5.96, 125.20] },
  { name: 'Cotabato', c: [7.22, 124.25] },
  { name: 'Koronadal', c: [6.50, 124.85] },
];

function magColor(m) { return m >= 6 ? '#CC2A2A' : m >= 5 ? '#E0521B' : m >= 4 ? '#C08A1E' : '#9A5B16'; }
function magRadius(m) { return Math.max(3.5, 3.5 + (m - 2.5) * 2.3); }

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
  mainshock, aftershocks = [], reports = [], user = REGION.defaultUser,
  fill = false, dark = false, onReportAt, focus,
}) {
  const [showQuakes, setShowQuakes] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [catFilter, setCatFilter] = useState(() => new Set(CATEGORIES.map((c) => c.key)));
  const [hideResolved, setHideResolved] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const mapRef = useRef(null);

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
        <div className={`chip${showFilters ? ' on' : ''}`} onClick={() => setShowFilters((v) => !v)}>⚙ Filters</div>
        <span className="map-live"><span className="live-dot" />LIVE</span>
      </div>

      {showFilters && (
        <div className="map-filters">
          <div className="mf-title">Show report types</div>
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
      <MapContainer ref={mapRef} center={REGION.center} zoom={7} zoomControl={false}
        attributionControl={false} style={{ height: '100%', width: '100%' }}>
        <AttributionControl position="topright" prefix={false} />
        <TileLayer key={dark ? 'dark' : 'light'} url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19} />
        <FollowUser user={user} />
        <FocusFlyer focus={focus} />
        {highlight && Number.isFinite(highlight.lat) && Number.isFinite(highlight.lng) && (
          <Marker position={[highlight.lat, highlight.lng]} icon={focusIcon} interactive={false} zIndexOffset={1000} />
        )}
        <MapClicker active={pinMode} onPick={(loc) => { setPinMode(false); onReportAt?.(loc); }} />
        <Rectangle bounds={HL_BOUNDS} interactive={false}
          pathOptions={{ color: '#E0521B', weight: 2, dashArray: '6 5', fillColor: '#E0521B', fillOpacity: 0.05 }} />
        <Marker position={[HL.maxLat, (HL.minLng + HL.maxLng) / 2]} icon={zoneLabelIcon} interactive={false} />
        {showQuakes && mainshock && (
          <Marker position={[mainshock.lat, mainshock.lng]} icon={epicenterIcon(mainshock.mag)}>
            <Popup>
              <div className="pin-pop">
                <span className="pp-mag">M{mainshock.mag.toFixed(1)}</span> · strongest
                <div className="pp-sub">{mainshock.place}<br />{formatClock(mainshock.time)} · {relativeTime(mainshock.time)}
                  {mainshock.depthKm != null ? ` · ${Math.round(mainshock.depthKm)} km deep` : ''}
                  {mainshock.distanceKm != null ? ` · ≈ ${formatKm(mainshock.distanceKm)} from you` : ''}</div>
              </div>
            </Popup>
          </Marker>
        )}
        {showQuakes && aftershocks.map((q) => (
          <CircleMarker key={q.id} center={[q.lat, q.lng]} radius={magRadius(q.mag)}
            pathOptions={{ color: '#fff', weight: 1.5, fillColor: magColor(q.mag), fillOpacity: 0.85 }}>
            <Popup>
              <div className="pin-pop">
                <span className="pp-mag">M{q.mag.toFixed(1)}</span> aftershock
                <div className="pp-sub">{q.place}<br />{relativeTime(q.time)}
                  {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)} from you` : ''}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
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
      <button className="map-btn map-recenter" aria-label="Center on my location"
        onClick={() => mapRef.current?.flyTo(user, 12)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>

      <div className="legend">
        <span><i style={{ background: 'var(--ember)' }} />Epicenter</span>
        <span><i style={{ background: 'var(--c-damage)' }} />Damage</span>
        <span><i style={{ background: 'var(--c-road)' }} />Road</span>
        <span><i style={{ background: 'var(--c-fire)' }} />Fire</span>
        <span><i style={{ background: 'var(--c-help)' }} />Need help</span>
        <span><i style={{ background: 'var(--c-safe)' }} />Safe</span>
      </div>
    </div>
  );
}
