import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuakes } from '../quakes/useQuakes.js';
import { dataBankStats, exportArchiveCsv } from './commandApi.js';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function magColor(m) {
  return m >= 6 ? '#D81E34' : m >= 5 ? '#F0461E' : m >= 4 ? '#F5851B'
    : m >= 3 ? '#F2B01E' : m >= 2 ? '#E4C84A' : '#C9C3A0';
}
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtNum = (n) => (n ?? 0).toLocaleString('en-PH');

export default function CommandCenter({ access, email, onSignOut }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const { all } = useQuakes();
  const [stats, setStats] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { dataBankStats().then(setStats).catch(() => {}); }, []);

  useEffect(() => {
    if (!TOKEN || !elRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: elRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [124.2, 9.2], zoom: 5.6, pitch: 45, bearing: -12, antialias: true, projection: 'mercator',
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.on('style.load', () => {
      map.addSource('dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      map.setTerrain({ source: 'dem', exaggeration: 1.3 });
      map.addLayer({ id: 'sky', type: 'sky', paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun-intensity': 10 } });
      map.addSource('quakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'q-glow', type: 'circle', source: 'quakes', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2, 6, 5, 24, 7.8, 48], 'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-opacity': 0.32 } });
      map.addLayer({ id: 'q', type: 'circle', source: 'quakes', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 1, 2.5, 4, 7, 6, 13, 7.8, 24], 'circle-color': ['get', 'color'], 'circle-opacity': 0.92, 'circle-stroke-width': 0.6, 'circle-stroke-color': 'rgba(20,14,10,0.5)' } });
      pushQuakes(map, all);
    });
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && map.getSource && map.getSource('quakes')) pushQuakes(map, all);
  }, [all]);

  const doExport = async () => {
    setExporting(true);
    try { await exportArchiveCsv(); } catch { /* ignore */ }
    setExporting(false);
  };

  return (
    <div style={S.wrap}>
      <div ref={elRef} style={S.map} />
      {!TOKEN && <div style={S.tokenWarn}>Set VITE_MAPBOX_TOKEN to load the command map.</div>}

      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={S.brand}>LINDOL <span style={{ color: '#F5851B' }}>Command Center</span></span>
          <span style={S.org}>{access?.org || 'Agency'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={S.live}><span style={S.dot} /> {fmtNum(all?.length)} live quakes</span>
          <span style={S.user}>{email} · {access?.role}</span>
          <button style={S.signout} onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <section style={S.bank}>
        <div style={S.bankTitle}>📦 Data Bank · durable archive</div>
        {!stats ? <div style={S.muted}>Loading…</div> : (
          <>
            <div style={S.bigNum}>{fmtNum(stats.total)}</div>
            <div style={S.muted}>quakes preserved</div>
            <div style={S.range}>{fmtDate(stats.earliest)} → {fmtDate(stats.latest)}</div>
            <div style={S.srcRow}>
              <Src label="PHIVOLCS" n={stats.bySource.phivolcs} />
              <Src label="USGS" n={stats.bySource.usgs} />
              <Src label="EMSC" n={stats.bySource.emsc} />
            </div>
            <button style={S.export} onClick={doExport} disabled={exporting}>
              {exporting ? 'Preparing…' : '⤓ Export CSV'}
            </button>
            <div style={S.note}>Continuously preserved in cloud storage. Reports archive + responder routing next.</div>
          </>
        )}
      </section>
    </div>
  );
}

function Src({ label, n }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{fmtNum(n)}</div>
      <div style={{ fontSize: 9.5, letterSpacing: '.05em', color: '#9aa', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function pushQuakes(map, all) {
  const src = map.getSource('quakes');
  if (!src) return;
  src.setData({
    type: 'FeatureCollection',
    features: (all || []).filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && Number.isFinite(q.mag))
      .map((q) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q.lng, q.lat] }, properties: { mag: q.mag, color: magColor(q.mag) } })),
  });
}

const S = {
  wrap: { position: 'fixed', inset: 0, background: '#0b1622', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  map: { position: 'absolute', inset: 0 },
  tokenWarn: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', background: 'linear-gradient(180deg, rgba(11,18,28,.92), rgba(11,18,28,.55) 70%, transparent)', backdropFilter: 'blur(4px)' },
  brand: { fontWeight: 800, fontSize: 16, letterSpacing: '.01em' },
  org: { fontSize: 12, color: '#9fb0c0' },
  live: { fontSize: 12, color: '#cfe', display: 'inline-flex', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 8, background: '#2ec16b', display: 'inline-block' },
  user: { fontSize: 11.5, color: '#9fb0c0' },
  signout: { background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  bank: { position: 'absolute', top: 64, left: 16, zIndex: 5, width: 232, padding: '14px 16px', borderRadius: 14,
    background: 'rgba(16,22,32,.86)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 30px rgba(0,0,0,.35)' },
  bankTitle: { fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#bcd', textTransform: 'uppercase', marginBottom: 10 },
  bigNum: { fontSize: 34, fontWeight: 800, lineHeight: 1, color: '#F5851B' },
  muted: { fontSize: 11.5, color: '#9aa' },
  range: { fontSize: 11.5, color: '#cdd', margin: '8px 0 12px', fontFamily: 'ui-monospace, monospace' },
  srcRow: { display: 'flex', justifyContent: 'space-between', gap: 6, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,.1)', borderBottom: '1px solid rgba(255,255,255,.1)' },
  export: { width: '100%', marginTop: 12, background: '#F5851B', color: '#161109', border: 0, borderRadius: 9, padding: '9px 0', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
  note: { fontSize: 10.5, color: '#8a98a6', marginTop: 10, lineHeight: 1.4 },
};
