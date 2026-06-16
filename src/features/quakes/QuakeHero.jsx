import { useState } from 'react';
import { formatKm } from '../../lib/geo.js';
import { formatClock, relativeTime } from '../../lib/time.js';
import { shareQuake } from '../../lib/quakeShare.js';
import { mmiForQuake } from './useShakemaps.js';
import { mmiRoman, mmiLabel, mmiColor } from '../../lib/intensity.js';
import { REGION } from '../../config.js';

export default function QuakeHero({ quake, shakemaps = [] }) {
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    setSharing(true);
    await shareQuake(quake, mmiForQuake(quake, shakemaps));
    setSharing(false);
  };

  if (!quake) {
    return (
      <div className="quake-card"><div className="qc-top"><div className="qc-meta">
        <div className="qc-place">No recent quakes</div>
        <div className="qc-sub">No recent quakes in the last {REGION.windowDays} days.</div>
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
          <div className="qc-sub">Source: {(quake.sources && quake.sources.length ? quake.sources : [quake.source === 'phivolcs' ? 'PHIVOLCS' : quake.source === 'emsc' ? 'EMSC' : 'USGS']).join(' · ')}</div>
          {(() => { const mmi = mmiForQuake(quake, shakemaps); return mmi != null && mmi >= 2
            ? <span className="qc-mmi" style={{ background: mmiColor(mmi) }}>Intensity {mmiRoman(mmi)} · {mmiLabel(mmi)}</span> : null; })()}
        </div>
      </div>
      <div className="qc-grid">
        <div className="qc-cell"><div className="k">Time</div>
          <div className="v">{formatClock(quake.time)}<span style={{ color: 'var(--ink-faint)' }}> · {relativeTime(quake.time)}</span></div></div>
        <div className="qc-cell"><div className="k">Depth</div>
          <div className="v">{quake.depthKm != null ? `${Math.round(quake.depthKm)} km` : '-'}</div></div>
        <div className="qc-cell"><div className="k">From you</div>
          <div className="v warn">≈ {formatKm(quake.distanceKm)}</div></div>
      </div>
      <button className="qc-share" onClick={share} disabled={sharing}>
        {sharing ? 'Preparing image…' : '📤 Share this quake'}
      </button>
    </div>
  );
}
