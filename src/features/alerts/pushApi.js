import { supabase } from '../../lib/supabase.js';

// Save a device push subscription with its location (so alerts can be scoped to
// quakes near this device). A plain insert keeps subscription keys private.
export async function savePushSubscription(subJson, coords) {
  const { endpoint, keys } = subJson;
  const row = { endpoint, p256dh: keys.p256dh, auth: keys.auth };
  const hasLoc = Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
  if (hasLoc) { row.lat = coords[0]; row.lng = coords[1]; }

  let { error } = await supabase.from('push_subscriptions').insert(row);

  // lat/lng columns not added yet — retry without them so subscribing still works.
  if (error && (error.code === 'PGRST204' || error.code === '42703')) {
    ({ error } = await supabase.from('push_subscriptions')
      .insert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }));
  }
  // Already subscribed — refresh the stored location if we have one.
  if (error && error.code === '23505') {
    if (hasLoc) await supabase.from('push_subscriptions')
      .update({ lat: coords[0], lng: coords[1] }).eq('endpoint', endpoint);
    return;
  }
  if (error) throw error;
}
