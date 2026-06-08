import { useEffect, useState } from 'react';
import { REGION } from '../config.js';

// Resolves the visitor's real location once (browser shows a one-time permission
// prompt), falling back to the regional default if denied or unavailable. Used so
// "from you" distances and "near you" sorting reflect where the user actually is.
export function useGeolocation() {
  const [coords, setCoords] = useState(REGION.defaultUser);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords([p.coords.latitude, p.coords.longitude]),
      () => {}, // keep the regional default on denial/timeout
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);
  return coords;
}
