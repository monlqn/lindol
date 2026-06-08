import { SAFETY_TIPS } from './safetyData.js';

export default function SafetyPanel() {
  return (
    <div>
      <div className="safety-grid">
        {SAFETY_TIPS.map((t) => (
          <div className="safety" key={t.title}>
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div><h4>{t.title}</h4><p>{t.body}</p></div>
          </div>
        ))}
      </div>
      <div className="safety-note">These tips stay available even with no signal.</div>
    </div>
  );
}
