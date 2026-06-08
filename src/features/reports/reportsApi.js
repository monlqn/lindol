import { compressImage } from '../../lib/image.js';

export function normalizeRow(r) {
  return {
    id: r.id,
    createdAt: Date.parse(r.created_at),
    category: r.category,
    note: r.note ?? '',
    lat: r.lat,
    lng: r.lng,
    photoUrl: r.photo_url ?? null,
    status: r.status,
    flagCount: r.flag_count ?? 0,
    sensitive: r.sensitive ?? false,
    state: r.state ?? 'open',
    confirmCount: r.confirm_count ?? 0,
    resolveCount: r.resolve_count ?? 0,
    escalated: r.escalated ?? false,
  };
}

export async function voteReportResolve(client, rid, deviceId) {
  const { error } = await client.rpc('vote_resolve', { rid, dev: deviceId });
  if (error) throw error;
}

export async function escalateReport(client, rid) {
  const { error } = await client.rpc('escalate_report', { rid });
  if (error) throw error;
}

export async function confirmReport(client, rid, deviceId) {
  const { error } = await client.rpc('confirm_report', { rid, dev: deviceId });
  if (error) throw error;
}

export async function setReportResolved(client, rid, deviceId, resolved) {
  const { error } = await client.rpc('set_report_resolved', { rid, dev: deviceId, resolved });
  if (error) throw error;
}

export async function fetchRecentReports(client, { sinceHours = 48, limit = 200 } = {}) {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data, error } = await client
    .from('reports')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).slice(0, limit).map(normalizeRow);
}

export async function fetchReportById(client, id) {
  const { data, error } = await client.from('reports').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalizeRow(data) : null;
}

export async function uploadPhoto(client, blob, id) {
  const path = `${id}.jpg`;
  const { error } = await client.storage.from('report-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return client.storage.from('report-photos').getPublicUrl(path).data.publicUrl;
}

export async function insertReport(client, { id, category, note, lat, lng, photoFile, deviceId }) {
  let photo_url = null;
  if (photoFile) {
    const blob = await compressImage(photoFile);
    photo_url = await uploadPhoto(client, blob, id);
  }
  const { data, error } = await client
    .from('reports')
    .insert({ id, category, note, lat, lng, photo_url, device_id: deviceId ?? null })
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data);
}

export async function flagReport(client, rid, deviceId, reason) {
  // One device = one flag (server-enforced dedup); reason is stored when the 3-arg
  // RPC is deployed. If it isn't yet, fall back to the 2-arg deduped form.
  let { error } = await client.rpc('flag_report', { rid, dev: deviceId, reason: reason ?? null });
  if (error && (error.code === 'PGRST202' || /find the function|does not exist/i.test(error.message || ''))) {
    ({ error } = await client.rpc('flag_report', { rid, dev: deviceId }));
  }
  if (error) throw error;
}
