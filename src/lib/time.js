// Compact relative time: "now" | "N min ago" | "Nh ago" | "Nd ago".
export function relativeTime(epochMs, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - epochMs) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// 24-hour HH:MM clock, fixed to Philippine time so readouts are local.
export function formatClock(epochMs) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  }).format(new Date(epochMs));
}
