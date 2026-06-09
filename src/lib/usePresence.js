import { useState, useEffect } from 'react';
import { supabase, supabaseConfigured } from './supabase.js';

// Live count of people currently viewing LINDOL, via Supabase Realtime Presence.
// Ephemeral (no database); each open tab is one presence entry.
export function useViewerCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    const key = `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const channel = supabase.channel('viewers', { config: { presence: { key } } });
    const update = () => setCount(Object.keys(channel.presenceState()).length);
    channel
      .on('presence', { event: 'sync' }, update)
      .on('presence', { event: 'join' }, update)
      .on('presence', { event: 'leave' }, update)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ at: Date.now() });
      });
    return () => { supabase.removeChannel(channel); };
  }, []);
  return count;
}
