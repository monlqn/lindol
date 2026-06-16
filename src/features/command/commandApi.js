import { supabase } from '../../lib/supabase.js';

// --- Auth (reuses the existing Supabase auth the admin page already uses) ---
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() { await supabase.auth.signOut(); }
export async function getSession() { return (await supabase.auth.getSession()).data.session; }
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(s));
  return () => data?.subscription?.unsubscribe?.();
}

// The signed-in user's command-center access row ({ role, org }) or null if not authorized. RLS on
// command_access returns only the caller's own row (see supabase/command-access-schema.sql).
export async function getCommandAccess() {
  const { data, error } = await supabase.from('command_access').select('role, org').maybeSingle();
  if (error) return null;
  return data ?? null;
}

// --- Data Bank: stats over the durable quake_history archive (RLS public-read) ---
const SOURCES = ['phivolcs', 'usgs', 'emsc'];

export async function dataBankStats() {
  const head = (q) => q.select('*', { count: 'exact', head: true });
  const [totalRes, ...srcRes] = await Promise.all([
    head(supabase.from('quake_history')),
    ...SOURCES.map((s) => head(supabase.from('quake_history')).eq('source', s)),
  ]);
  const [minRes, maxRes] = await Promise.all([
    supabase.from('quake_history').select('time').order('time', { ascending: true }).limit(1),
    supabase.from('quake_history').select('time').order('time', { ascending: false }).limit(1),
  ]);
  const bySource = {};
  SOURCES.forEach((s, i) => { bySource[s] = srcRes[i].count ?? 0; });
  return {
    total: totalRes.count ?? 0,
    bySource,
    earliest: minRes.data?.[0]?.time ?? null,
    latest: maxRes.data?.[0]?.time ?? null,
  };
}

// Download the recent archive as CSV (capped). Proof-of-service for the data-banking pitch.
export async function exportArchiveCsv(limit = 5000) {
  const { data, error } = await supabase.from('quake_history')
    .select('id, source, mag, place, time, lat, lng, depth_km')
    .order('time', { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'id,source,mag,place,time_iso,lat,lng,depth_km';
  const body = rows.map((r) => [r.id, r.source, r.mag, esc(r.place), new Date(r.time).toISOString(), r.lat, r.lng, r.depth_km ?? ''].join(','));
  const csv = [header, ...body].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `lindol-databank-${rows.length}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length;
}
