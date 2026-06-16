import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuakes } from '../quakes/useQuakes.js';
import { supabase } from '../../lib/supabase.js';
import { fetchRecentReports } from '../reports/reportsApi.js';
import { CATEGORIES, categoryColor, categoryIcon } from '../reports/reportSchema.js';
import { relativeTime, formatClock } from '../../lib/time.js';
import { dataBankStats, exportArchiveCsv } from './commandApi.js';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

function magColor(m) {
  return m >= 6 ? '#D81E34' : m >= 5 ? '#F0461E' : m >= 4 ? '#F5851B'
    : m >= 3 ? '#F2B01E' : m >= 2 ? '#E4C84A' : '#C9C3A0';
}
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtNum = (n) => (n ?? 0).toLocaleString('en-PH');
const fmtKm = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const fmtMin = (s) => (s < 60 ? '<1 min' : `${Math.round(s / 60)} min`);

// Mapbox Directions (driving). Its own generous free tier - only command-tier users hit it.
async function fetchRoute(origin, dest) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${dest[0]},${dest[1]}`
    + `?geometries=geojson&overview=full&access_token=${TOKEN}`;
  const j = await (await fetch(url)).json();
  const r = j.routes?.[0];
  return r ? { geometry: r.geometry, distance: r.distance, duration: r.duration } : null;
}

export default function CommandCenter({ access, email, onSignOut }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const originRef = useRef(null); // { lng, lat }
  const destRef = useRef(null);   // the report being routed to
  const routeRef = useRef(() => {});
  const { all } = useQuakes();
  const allRef = useRef(all);
  allRef.current = all;
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [route, setRoute] = useState(null); // { loading } | { distance, duration, label, color } | { error, label }

  useEffect(() => { dataBankStats().then(setStats).catch(() => {}); }, []);
  useEffect(() => { fetchRecentReports(supabase, { sinceHours: 720, limit: 500 }).then(setReports).catch(() => {}); }, []);

  // route to a report from the current responder origin
  const routeTo = async (r) => {
    const map = mapRef.current; const o = originRef.current;
    if (!map || !o) return;
    destRef.current = r;
    setRoute({ loading: true, label: CAT_LABEL[r.category], color: categoryColor(r.category) });
    try {
      const res = await fetchRoute([o.lng, o.lat], [r.lng, r.lat]);
      if (!res) { setRoute({ error: true, label: CAT_LABEL[r.category] }); return; }
      map.getSource('route')?.setData({ type: 'Feature', geometry: res.geometry, properties: {} });
      // frame the whole route between the side panels
      const cs = res.geometry.coordinates;
      const b = cs.reduce((bb, c) => bb.extend(c), new mapboxgl.LngLatBounds(cs[0], cs[0]));
      map.fitBounds(b, { padding: { top: 90, bottom: 70, left: 270, right: 250 }, duration: 900, maxZoom: 13 });
      setRoute({ distance: res.distance, duration: res.duration, label: CAT_LABEL[r.category], color: categoryColor(r.category) });
    } catch { setRoute({ error: true, label: CAT_LABEL[r.category] }); }
  };
  routeRef.current = routeTo;

  const clearRoute = () => {
    destRef.current = null;
    setRoute(null);
    mapRef.current?.getSource('route')?.setData(emptyFC());
  };

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

      map.addSource('quakes', { type: 'geojson', data: emptyFC() });
      map.addLayer({ id: 'q-glow', type: 'circle', source: 'quakes', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2, 6, 5, 24, 7.8, 48], 'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-opacity': 0.3 } });
      map.addLayer({ id: 'q', type: 'circle', source: 'quakes', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 1, 2.5, 4, 7, 6, 13, 7.8, 24], 'circle-color': ['get', 'color'], 'circle-opacity': 0.92, 'circle-stroke-width': 0.6, 'circle-stroke-color': 'rgba(20,14,10,0.5)' } });
      map.getSource('quakes').setData(quakeFC(allRef.current));

      // responder route (drawn above the dots)
      map.addSource('route', { type: 'geojson', data: emptyFC() });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#fff', 'line-width': 7, 'line-opacity': 0.55 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#1FB6C9', 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

      map.on('click', 'q', (e) => {
        const f = e.features[0]; const p = f.properties;
        new mapboxgl.Popup({ offset: 12 }).setLngLat(f.geometry.coordinates)
          .setHTML(`<div style="font:600 12px var(--font)"><span style="font-size:15px;color:${p.color}">M${Number(p.mag).toFixed(1)}</span> ${p.place || ''}<br><span style="color:#888;font-weight:400">${formatClock(p.time)} · ${relativeTime(p.time)}${p.depthKm ? ` · ${Math.round(p.depthKm)} km deep` : ''}</span></div>`).addTo(map);
      });
      map.on('mouseenter', 'q', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'q', () => { map.getCanvas().style.cursor = ''; });

      // draggable responder origin (defaults to map center, then the operator's GPS if allowed)
      const oel = document.createElement('div');
      oel.title = 'Responder origin · drag to set';
      oel.style.cssText = 'width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:15px;background:#1FB6C9;border:3px solid #fff;box-shadow:0 2px 9px rgba(0,0,0,.5);cursor:grab';
      oel.textContent = '🚓';
      const KORONADAL = [124.8467, 6.5031]; // PDRRMO South Cotabato seat - a sensible on-land default
      const om = new mapboxgl.Marker({ element: oel, draggable: true }).setLngLat(KORONADAL).addTo(map);
      originRef.current = { lng: KORONADAL[0], lat: KORONADAL[1] };
      om.on('dragend', () => { originRef.current = om.getLngLat(); if (destRef.current) routeRef.current(destRef.current); });
      navigator.geolocation?.getCurrentPosition((pos) => {
        const ll = [pos.coords.longitude, pos.coords.latitude];
        om.setLngLat(ll); originRef.current = { lng: ll[0], lat: ll[1] };
        if (destRef.current) routeRef.current(destRef.current);
      }, () => {}, { timeout: 8000 });
      markersRef.current.push(om);
    });

    return () => { markersRef.current.forEach((m) => m.remove()); markersRef.current = []; map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && map.getSource && map.getSource('quakes')) map.getSource('quakes').setData(quakeFC(all));
  }, [all]);

  // citizen reports as category markers; click routes a responder to them
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const created = reports
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .map((r) => {
        const el = document.createElement('div');
        el.style.cssText = `width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:14px;background:#fff;border:2px solid ${categoryColor(r.category)};box-shadow:0 2px 7px rgba(0,0,0,.45);cursor:pointer`;
        el.textContent = categoryIcon(r.category);
        el.addEventListener('click', () => routeRef.current(r));
        const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(
          `<div style="font:600 12px var(--font);min-width:140px"><span style="color:${categoryColor(r.category)}">${categoryIcon(r.category)} ${CAT_LABEL[r.category] || 'Report'}</span>${r.note ? `<div style="font-weight:400;margin:3px 0">${escapeHtml(r.note)}</div>` : ''}<span style="color:#888;font-weight:400">${relativeTime(r.createdAt)}${r.state === 'resolved' ? ' · ✅ resolved' : ''}</span><div style="color:#1FB6C9;margin-top:4px">🚓 click marker to route a responder</div></div>`,
        );
        return new mapboxgl.Marker({ element: el }).setLngLat([r.lng, r.lat]).setPopup(popup).addTo(map);
      });
    markersRef.current.push(...created);
    return () => { created.forEach((m) => m.remove()); markersRef.current = markersRef.current.filter((m) => !created.includes(m)); };
  }, [reports]);

  const doExport = async () => { setExporting(true); try { await exportArchiveCsv(); } catch { /* ignore */ } setExporting(false); };
  const openReports = reports.filter((r) => r.state !== 'resolved').length;

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
          <span style={S.live}><span style={S.dot} /> {fmtNum(all?.length)} quakes</span>
          <span style={S.live}><span style={{ ...S.dot, background: '#e0521b' }} /> {fmtNum(openReports)} open reports</span>
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
            <button style={S.export} onClick={doExport} disabled={exporting}>{exporting ? 'Preparing…' : '⤓ Export CSV'}</button>
            <div style={S.note}>+ {fmtNum(reports.length)} citizen reports on the map (last 30 days). Continuously preserved in cloud storage.</div>
          </>
        )}
      </section>

      {route && (
        <section style={S.dispatch}>
          <div style={S.dispatchHead}><span>🚓 Dispatch</span><button style={S.clear} onClick={clearRoute}>✕</button></div>
          <div style={{ ...S.dispatchTo, color: route.color || '#fff' }}>→ {route.label} incident</div>
          {route.loading ? <div style={S.muted}>Finding route…</div>
            : route.error ? <div style={{ color: '#ff8d7a', fontSize: 12 }}>No road route found.</div>
              : <div style={S.eta}><span style={S.etaBig}>{fmtMin(route.duration)}</span><span style={S.etaKm}>· {fmtKm(route.distance)} by road</span></div>}
          <div style={S.note}>Routing from the 🚓 origin (drag it to a station to re-route).</div>
        </section>
      )}

      <div style={S.legend}>
        {CATEGORIES.map((c) => (
          <span key={c.key} style={S.legItem}><span style={{ ...S.legDot, borderColor: c.color }}>{c.icon}</span>{c.label}</span>
        ))}
      </div>
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

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function emptyFC() { return { type: 'FeatureCollection', features: [] }; }
function quakeFC(all) {
  return {
    type: 'FeatureCollection',
    features: (all || []).filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && Number.isFinite(q.mag))
      .map((q) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q.lng, q.lat] }, properties: { mag: q.mag, color: magColor(q.mag), place: q.place || '', time: q.time, depthKm: q.depthKm ?? 0 } })),
  };
}

const S = {
  wrap: { position: 'fixed', inset: 0, background: '#0b1622', color: '#fff', fontFamily: 'var(--font)' },
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
  bank: { position: 'absolute', top: 64, left: 16, zIndex: 5, width: 234, padding: '14px 16px', borderRadius: 14,
    background: 'rgba(16,22,32,.86)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 30px rgba(0,0,0,.35)' },
  bankTitle: { fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#bcd', textTransform: 'uppercase', marginBottom: 10 },
  bigNum: { fontSize: 34, fontWeight: 800, lineHeight: 1, color: '#F5851B' },
  muted: { fontSize: 11.5, color: '#9aa' },
  range: { fontSize: 11.5, color: '#cdd', margin: '8px 0 12px', fontFamily: 'var(--mono)' },
  srcRow: { display: 'flex', justifyContent: 'space-between', gap: 6, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,.1)', borderBottom: '1px solid rgba(255,255,255,.1)' },
  export: { width: '100%', marginTop: 12, background: '#F5851B', color: '#161109', border: 0, borderRadius: 9, padding: '9px 0', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
  note: { fontSize: 10.5, color: '#8a98a6', marginTop: 10, lineHeight: 1.4 },
  dispatch: { position: 'absolute', top: 64, right: 16, zIndex: 5, width: 220, padding: '13px 15px', borderRadius: 14,
    background: 'rgba(16,22,32,.88)', border: '1px solid rgba(31,182,201,.4)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 30px rgba(0,0,0,.4)' },
  dispatchHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#bcd', textTransform: 'uppercase' },
  clear: { background: 'none', border: 0, color: '#9aa', cursor: 'pointer', fontSize: 13, lineHeight: 1 },
  dispatchTo: { fontSize: 13, fontWeight: 700, margin: '8px 0 6px' },
  eta: { display: 'flex', alignItems: 'baseline', gap: 6 },
  etaBig: { fontSize: 26, fontWeight: 800, color: '#1FB6C9', lineHeight: 1 },
  etaKm: { fontSize: 12, color: '#cdd' },
  legend: { position: 'absolute', bottom: 14, left: 16, zIndex: 5, display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 360,
    background: 'rgba(16,22,32,.82)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '7px 11px', backdropFilter: 'blur(6px)' },
  legItem: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#cdd' },
  legDot: { width: 18, height: 18, borderRadius: '50%', background: '#fff', border: '2px solid #888', display: 'grid', placeItems: 'center', fontSize: 10 },
};
