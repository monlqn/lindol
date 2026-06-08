import { supabase } from '../../lib/supabase.js';

// Upsert a device push subscription into Supabase.
export async function savePushSubscription(subJson) {
  const { endpoint, keys } = subJson;
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' });
  if (error) throw error;
}
