import { useEffect, useState, useCallback } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase.js';
import { fetchRecentReports, insertReport } from './reportsApi.js';
import { reportQueue } from './reportQueue.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

const enrich = (rows, user) =>
  rows.map((r) => ({ ...r, distanceKm: haversineKm(user, [r.lat, r.lng]) }));

// { reports, pendingCount, status, submit, flag, refresh }
export function useReports(user = REGION.defaultUser) {
  const [reports, setReports] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState(supabaseConfigured ? 'loading' : 'disabled');

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) return;
    try {
      const rows = await fetchRecentReports(supabase);
      setReports(enrich(rows, user));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [user[0], user[1]]);

  const syncQueue = useCallback(async () => {
    if (!supabaseConfigured) return;
    await reportQueue.flush((r) => insertReport(supabase, r));
    setPendingCount((await reportQueue.list()).length);
  }, []);

  useEffect(() => {
    refresh();
    syncQueue();
    reportQueue.list().then((q) => setPendingCount(q.length));
    if (!supabaseConfigured) return;
    const onLine = () => syncQueue().then(refresh);
    window.addEventListener('online', onLine);
    const channel = supabase
      .channel('reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => refresh())
      .subscribe();
    return () => {
      window.removeEventListener('online', onLine);
      supabase.removeChannel(channel);
    };
  }, [refresh, syncQueue]);

  const submit = useCallback(async (report) => {
    try {
      const saved = await insertReport(supabase, report);
      setReports((prev) => enrich([saved, ...prev.filter((r) => r.id !== saved.id)], user));
      return { ok: true, queued: false };
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('rate_limited')) return { ok: false, rateLimited: true };
      await reportQueue.enqueue(report);
      setPendingCount((await reportQueue.list()).length);
      return { ok: true, queued: true };
    }
  }, [user[0], user[1]]);

  const flag = useCallback(async (id) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, flagCount: r.flagCount + 1 } : r)));
    const [{ flagReport }, { getDeviceId }] = await Promise.all([
      import('./reportsApi.js'),
      import('../../lib/device.js'),
    ]);
    try { await flagReport(supabase, id, getDeviceId()); } finally { refresh(); }
  }, [refresh]);

  return { reports, pendingCount, status, submit, flag, refresh };
}
