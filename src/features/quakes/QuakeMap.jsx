import { MapContainer, TileLayer, Marker, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { REGION } from '../../config.js';

const epiIcon = L.divIcon({
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div class="epi"><div class="ring"></div><div class="core"></div></div>',
});
const afterIcon = L.divIcon({
  className: '', iconSize: [11, 11], iconAnchor: [5, 5],
  html: '<div class="after"></div>',
});

export default function QuakeMap({ mainshock, aftershocks = [], user = REGION.defaultUser }) {
  return (
    <div className="mapwrap">
      <MapContainer center={REGION.center} zoom={9} zoomControl={false}
        attributionControl={false} style={{ height: 280, width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" maxZoom={19} />
        {mainshock && (
          <Marker position={[mainshock.lat, mainshock.lng]} icon={epiIcon}>
            <Popup><b>M{mainshock.mag.toFixed(1)}</b> · main shock</Popup>
          </Marker>
        )}
        {aftershocks.map((q) => (
          <Marker key={q.id} position={[q.lat, q.lng]} icon={afterIcon}>
            <Popup>Aftershock M{q.mag.toFixed(1)}</Popup>
          </Marker>
        ))}
        <CircleMarker center={user} radius={6}
          pathOptions={{ color: '#14110D', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
          <Popup>You are here</Popup>
        </CircleMarker>
      </MapContainer>
      <div className="legend">
        <span><i style={{ background: 'var(--ember)' }} />Epicenter</span>
        <span><i style={{ background: 'rgba(224,82,27,.55)' }} />Aftershock</span>
      </div>
    </div>
  );
}
