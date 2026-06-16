import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuakes } from '../quakes/useQuakes.js';

// Standalone Mapbox GL proof-of-concept (route #mapbox). Lazy-loaded so mapbox-gl never bloats the
// main app. Shows the live quakes on a 3D, rotatable, deep-zoom vector/satellite map - the things
// Leaflet can't do - so we can judge a possible migration before committing.
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function magColor(m) {
  return m >= 6 ? '#D81E34' : m >= 5 ? '#F0461E' : m >= 4 ? '#F5851B'
    : m >= 3 ? '#F2B01E' : m >= 2 ? '#E4C84A' : '#C9C3A0';
}

export default function MapboxPoc() {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const { all } = useQuakes();

  useEffect(() => {
    if (!TOKEN || !elRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: elRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [124.85, 6.7],
      zoom: 7.4,
      pitch: 62,
      bearing: -20,
      antialias: true,
      projection: 'mercator',
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl());

    map.on('style.load', () => {
      // 3D terrain + sky so the relief (and the trenches/ridges undersea) reads in 3D.
      map.addSource('dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      map.setTerrain({ source: 'dem', exaggeration: 1.4 });
      map.addLayer({ id: 'sky', type: 'sky', paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0, 0], 'sky-atmosphere-sun-intensity': 12 } });

      map.addSource('quakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // soft glow under the dots
      map.addLayer({
        id: 'quakes-glow', type: 'circle', source: 'quakes',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2, 6, 5, 22, 7.8, 46],
          'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'quakes', type: 'circle', source: 'quakes',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 1, 2.5, 4, 7, 6, 13, 7.8, 24],
          'circle-color': ['get', 'color'], 'circle-opacity': 0.92,
          'circle-stroke-width': 0.6, 'circle-stroke-color': 'rgba(20,14,10,0.5)',
        },
      });
      pushData(map, all);
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the dots in sync with the live feed
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.getSource && map.getSource('quakes')) pushData(map, all);
  }, [all]);

  if (!TOKEN) {
    return <div style={{ padding: 24, fontFamily: 'system-ui' }}>Set <code>VITE_MAPBOX_TOKEN</code> to preview the Mapbox map.</div>;
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1622' }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(20,17,14,.82)', color: '#fff', padding: '8px 12px', borderRadius: 10, font: '600 12.5px system-ui', backdropFilter: 'blur(6px)' }}>
        <a href="#" style={{ color: '#F5851B', textDecoration: 'none' }}>← LINDOL</a>
        <span style={{ opacity: 0.55 }}>|</span>
        <span>Mapbox GL preview · drag to pan, right-drag to rotate/tilt</span>
      </div>
    </div>
  );
}

function pushData(map, all) {
  const src = map.getSource('quakes');
  if (!src) return;
  src.setData({
    type: 'FeatureCollection',
    features: (all || [])
      .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && Number.isFinite(q.mag))
      .map((q) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q.lng, q.lat] }, properties: { mag: q.mag, color: magColor(q.mag) } })),
  });
}
