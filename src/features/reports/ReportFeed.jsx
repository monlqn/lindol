import ReportCard from './ReportCard.jsx';

export default function ReportFeed({ reports, onFlag, onConfirm, onResolve, onEscalate, onVoteResolve, onOpenPhoto, onLocate, focused, onStartReport }) {
  const base = [...reports].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  // A deep-linked (shared) report may not be near the viewer - show it at the top.
  const list = focused && !base.some((r) => r.id === focused.id) ? [focused, ...base] : base;

  if (!list.length) {
    return (
      <div className="feed-empty">
        <div className="fe-icon">📷</div>
        <h3 className="fe-title">No citizen reports near you yet</h3>
        <p className="fe-text">
          If you're in Glan, General Santos, or anywhere feeling the aftershocks, what you can see helps
          neighbours and responders. A photo of a damaged road or building - or even an
          <b> "we're safe here"</b> update - makes a real difference.
        </p>
        {onStartReport && (
          <button className="fe-btn" onClick={onStartReport}>＋ Add the first report</button>
        )}
        <p className="fe-safe">Report only what you personally see. In a life-threatening emergency, call 911 first.</p>
      </div>
    );
  }
  return (
    <div className="feed">
      {list.map((r) => (
        <ReportCard key={r.id} report={r} onFlag={onFlag} onConfirm={onConfirm} onResolve={onResolve}
          onEscalate={onEscalate} onVoteResolve={onVoteResolve} onOpenPhoto={onOpenPhoto} onLocate={onLocate}
          highlight={focused && r.id === focused.id} />
      ))}
    </div>
  );
}
