const PREFIX = 'lindol:';

// Store a value with the time it was saved, so the UI can show "data as of …".
export function cacheSet(key, value, savedAt = Date.now()) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt }));
  } catch {
    /* quota / private mode - ignore, cache is best-effort */
  }
}

// Returns { value, savedAt } or null if missing/corrupt.
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}
