import { formatKm } from '../../lib/geo.js';
import { formatClock, relativeTime } from '../../lib/time.js';

export default function QuakeHero({ quake }) {
  if (!quake) {
    return (
      <div className="quake-card"><div className="qc-top"><div className="qc-meta">
        <div className="qc-place">No recent quakes</div>
        <div className="qc-sub">No events ≥ M2.5 in the last 7 days.</div>
      </div></div></div>
    );
  }
  const pct = Math.min(100, Math.max(0, ((quake.mag - 3) / 5) * 100));
  return (
    <div className="quake-card">
      <div className="qc-top">
        <div className="mag-block">
          <div className="mag-num">{quake.mag.toFixed(1)}</div>
          <div className="mag-scale">Mw</div>
          <div className="mag-bar"><i style={{ left: `${pct}%` }} /></div>
        </div>
        <div className="qc-meta">
          <div className="qc-place">{quake.place}</div>
          <div className="qc-sub">Source: USGS</div>
        </div>
      </div>
      <div className="qc-grid">
        <div className="qc-cell"><div className="k">Time</div>
          <div className="v">{formatClock(quake.time)}<span style={{ color: 'var(--ink-faint)' }}> · {relativeTime(quake.time)}</span></div></div>
        <div className="qc-cell"><div className="k">Depth</div>
          <div className="v">{quake.depthKm != null ? `${Math.round(quake.depthKm)} km` : '—'}</div></div>
        <div className="qc-cell"><div className="k">From you</div>
          <div className="v warn">≈ {formatKm(quake.distanceKm)}</div></div>
      </div>
    </div>
  );
}
