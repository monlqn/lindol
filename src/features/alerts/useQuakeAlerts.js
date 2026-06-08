import { useEffect, useRef, useState } from 'react';
import { detectNewAlerts } from './detectNewQuakes.js';
import { startAlarm, stopAlarm } from '../../lib/alarm.js';
import { haversineKm } from '../../lib/geo.js';
import { REGION } from '../../config.js';

export function useQuakeAlerts(quakes, soundOn, user = REGION.defaultUser) {
  const seen = useRef(new Set());
  const since = useRef(Date.now() - 5 * 60000);
  const [alert, setAlert] = useState(null);
  useEffect(() => {
    if (!quakes || quakes.length === 0) return;
    // Only alert for quakes near the user.
    const near = quakes.filter((q) => {
      const d = q.distanceKm ?? haversineKm(user, [q.lat, q.lng]);
      return d <= REGION.alertRadiusKm;
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
