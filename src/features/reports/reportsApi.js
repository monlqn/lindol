import { compressImage } from '../../lib/image.js';

// Explicit column list (never device_id) so the anonymous API can't expose it.
const COLS = 'id,created_at,category,note,lat,lng,photo_url,status,flag_count,sensitive,state,confirm_count,resolve_count,escalated';

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
    .select(COLS)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).slice(0, limit).map(normalizeRow);
}

export async function fetchReportById(client, id) {
  const { data, error } = await client.from('reports').select(COLS).eq('id', id).maybeSingle();
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
    .select(COLS)
    .single();
  if (error) throw error;
  return normalizeRow(data);
}

function normalizeComment(c) {
  return { id: c.id, nickname: c.nickname || 'Neighbour', body: c.body, createdAt: Date.parse(c.created_at) };
}

export async function fetchComments(client, reportId) {
  const { data, error } = await client.from('report_comments')
    .select('id,nickname,body,flag_count,created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((c) => (c.flag_count ?? 0) < 3).map(normalizeComment);
}

export async function addComment(client, reportId, deviceId, body, nickname) {
  const { data, error } = await client.rpc('add_report_comment', {
    p_report_id: reportId, p_device_id: deviceId, p_body: body, p_nickname: nickname || null,
  });
  if (error) throw error;
  const c = Array.isArray(data) ? data[0] : data;
  return c ? normalizeComment(c) : null;
}

export async function flagComment(client, commentId, deviceId) {
  // One device = one flag, enforced server-side (comment_flags dedup).
  const { error } = await client.rpc('flag_comment', { p_comment_id: commentId, p_device_id: deviceId });
  if (error) throw error;
}

// Original poster attaches/updates a photo on their own report (device-gated server-side).
export async function addReportPhoto(client, reportId, deviceId, photoFile) {
  const blob = await compressImage(photoFile);
  const url = await uploadPhoto(client, blob, reportId);
  const { error } = await client.rpc('update_report_photo', {
    p_report_id: reportId, p_device_id: deviceId, p_photo_url: url,
  });
  if (error) throw error;
  return url;
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
