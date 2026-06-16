import { useState } from 'react';
import { formatKm } from '../../lib/geo.js';
import { relativeTime, formatClock } from '../../lib/time.js';
import { shareQuake } from '../../lib/quakeShare.js';
import { mmiForQuake } from './useShakemaps.js';
import { mmiRoman, mmiColor } from '../../lib/intensity.js';
import { isMicro } from './micro.js';

function magColor(m) {
  return m >= 6 ? '#CC2A2A' : m >= 5 ? '#E0521B' : m >= 4 ? '#C08A1E' : m >= 2 ? '#9A5B16' : '#BCAE86';
}

function sourceLabel(s) {
  return s === 'phivolcs' ? 'PHIVOLCS' : s === 'emsc' ? 'EMSC' : 'USGS';
}
// Primary (authoritative) source + how many agencies corroborated it, e.g. "PHIVOLCS +2".
function sourceTag(q) {
  const s = q.sources && q.sources.length ? q.sources : [sourceLabel(q.source)];
  return s.length > 1 ? `${s[0]} +${s.length - 1}` : s[0];
}

// A list of recent earthquakes (newest first), paginated: shows `limit`, then `step` more
// per tap (so PHIVOLCS's hundreds of small aftershocks never dump all at once).
export default function QuakeList({ quakes, limit = 12, step = 20, onLocate, shakemaps = [] }) {
  const [shown, setShown] = useState(limit);
  const [sharingId, setSharingId] = useState(null);
  const doShare = async (q) => { setSharingId(q.id); await shareQuake(q, mmiForQuake(q, shakemaps)); setSharingId(null); };
  if (!quakes || quakes.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No recent quakes in the area.</p>;
  }
  const sorted = [...quakes].sort((a, b) => b.time - a.time);
  const rows = sorted.slice(0, shown);
  const remaining = sorted.length - shown;
  return (
    <div className="qlist">
      {rows.map((q) => (
        <div className={`qrow${isMicro(q) ? ' micro' : ''}`} key={q.id}>
          <button className="qrow-go" onClick={() => onLocate?.(q)} title="Show on map">
            <span className="qmag" style={{ background: magColor(q.mag) }}>{q.mag.toFixed(1)}</span>
            <div className="qrow-main">
              <div className="qrow-place">{q.place}</div>
              <div className="qrow-sub">
                {formatClock(q.time)} · {relativeTime(q.time)}
                {q.distanceKm != null ? ` · ≈ ${formatKm(q.distanceKm)}` : ''}
                <span className={`qsrc${(q.sources?.[0] || sourceLabel(q.source)) === 'PHIVOLCS' ? ' phiv' : ''}`} title={(q.sources || [sourceLabel(q.source)]).join(' · ')}>{sourceTag(q)}</span>
                {isMicro(q) && <span className="qmicro" title="Below M2.0 - instrument-detected, not felt">micro</span>}
                {(() => { const mmi = mmiForQuake(q, shakemaps); return mmi != null && mmi >= 2
                  ? <span className="qmmi" style={{ background: mmiColor(mmi) }} title={`Max shaking intensity ${mmiRoman(mmi)} (USGS)`}>Int. {mmiRoman(mmi)}</span> : null; })()}
              </div>
            </div>
            <svg className="qrow-pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
            </svg>
          </button>
          <button className="qrow-share" onClick={() => doShare(q)} disabled={sharingId === q.id} aria-label="Share this quake" title="Share">
            {sharingId === q.id ? '…' : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
      ))}
      {(remaining > 0 || shown > limit) && (
        <div className="qlist-actions">
          {remaining > 0 && (
            <button className="qlist-more" onClick={() => setShown((s) => s + step)}>
              Show more ({remaining} more)
            </button>
          )}
          {shown > limit && (
            <button className="qlist-less" onClick={() => setShown(limit)}>Show less</button>
          )}
        </div>
      )}
    </div>
  );
}
