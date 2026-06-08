import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, AttributionControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { REGION } from '../../config.js';
import { reportIcon } from '../reports/reportMarkers.js';

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

export default function QuakeMap({ mainshock, aftershocks = [], reports = [], user = REGION.defaultUser }) {
  const [showQuakes, setShowQuakes] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const mapRef = useRef(null);

  return (
    <div className="mapwrap">
      <div className="maptools">
        <div className={`chip${showQuakes ? ' on' : ''}`} onClick={() => setShowQuakes((v) => !v)}>
          <span className="sw" style={{ background: 'var(--ember)' }} />Quakes
        </div>
        <div className={`chip${showReports ? ' on' : ''}`} onClick={() => setShowReports((v) => !v)}>
          <span className="sw" style={{ background: 'var(--c-help)' }} />Reports
        </div>
      </div>
      <MapContainer ref={mapRef} center={REGION.center} zoom={9} zoomControl={false}
        attributionControl={false} style={{ height: 280, width: '100%' }}>
        <AttributionControl position="topright" prefix={false} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19} />
        <FollowUser user={user} />
        {showQuakes && mainshock && (
          <Marker position={[mainshock.lat, mainshock.lng]} icon={epiIcon}>
            <Popup><b>M{mainshock.mag.toFixed(1)}</b> · main shock</Popup>
          </Marker>
        )}
        {showQuakes && aftershocks.map((q) => (
          <Marker key={q.id} position={[q.lat, q.lng]} icon={afterIcon}>
            <Popup>Aftershock M{q.mag.toFixed(1)}</Popup>
          </Marker>
        ))}
        {showReports && reports.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r.category)}>
            <Popup>{r.note || r.category}</Popup>
          </Marker>
        ))}
        <CircleMarker center={user} radius={6}
          pathOptions={{ color: '#14110D', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
          <Popup>You are here</Popup>
        </CircleMarker>
      </MapContainer>
      <button className="map-recenter" aria-label="Center on my location"
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
