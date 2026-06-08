import { useState, useEffect } from 'react';

// Each step drives the app to a tab and points a tooltip at the matching nav item.
// `arrow` is the horizontal % of the nav the tooltip points to.
const STEPS = [
  { tab: 'home', arrow: 12, title: '🏠 Home', body: 'Your dashboard — the latest quake, recent activity, and your community impact.' },
  { tab: 'map', arrow: 31, title: '🗺️ Map', body: 'A full-screen live map. Orange marks quakes, coloured pins are citizen reports. Tap any pin for details.' },
  { tab: null, arrow: 50, report: true, title: '➕ Report', body: 'Tap the orange button to report what you see — a camera photo, pinned to your exact location.' },
  { tab: 'reports', arrow: 69, title: '📢 Reports', body: 'The live feed. Confirm a report, vote it resolved, or escalate it to authorities.' },
  { tab: 'safety', arrow: 88, title: '🛡️ Safety', body: 'The aftershock alarm, an offline safety guide, and emergency hotlines.' },
];

export default function Tour({ onTab, onReportPulse, onDone }) {
  const [i, setI] = useState(0);
  const s = STEPS[i];

  useEffect(() => {
    if (s.tab) onTab(s.tab);
    onReportPulse?.(!!s.report);
  }, [i]);

  const finish = () => { onReportPulse?.(false); onDone(); };
  const next = () => { if (i + 1 >= STEPS.length) finish(); else setI(i + 1); };

  const last = i === STEPS.length - 1;

  return (
    <div className="tour-scrim" onClick={next}>
      <div className="tour-tip" onClick={(e) => e.stopPropagation()}>
        <span className="tour-arrow" style={{ left: `${s.arrow}%` }} />
        <div className="tour-step">{i + 1} / {STEPS.length}</div>
        <div className="tour-title">{s.title}</div>
        <p>{s.body}</p>
        <div className="tour-actions">
          <button className="tour-skip" onClick={finish}>Skip</button>
          <button className="tour-next" onClick={next}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
