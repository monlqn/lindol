import { formatClock, relativeTime } from '../lib/time.js';

export default function StatusBar({ online, updatedAt }) {
  const label = online ? 'LIVE' : 'OFFLINE';
  const stamp = updatedAt
    ? `UPDATED ${formatClock(updatedAt)} · ${relativeTime(updatedAt)}`
    : 'UPDATING…';
  return (
    <div className="statusbar">
      <span className="live-pill"><span className="live-dot" /><span className="ls">{label}</span></span>
      <span>{stamp}</span>
      <span style={{ opacity: 0.5 }}>v0.1</span>
    </div>
  );
}
