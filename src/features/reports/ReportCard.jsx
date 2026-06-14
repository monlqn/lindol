import { useRef, useState } from 'react';
import { categoryColor, categoryIcon, CATEGORIES } from './reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime } from '../../lib/time.js';
import SensitivePhoto from '../../components/SensitivePhoto.jsx';
import ReportComments from './ReportComments.jsx';
import { getShareImageFile } from '../../lib/share.js';
import { renderReportCard } from '../../lib/reportCard.js';
import { addReportPhoto } from './reportsApi.js';
import { supabase } from '../../lib/supabase.js';
import { getDeviceId } from '../../lib/device.js';
import { HOTLINES } from '../../config.js';

const EKEY = 'lindol:escalated';
const RVKEY = 'lindol:resolvevotes';

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

export default function ReportCard({ report, onFlag, onConfirm, onResolve, onEscalate, onVoteResolve, onOpenPhoto, onLocate, highlight }) {
  const color = categoryColor(report.category);
  const label = LABEL[report.category] ?? 'Report';
  const state = report.state || 'open';
  const resolved = state === 'resolved';
  const mine = listHas(MKEY, report.id);
  const [flagged, setFlagged] = useState(() => readFlagged().includes(report.id));
  const [confirmed, setConfirmed] = useState(() => listHas(CKEY, report.id));
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedPhoto, setAddedPhoto] = useState(null);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const photoInput = useRef(null);
  const photo = addedPhoto || report.photoUrl;

  const onAddPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !supabase) return;
    setAddingPhoto(true);
    try { setAddedPhoto(await addReportPhoto(supabase, report.id, getDeviceId(), f)); }
    catch { /* not owner / upload failed */ }
    setAddingPhoto(false);
  };

  const doConfirm = () => {
    if (confirmed || mine) return;     // can't confirm your own report, once per device
    listAdd(CKEY, report.id);
    setConfirmed(true);
    onConfirm?.(report.id);
  };
  const doResolve = () => onResolve?.(report.id, !resolved);

  const [votedResolve, setVotedResolve] = useState(() => listHas(RVKEY, report.id));
  const doVoteResolve = () => {
    if (votedResolve || mine) return;
    listAdd(RVKEY, report.id);
    setVotedResolve(true);
    onVoteResolve?.(report.id);
  };

  const [escalating, setEscalating] = useState(false);
  const escalated = report.escalated || listHas(EKEY, report.id);
  const details = `LINDOL citizen report - ${label}
Location: ${report.lat.toFixed(4)}, ${report.lng.toFixed(4)} (https://maps.google.com/?q=${report.lat},${report.lng})
Time: ${new Date(report.createdAt).toLocaleString()}${report.note ? `\nDetails: ${report.note}` : ''}
Live: ${window.location.origin}/r/${report.id}`;

  const markEscalated = () => { listAdd(EKEY, report.id); onEscalate?.(report.id); };
  const copyDetails = async () => {
    try { await navigator.clipboard.writeText(details); } catch { /* blocked */ }
    markEscalated();
  };
  const shareDetails = async () => {
    try { if (navigator.share) await navigator.share({ text: details }); } catch { /* cancelled */ }
    markEscalated();
  };

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
          <button className="ig-loc" onClick={() => onLocate?.(report)} title="Show on map">
            {report.lat.toFixed(3)}, {report.lng.toFixed(3)} · {formatKm(report.distanceKm ?? 0)} away
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
            </svg>
          </button>
        </div>
        <div className="ig-meta">
          {state !== 'open' && (
            <span className={`state-badge ${state}`}>{resolved ? '✅ Resolved' : '✓ Confirmed'}</span>
          )}
          <span className="ig-time">{relativeTime(report.createdAt)}</span>
        </div>
      </header>

      {photo
        ? <div className="ig-photo"><SensitivePhoto url={photo} sensitive={report.sensitive} onExpand={onOpenPhoto} /></div>
        : (
          <div className="ig-noimg" style={{ borderColor: color }}>
            <span style={{ color }}>{label}</span>
            {mine && (
              <>
                <button className="ig-addphoto" onClick={() => photoInput.current?.click()} disabled={addingPhoto}>
                  {addingPhoto ? 'Uploading…' : '📷 Add a photo'}
                </button>
                <input ref={photoInput} type="file" accept="image/*" capture="environment"
                  style={{ display: 'none' }} onChange={onAddPhoto} />
              </>
            )}
          </div>
        )}

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
          {!mine && !resolved && (
            <button className="ig-vresolve" onClick={doVoteResolve} disabled={votedResolve} title="Vote that this is resolved">
              ✅ {votedResolve ? 'Voted' : 'Resolved?'}{report.resolveCount ? ` · ${report.resolveCount}` : ''}
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

      {onEscalate && (
        <div className="ig-escalate-row">
          <button className={`ig-escalate${escalated ? ' done' : ''}`} onClick={() => setEscalating((v) => !v)}>
            {escalated ? '📨 Reported to authorities' : '📨 Report to authorities'}
          </button>
        </div>
      )}
      {escalating && (
        <div className="escalate-panel">
          <p className="ep-note">Send this to your barangay / DRRMO / BFP, or share it to an official page. Save their number for fastest response.</p>
          <div className="ep-text">{details}</div>
          <div className="ep-actions">
            <button onClick={copyDetails}>📋 Copy</button>
            <a className="ep-btn" href={`sms:?body=${encodeURIComponent(details)}`} onClick={markEscalated}>💬 SMS</a>
            <button onClick={shareDetails}>📤 Share</button>
          </div>
          <div className="ep-calls">
            {HOTLINES.slice(0, 2).map((h) => (
              <a key={h.tel} href={`tel:${h.tel}`} onClick={markEscalated}>{h.icon} {h.label} · {h.number}</a>
            ))}
          </div>
        </div>
      )}

      {report.note && (
        <div className="ig-caption">{report.note}</div>
      )}

      <ReportComments reportId={report.id} resolved={resolved} />

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
