import { useEffect, useRef, useState } from 'react';
import { detectNewAlerts } from './detectNewQuakes.js';
import { startAlarm, stopAlarm } from '../../lib/alarm.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

// Alert only if you'd plausibly feel it: the "felt" radius grows with magnitude, so a far-away
// small quake doesn't alarm, while a large one still reaches you. (Answers "why alarm if I'm
// far from the epicentre?" - we don't, unless it's big enough to be felt at that distance.)
export function feltRadiusKm(mag) {
  if (mag >= 7) return 600;
  if (mag >= 6) return 350;
  if (mag >= 5) return 180;
  return 90; // M4.5 - 5
}

export function useQuakeAlerts(quakes, soundOn, user = REGION.defaultUser) {
  const seen = useRef(new Set());
  // Recency window: a quake older than this won't alarm on open. Generous enough that opening
  // the app a few minutes after feeling a quake (once the source has published it) still alerts.
  const since = useRef(Date.now() - 10 * 60000);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!quakes || quakes.length === 0) return;
    const near = quakes.filter((q) => {
      const d = q.distanceKm ?? haversineKm(user, [q.lat, q.lng]);
      return d <= feltRadiusKm(q.mag);
    });
    const fresh = detectNewAlerts(near, seen.current, REGION.alertMinMag, since.current);
    if (fresh.length) {
      const newest = fresh.reduce((a, b) => (b.time > a.time ? b : a));
      setAlert(newest);
      if (soundOn) startAlarm();   // loops until dismissed
    }
  }, [quakes, soundOn, user[0], user[1]]);

  return { alert, dismiss: () => { stopAlarm(); setAlert(null); } };
}
