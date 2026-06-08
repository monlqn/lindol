import { supabase } from '../../lib/supabase.js';

// Save a device push subscription. A plain insert keeps subscription keys private
// (no SELECT policy needed); a duplicate endpoint (already subscribed) is harmless.
export async function savePushSubscription(subJson) {
  const { endpoint, keys } = subJson;
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
  if (error && error.code !== '23505') throw error; // 23505 = already subscribed
}
