import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, AttributionControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { REGION } from '../../config.js';
import { reportIcon } from '../reports/reportMarkers.js';
import { categoryColor, CATEGORIES } from '../reports/reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime, formatClock } from '../../lib/time.js';

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

const epiIcon = L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div class="epi"><div class="ring"></div><div class="core"></div></div>' });
const afterIcon = L.divIcon({ className: '', iconSize: [11, 11], iconAnchor: [5, 5],
  html: '<div class="after"></div>' });

const isRealFix = (u) => u && (u[0] !== REGION.defaultUser[0] || u[1] !== REGION.defaultUser[1]);

// Auto-center on the user once, when their first real GPS fix arrives.
function FollowUser({ user }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !isRealFix(user)) return;
    map.setView(user, 11);
    done.current = true;
  }, [user, map]);
  return null;
}

export default function QuakeMap({ mainshock, aftershocks = [], reports = [], user = REGION.defaultUser, fill = false }) {
  const [showQuakes, setShowQuakes] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const mapRef = useRef(null);
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  // Leaflet must recompute its size when the container resizes (expand/collapse).
  // Fire several times so it settles regardless of layout/transition timing.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const ids = [50, 200, 450].map((d) => setTimeout(() => m.invalidateSize(), d));
    return () => ids.forEach(clearTimeout);
  }, [expanded]);

  // Allow Esc to exit fullscreen.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <div className={`mapwrap${fill ? ' mapwrap-fill' : ''}`}>
      <div className="maptools">
        <div className={`chip${showQuakes ? ' on' : ''}`} onClick={() => setShowQuakes((v) => !v)}>
          <span className="sw" style={{ background: 'var(--ember)' }} />Quakes
        </div>
        <div className={`chip${showReports ? ' on' : ''}`} onClick={() => setShowReports((v) => !v)}>
          <span className="sw" style={{ background: 'var(--c-help)' }} />Reports
        </div>
      </div>
      <div className="map-canvas" style={{ height: fill ? '100%' : expanded ? '78vh' : 280, width: '100%' }}>
      <MapContainer ref={mapRef} center={REGION.center} zoom={9} zoomControl={false}
        attributionControl={false} style={{ height: '100%', width: '100%' }}>
        <AttributionControl position="topright" prefix={false} />
        <TileLayer key={dark ? 'dark' : 'light'}
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19} />
        <FollowUser user={user} />
        {showQuakes && mainshock && (
          <Marker position={[mainshock.lat, mainshock.lng]} icon={epiIcon}>
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
          <Marker key={q.id} position={[q.lat, q.lng]} icon={afterIcon}>
            <Popup>
              <div className="pin-pop">
                <span className="pp-mag">M{q.mag.toFixed(1)}</span> aftershock
                <div className="pp-sub">{q.place}<br />{relativeTime(q.time)}
                  {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)} from you` : ''}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {showReports && reports.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r.category)}>
            <Popup>
              <div className="pin-pop">
                <span className="cat-tag" style={{ background: categoryColor(r.category) }}>{CAT_LABEL[r.category] || 'Report'}</span>
                <div className="pp-sub">{relativeTime(r.createdAt)}{r.distanceKm != null ? ` · ≈ ${formatKm(r.distanceKm)} from you` : ''}</div>
                {r.note && <div className="pp-note">{r.note}</div>}
                {r.photoUrl && <img className="pp-photo" src={r.photoUrl} alt="" />}
              </div>
            </Popup>
          </Marker>
        ))}
        <CircleMarker center={user} radius={6}
          pathOptions={{ color: '#14110D', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
          <Popup>You are here</Popup>
        </CircleMarker>
      </MapContainer>
      </div>

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
