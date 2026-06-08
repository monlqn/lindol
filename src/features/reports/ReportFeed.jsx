import ReportCard from './ReportCard.jsx';

export default function ReportFeed({ reports, onFlag, onConfirm, onResolve, focused }) {
  const base = [...reports].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  // A deep-linked (shared) report may not be near the viewer - show it at the top.
  const list = focused && !base.some((r) => r.id === focused.id) ? [focused, ...base] : base;

  if (!list.length) {
    return <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No reports yet. Be the first to report what you see.</p>;
  }
  return (
    <div className="feed">
      {list.map((r) => (
        <ReportCard key={r.id} report={r} onFlag={onFlag} onConfirm={onConfirm} onResolve={onResolve}
          highlight={focused && r.id === focused.id} />
      ))}
    </div>
  );
}
