import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase.js';
import { fetchRecentReports, insertReport } from './reportsApi.js';
import { reportQueue } from './reportQueue.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

const enrich = (rows, user) =>
  rows.map((r) => ({ ...r, distanceKm: haversineKm(user, [r.lat, r.lng]) }));

// { reports, pendingCount, status, submit, flag, refresh }
export function useReports(user = REGION.defaultUser, onLiveReport) {
  const [reports, setReports] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState(supabaseConfigured ? 'loading' : 'disabled');
  const onLiveRef = useRef(onLiveReport);
  onLiveRef.current = onLiveReport;

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
        refresh();
        if (payload.eventType === 'INSERT' && payload.new?.id) {
          let mine = false;
          try { mine = JSON.parse(localStorage.getItem('lindol:mine') || '[]').includes(payload.new.id); } catch { /* ignore */ }
          if (!mine) onLiveRef.current?.(payload.new);
        }
      })
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

  const flag = useCallback(async (id, reason) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, flagCount: r.flagCount + 1 } : r)));
    const [{ flagReport }, { getDeviceId }] = await Promise.all([
      import('./reportsApi.js'),
      import('../../lib/device.js'),
    ]);
    try { await flagReport(supabase, id, getDeviceId(), reason); } finally { refresh(); }
  }, [refresh]);

  const confirm = useCallback(async (id) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, confirmCount: r.confirmCount + 1 } : r)));
    const [{ confirmReport }, { getDeviceId }] = await Promise.all([
      import('./reportsApi.js'),
      import('../../lib/device.js'),
    ]);
    try { await confirmReport(supabase, id, getDeviceId()); } finally { refresh(); }
  }, [refresh]);

  const resolve = useCallback(async (id, resolved) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, state: resolved ? 'resolved' : 'open' } : r)));
    const [{ setReportResolved }, { getDeviceId }] = await Promise.all([
      import('./reportsApi.js'),
      import('../../lib/device.js'),
    ]);
    try { await setReportResolved(supabase, id, getDeviceId(), resolved); } finally { refresh(); }
  }, [refresh]);

  const escalate = useCallback(async (id) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, escalated: true } : r)));
    const { escalateReport } = await import('./reportsApi.js');
    try { await escalateReport(supabase, id); } finally { refresh(); }
  }, [refresh]);

  const voteResolve = useCallback(async (id) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, resolveCount: r.resolveCount + 1 } : r)));
    const [{ voteReportResolve }, { getDeviceId }] = await Promise.all([
      import('./reportsApi.js'),
      import('../../lib/device.js'),
    ]);
    try { await voteReportResolve(supabase, id, getDeviceId()); } finally { refresh(); }
  }, [refresh]);

  return { reports, pendingCount, status, submit, flag, confirm, resolve, escalate, voteResolve, refresh };
}
