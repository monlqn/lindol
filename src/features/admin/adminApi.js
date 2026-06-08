import { supabase } from '../../lib/supabase.js';
import { normalizeRow } from '../reports/reportsApi.js';

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() { await supabase.auth.signOut(); }
export async function getSession() {
  return (await supabase.auth.getSession()).data.session;
}
export async function fetchModerationQueue() {
  const { data, error } = await supabase.from('reports').select('*')
    .or('status.eq.hidden,flag_count.gt.0').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeRow);
}
// Returns { [reportId]: { reasonKey: count, ... } } for the given report ids.
export async function fetchFlagReasons(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('report_flags').select('report_id, reason').in('report_id', ids);
  if (error) throw error;
  const out = {};
  for (const row of data ?? []) {
    const m = (out[row.report_id] ||= {});
    const k = row.reason || 'unspecified';
    m[k] = (m[k] || 0) + 1;
  }
  return out;
}
export async function hideReport(id) {
  const { error } = await supabase.from('reports').update({ status: 'hidden' }).eq('id', id);
  if (error) throw error;
}
export async function restoreReport(id) {
  const { error } = await supabase.from('reports').update({ status: 'visible', flag_count: 0 }).eq('id', id);
  if (error) throw error;
}
export async function deleteReport(id) {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
}
