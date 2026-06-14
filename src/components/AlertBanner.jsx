import { formatKm } from '../lib/geo.js';
import { relativeTime, formatClock } from '../lib/time.js';

export default function AlertBanner({ alert, onDismiss }) {
  if (!alert) return null;
  const src = alert.source === 'phivolcs' ? 'PHIVOLCS' : alert.source === 'emsc' ? 'EMSC' : 'USGS';
  const mins = Math.max(0, Math.round((Date.now() - alert.time) / 60000));
  const ago = mins < 1 ? 'moments ago' : `~${mins} min ago`;
  return (
    <div className="alert-banner" role="alert">
      <div className="ab-mag">{alert.mag.toFixed(1)}</div>
      <div className="ab-body">
        <div className="ab-title">M{alert.mag.toFixed(1)} earthquake near you</div>
        <div className="ab-sub">{alert.place} · {formatClock(alert.time)}
          {alert.distanceKm != null ? ` · ≈ ${formatKm(alert.distanceKm)} from you` : ''}</div>
        <div className="ab-when">⏱ Detected {ago} via {src} — this <b>already happened</b> (after-the-fact alert, not a warning).</div>
        <div className="ab-note">If shaking starts now: Drop, Cover, Hold On.</div>
      </div>
      <button className="ab-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
