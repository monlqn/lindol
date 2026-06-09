import { formatClock, relativeTime } from '../lib/time.js';

export default function StatusBar({ online, updatedAt, viewers = 0 }) {
  const label = online ? 'LIVE' : 'OFFLINE';
  const stamp = updatedAt
    ? `UPDATED ${formatClock(updatedAt)} · ${relativeTime(updatedAt)}`
    : 'UPDATING…';
  return (
    <div className="statusbar">
      <span className="live-pill"><span className="live-dot" /><span className="ls">{label}</span>
        {online && viewers >= 2 && <span className="viewers" title="People viewing now">· 👁 {viewers}</span>}
      </span>
      <span>{stamp}</span>
      <span style={{ opacity: 0.5 }}>v0.3·{typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'}</span>
    </div>
  );
}
