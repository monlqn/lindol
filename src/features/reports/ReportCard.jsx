import { useState } from 'react';
import { categoryColor, CATEGORIES } from './reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime } from '../../lib/time.js';
import SensitivePhoto from '../../components/SensitivePhoto.jsx';

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const FKEY = 'lindol:flagged';
const REASONS = [
  { key: 'fake', label: '🚫 Fake / false' },
  { key: 'graphic', label: '🩸 Graphic' },
  { key: 'location', label: '📍 Wrong location' },
  { key: 'spam', label: '🗑️ Spam' },
  { key: 'other', label: '✏️ Other' },
];

function readFlagged() {
  try { return JSON.parse(localStorage.getItem(FKEY) || '[]'); } catch { return []; }
}
function rememberFlagged(id) {
  try {
    const a = readFlagged();
    if (!a.includes(id)) { a.push(id); localStorage.setItem(FKEY, JSON.stringify(a)); }
  } catch { /* ignore */ }
}

export default function ReportCard({ report, onFlag }) {
  const color = categoryColor(report.category);
  const [flagged, setFlagged] = useState(() => readFlagged().includes(report.id));
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);

  const choose = (reasonKey) => {
    if (flagged) return;          // one flag per device — button locks after tapping
    rememberFlagged(report.id);
    setFlagged(true);
    setPicking(false);
    onFlag(report.id, reasonKey);
  };

  const doShare = async () => {
    const label = LABEL[report.category] ?? 'Report';
    const url = `${window.location.origin}/#reports`;
    const text = `⚠️ ${label} reported near ${report.lat.toFixed(2)}, ${report.lng.toFixed(2)} on LINDOL — live earthquake updates & citizen reports for the area.`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'LINDOL citizen report', text, url }); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true); setTimeout(() => setCopied(false), 1800);
      } catch { /* clipboard blocked */ }
    }
  };

  return (
    <div className="report">
      <div className="rp-head">
        <span className="cat-tag" style={{ background: color }}>{LABEL[report.category] ?? 'Other'}</span>
        <span className="rp-dist">{formatKm(report.distanceKm ?? 0)} · {relativeTime(report.createdAt)}</span>
      </div>
      {report.photoUrl && <SensitivePhoto url={report.photoUrl} />}
      {report.note && <div className="rp-body">{report.note}</div>}
      <div className="rp-foot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
          {report.lat.toFixed(3)}, {report.lng.toFixed(3)}
        </span>
        <div className="rp-actions">
          <button className="rp-share" onClick={doShare} aria-label="Share this report">
            {copied ? 'Copied!' : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                </svg>
                Share
              </>
            )}
          </button>
          <button className="flagbtn" onClick={() => setPicking((p) => !p)} disabled={flagged}>
            {flagged ? '⚑ Flagged' : `⚑ Flag${report.flagCount ? ` · ${report.flagCount}` : ''}`}
          </button>
        </div>
      </div>
      {picking && !flagged && (
        <div className="flag-reasons">
          <span className="fr-label">Why are you flagging this?</span>
          <div className="fr-chips">
            {REASONS.map((r) => (
              <button key={r.key} className="fr-chip" onClick={() => choose(r.key)}>{r.label}</button>
            ))}
          </div>
          <button className="fr-cancel" onClick={() => setPicking(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
