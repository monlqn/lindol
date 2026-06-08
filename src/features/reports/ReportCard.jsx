import { useState } from 'react';
import { categoryColor, categoryIcon, CATEGORIES } from './reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime } from '../../lib/time.js';
import SensitivePhoto from '../../components/SensitivePhoto.jsx';
import { getShareImageFile } from '../../lib/share.js';
import { renderReportCard } from '../../lib/reportCard.js';

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const FKEY = 'lindol:flagged';
const MKEY = 'lindol:mine';
const CKEY = 'lindol:confirmed';

function listHas(key, id) {
  try { return JSON.parse(localStorage.getItem(key) || '[]').includes(id); } catch { return false; }
}
function listAdd(key, id) {
  try {
    const a = JSON.parse(localStorage.getItem(key) || '[]');
    if (!a.includes(id)) { a.push(id); localStorage.setItem(key, JSON.stringify(a)); }
  } catch { /* ignore */ }
}
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

export default function ReportCard({ report, onFlag, onConfirm, onResolve, highlight }) {
  const color = categoryColor(report.category);
  const label = LABEL[report.category] ?? 'Report';
  const state = report.state || 'open';
  const resolved = state === 'resolved';
  const mine = listHas(MKEY, report.id);
  const [flagged, setFlagged] = useState(() => readFlagged().includes(report.id));
  const [confirmed, setConfirmed] = useState(() => listHas(CKEY, report.id));
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);

  const doConfirm = () => {
    if (confirmed || mine) return;     // can't confirm your own report, once per device
    listAdd(CKEY, report.id);
    setConfirmed(true);
    onConfirm?.(report.id);
  };
  const doResolve = () => onResolve?.(report.id, !resolved);

  const choose = (reasonKey) => {
    if (flagged) return;          // one flag per device - locks after tapping
    rememberFlagged(report.id);
    setFlagged(true);
    setPicking(false);
    onFlag(report.id, reasonKey);
  };

  const doShare = async () => {
    const url = `${window.location.origin}/r/${report.id}`;
    const text = `⚠️ ${label} reported near ${report.lat.toFixed(2)}, ${report.lng.toFixed(2)} on LINDOL. Live earthquake updates & citizen reports for the area.`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        // A graphic card rendered from this actual report, falling back to the banner.
        const file = (await renderReportCard(report)) || (await getShareImageFile());
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'LINDOL citizen report', text: `${text} ${url}`, files: [file] });
          return;
        }
        await navigator.share({ title: 'LINDOL citizen report', text, url });
      } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true); setTimeout(() => setCopied(false), 1800);
      } catch { /* clipboard blocked */ }
    }
  };

  return (
    <article className={`igpost${highlight ? ' shared' : ''}${resolved ? ' resolved' : ''}`}>
      {highlight && <div className="shared-tag">🔗 Shared report</div>}

      <header className="ig-head">
        <span className="ig-avatar" style={{ background: color }}>{categoryIcon(report.category)}</span>
        <div className="ig-id">
          <span className="ig-name">{label}</span>
          <span className="ig-loc">{report.lat.toFixed(3)}, {report.lng.toFixed(3)} · {formatKm(report.distanceKm ?? 0)} away</span>
        </div>
        <div className="ig-meta">
          {state !== 'open' && (
            <span className={`state-badge ${state}`}>{resolved ? '✅ Resolved' : '✓ Confirmed'}</span>
          )}
          <span className="ig-time">{relativeTime(report.createdAt)}</span>
        </div>
      </header>

      {report.photoUrl
        ? <div className="ig-photo"><SensitivePhoto url={report.photoUrl} sensitive={report.sensitive} /></div>
        : <div className="ig-noimg" style={{ borderColor: color }}><span style={{ color }}>{label}</span></div>}

      <div className="ig-actions">
        <button className="ig-act" onClick={doShare} aria-label="Share this report">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          {copied ? 'Copied!' : 'Share'}
        </button>
        <button className="ig-act flag" onClick={() => setPicking((p) => !p)} disabled={flagged} aria-label="Flag this report">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 21V4M4 4h13l-2 4 2 4H4" />
          </svg>
          {flagged ? 'Flagged' : `Flag${report.flagCount ? ` · ${report.flagCount}` : ''}`}
        </button>
      </div>

      {(onConfirm || onResolve) && (
        <div className="ig-life">
          {!mine && !resolved && (
            <button className="ig-confirm" onClick={doConfirm} disabled={confirmed}>
              ✓ {confirmed ? 'Confirmed' : 'Confirm'}{report.confirmCount ? ` · ${report.confirmCount}` : ''}
            </button>
          )}
          {(mine || resolved) && report.confirmCount > 0 && (
            <span className="ig-confirmcount">✓ {report.confirmCount} confirmed by neighbours</span>
          )}
          {mine && (
            <button className={`ig-resolve${resolved ? ' on' : ''}`} onClick={doResolve}>
              {resolved ? '↩ Reopen' : '✅ Mark resolved'}
            </button>
          )}
        </div>
      )}

      {report.note && (
        <div className="ig-caption">{report.note}</div>
      )}

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
    </article>
  );
}
