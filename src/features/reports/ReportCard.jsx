import { categoryColor, CATEGORIES } from './reportSchema.js';
import { formatKm } from '../../lib/geo.js';
import { relativeTime } from '../../lib/time.js';
import SensitivePhoto from '../../components/SensitivePhoto.jsx';

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export default function ReportCard({ report, onFlag }) {
  const color = categoryColor(report.category);
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
        <button className="flagbtn" onClick={() => onFlag(report.id)}>
          ⚑ Flag{report.flagCount ? ` · ${report.flagCount}` : ''}
        </button>
      </div>
    </div>
  );
}
