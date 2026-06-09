import { useState } from 'react';
import { formatKm } from '../../lib/geo.js';
import { relativeTime, formatClock } from '../../lib/time.js';

function magColor(m) {
  return m >= 6 ? '#CC2A2A' : m >= 5 ? '#E0521B' : m >= 4 ? '#C08A1E' : '#9A5B16';
}

// A scrollable list of recent earthquakes (newest first), capped until expanded.
export default function QuakeList({ quakes, limit = 12 }) {
  const [expanded, setExpanded] = useState(false);
  if (!quakes || quakes.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No recent quakes in the area.</p>;
  }
  const sorted = [...quakes].sort((a, b) => b.time - a.time);
  const rows = expanded ? sorted : sorted.slice(0, limit);
  return (
    <div className="qlist">
      {rows.map((q) => (
        <div className="qrow" key={q.id}>
          <span className="qmag" style={{ background: magColor(q.mag) }}>{q.mag.toFixed(1)}</span>
          <div className="qrow-main">
            <div className="qrow-place">{q.place}</div>
            <div className="qrow-sub">
              {formatClock(q.time)} · {relativeTime(q.time)}
              {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)}` : ''}
            </div>
          </div>
        </div>
      ))}
      {sorted.length > limit && (
        <button className="qlist-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
