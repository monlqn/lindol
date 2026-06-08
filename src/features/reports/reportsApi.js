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
  };
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

export async function flagReport(client, rid) {
  const { error } = await client.rpc('flag_report', { rid });
  if (error) throw error;
}
