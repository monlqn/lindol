const TABS = [
  { key: 'home', label: 'Home', d: 'M3 12h4l2.5 7 4-14 2.5 7H21' },
  { key: 'quakes', label: 'Quakes', d: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { key: 'reports', label: 'Reports', d: 'M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z' },
  { key: 'safety', label: 'Safety', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
];

// Native-style bottom tab bar with a raised center Report action.
export default function BottomNav({ active, onChange, onReport }) {
  const btn = (t) => (
    <button key={t.key} className={`navbtn${active === t.key ? ' on' : ''}`}
      onClick={() => onChange(t.key)} aria-label={t.label} aria-current={active === t.key}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
      <span>{t.label}</span>
    </button>
  );
  return (
    <nav className="bottomnav">
      {btn(TABS[0])}
      {btn(TABS[1])}
      <button className="nav-report" onClick={onReport} aria-label="Report what you see">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      {btn(TABS[2])}
      {btn(TABS[3])}
    </nav>
  );
}
