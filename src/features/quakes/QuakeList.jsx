import { useState } from 'react';
import { formatKm } from '../../lib/geo.js';
import { relativeTime, formatClock } from '../../lib/time.js';

function magColor(m) {
  return m >= 6 ? '#CC2A2A' : m >= 5 ? '#E0521B' : m >= 4 ? '#C08A1E' : '#9A5B16';
}

// A scrollable list of recent earthquakes (newest first), capped until expanded.
export default function QuakeList({ quakes, limit = 12, onLocate }) {
  const [expanded, setExpanded] = useState(false);
  if (!quakes || quakes.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No recent quakes in the area.</p>;
  }
  const sorted = [...quakes].sort((a, b) => b.time - a.time);
  const rows = expanded ? sorted : sorted.slice(0, limit);
  return (
    <div className="qlist">
      {rows.map((q) => (
        <button className="qrow" key={q.id} onClick={() => onLocate?.(q)} title="Show on map">
          <span className="qmag" style={{ background: magColor(q.mag) }}>{q.mag.toFixed(1)}</span>
          <div className="qrow-main">
            <div className="qrow-place">{q.place}</div>
            <div className="qrow-sub">
              {formatClock(q.time)} · {relativeTime(q.time)}
              {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)}` : ''}
            </div>
          </div>
          <svg className="qrow-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
          </svg>
        </button>
      ))}
      {sorted.length > limit && (
        <button className="qlist-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
