import { useState, useEffect } from 'react';

// Forces a re-render every `ms` so relative timestamps ("2m ago") stay current
// even when no new data arrives.
export function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
