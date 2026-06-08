import { useEffect, useRef, useState } from 'react';
import { detectNewAlerts } from './detectNewQuakes.js';
import { playAlarm } from '../../lib/alarm.js';
import { REGION } from '../../config.js';

export function useQuakeAlerts(quakes, soundOn) {
  const seen = useRef(new Set());
  const since = useRef(Date.now() - 5 * 60000);
  const [alert, setAlert] = useState(null);
  useEffect(() => {
    if (!quakes || quakes.length === 0) return;
    const fresh = detectNewAlerts(quakes, seen.current, REGION.alertMinMag, since.current);
    if (fresh.length) {
      const newest = fresh.reduce((a, b) => (b.time > a.time ? b : a));
      setAlert(newest);
      if (soundOn) playAlarm(3);
    }
  }, [quakes, soundOn]);
  return { alert, dismiss: () => setAlert(null) };
}
