import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuakes } from '../quakes/useQuakes.js';

// Free community-tier map POC: MapLibre GL (open-source, no token, no billing) + free tiles.
// Rotatable/tilt/3D, with an Ocean (bathymetry) basemap, free OpenFreeMap vector streets, and Esri
// satellite - the rotatable/ocean/better-than-Leaflet map for the public tier at $0.
function magColor(m) {
  return m >= 6 ? '#D81E34' : m >= 5 ? '#F0461E' : m >= 4 ? '#F5851B'
    : m >= 3 ? '#F2B01E' : m >= 2 ? '#E4C84A' : '#C9C3A0';
}

const OCEAN_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
const OCEAN_REF = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}';
const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function rasterStyle(tiles, attribution) {
  return {
    version: 8,
    sources: Object.fromEntries(tiles.map((u, i) => [`b${i}`, { type: 'raster', tiles: [u], tileSize: 256, attribution }])),
    layers: tiles.map((u, i) => ({ id: `b${i}`, type: 'raster', source: `b${i}` })),
  };
}
const STYLES = {
  ocean: rasterStyle([OCEAN_BASE, OCEAN_REF], 'Bathymetry &copy; Esri, GEBCO, NOAA, Nat Geo'),
  satellite: rasterStyle([SAT], 'Imagery &copy; Esri, Maxar, Earthstar'),
  vector: 'https://tiles.openfreemap.org/styles/liberty',
};
const BASES = [['ocean', '🌊 Ocean'], ['vector', '🗺 Streets'], ['satellite', '🛰 Satellite']];

function emptyFC() { return { type: 'FeatureCollection', features: [] }; }

export default function MapLibrePoc() {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const { all } = useQuakes();
  const allRef = useRef(all);
  allRef.current = all;
  const [base, setBase] = useState('ocean');

  useEffect(() => {
    const map = new maplibregl.Map({
      container: elRef.current,
      style: STYLES.ocean,
      center: [124.2, 9.5], zoom: 5.4, pitch: 50, bearing: -12, maxPitch: 80,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl());
    // re-add terrain + quakes on every style (re)load, since setStyle wipes custom sources/layers
    map.on('style.load', () => addOverlays(map, allRef.current));
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const m = mapRef.current; if (m) m.setStyle(STYLES[base]); }, [base]);

  useEffect(() => {
    const m = mapRef.current;
    if (m && m.getSource && m.getSource('quakes')) m.getSource('quakes').setData(quakeFC(all));
  }, [all]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1622' }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={S.bar}>
        <a href="#" style={S.back}>← LINDOL</a>
        <span style={S.sep}>|</span>
        <span style={S.label}>Free community map (MapLibre) ·</span>
        {BASES.map(([k, lbl]) => (
          <button key={k} onClick={() => setBase(k)} style={{ ...S.chip, ...(base === k ? S.chipOn : null) }}>{lbl}</button>
        ))}
        <span style={S.hint}>drag to pan · right-drag to rotate/tilt</span>
      </div>
    </div>
  );
}

function quakeFC(all) {
  return {
    type: 'FeatureCollection',
    features: (all || []).filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && Number.isFinite(q.mag))
      .map((q) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q.lng, q.lat] }, properties: { mag: q.mag, color: magColor(q.mag) } })),
  };
}

function addOverlays(map, all) {
  if (!map.getSource('quakes')) {
    map.addSource('quakes', { type: 'geojson', data: emptyFC() });
    map.addLayer({ id: 'q-glow', type: 'circle', source: 'quakes', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2, 6, 5, 24, 7.8, 48], 'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-opacity': 0.32 } });
    map.addLayer({ id: 'q', type: 'circle', source: 'quakes', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 1, 2.5, 4, 7, 6, 13, 7.8, 24], 'circle-color': ['get', 'color'], 'circle-opacity': 0.92, 'circle-stroke-width': 0.6, 'circle-stroke-color': 'rgba(20,14,10,0.5)' } });
  }
  map.getSource('quakes').setData(quakeFC(all));
}

const S = {
  bar: { position: 'absolute', top: 12, left: 12, zIndex: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', maxWidth: 'calc(100% - 24px)',
    background: 'rgba(20,17,14,.82)', color: '#fff', padding: '8px 12px', borderRadius: 10, font: '600 12.5px var(--font)', backdropFilter: 'blur(6px)' },
  back: { color: '#F5851B', textDecoration: 'none' },
  sep: { opacity: 0.4 },
  label: { opacity: 0.85 },
  chip: { background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.18)', borderRadius: 7, padding: '4px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  chipOn: { background: '#F5851B', color: '#161109', border: '1px solid #F5851B' },
  hint: { opacity: 0.5, fontWeight: 500 },
};
