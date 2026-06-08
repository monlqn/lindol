import { formatKm } from '../lib/geo.js';
import { relativeTime, formatClock } from '../lib/time.js';

export default function AlertBanner({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div className="alert-banner" role="alert">
      <div className="ab-mag">{alert.mag.toFixed(1)}</div>
      <div className="ab-body">
        <div className="ab-title">M{alert.mag.toFixed(1)} earthquake near you</div>
        <div className="ab-sub">{alert.place} · {formatClock(alert.time)} ({relativeTime(alert.time)})
          {alert.distanceKm != null ? ` · ≈ ${formatKm(alert.distanceKm)} from you` : ''}</div>
        <div className="ab-note">Reported by USGS — this is not an early warning. If shaking starts: Drop, Cover, Hold On.</div>
      </div>
      <button className="ab-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
