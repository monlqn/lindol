import { useEffect, useState } from 'react';

// Fetch the latest significant event's ShakeMap (event + MMI contours), once. CDN-cached server-side.
export function useShakemap() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/shakemap')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return data; // { event, contours } | null
}
