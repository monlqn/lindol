const KEY = 'lindol:device-id';

// A stable anonymous id per device, used for client-side rate limiting/dedup.
export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}
