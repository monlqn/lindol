import { useEffect, useState } from 'react';
import { sameQuake } from './quakeMerge.js';

// Recent events that have a measured intensity, from PHIVOLCS (local authority, preferred) +
// USGS (mmi/cdi). Refreshed every 5 min. PHIVOLCS events are listed first so they win on a match.
export function useShakemaps() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [ph, us] = await Promise.all([
        fetch('/api/phivolcs-intensity').then((r) => r.json()).catch(() => ({ events: [] })),
        fetch('/api/shakemaps').then((r) => r.json()).catch(() => ({ events: [] })),
      ]);
      if (!cancelled) setEvents([...(ph.events || []), ...(us.events || [])]);
    };
    load();
    const id = setInterval(load, 300000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return events;
}

// Max intensity (MMI) for a feed quake, matched by time + location, or null if none has one.
export function mmiForQuake(quake, events) {
  if (!quake || !events || !events.length) return null;
  const m = events.find((e) => sameQuake(quake, e));
  return m ? m.mmi : null;
}
