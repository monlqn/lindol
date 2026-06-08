import { formatClock } from '../lib/time.js';

export default function OfflineBanner({ updatedAt }) {
  return (
    <div className="offline-banner">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M1 1l22 22M16.7 11.3A6 6 0 0 0 8 9M5 12.5A10 10 0 0 1 8 11M12 20h.01" />
      </svg>
      <span>Offline — showing data as of <b>{updatedAt ? formatClock(updatedAt) : '—'}</b>.</span>
    </div>
  );
}
