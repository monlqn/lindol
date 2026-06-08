const KEY = 'lindol:report-times';
const MAX = 6;             // max reports
const WINDOW = 5 * 60000;  // per 5 minutes

function load(now) {
  let times = [];
  try { times = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { times = []; }
  return times.filter((t) => now - t < WINDOW);
}

// { ok: true } or { ok: false, waitMin }
export function checkReportRate(now = Date.now()) {
  const times = load(now);
  if (times.length >= MAX) {
    return { ok: false, waitMin: Math.max(1, Math.ceil((WINDOW - (now - times[0])) / 60000)) };
  }
  return { ok: true };
}

// Record a submission attempt.
export function recordReport(now = Date.now()) {
  const times = load(now);
  times.push(now);
  try { localStorage.setItem(KEY, JSON.stringify(times)); } catch { /* ignore */ }
}
