import ReportCard from './ReportCard.jsx';

export default function ReportFeed({ reports, onFlag }) {
  if (!reports.length) {
    return <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No reports yet. Be the first to report what you see.</p>;
  }
  const sorted = [...reports].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return (
    <div className="feed">
      {sorted.map((r) => <ReportCard key={r.id} report={r} onFlag={onFlag} />)}
    </div>
  );
}
