import { SAFETY_TIPS } from './safetyData.js';

export default function SafetyPanel() {
  return (
    <div>
      <div className="safety-grid">
        {SAFETY_TIPS.map((t) => (
          <div className="safety" key={t.title}>
            <div className="ic" aria-hidden="true">{t.icon}</div>
            <div><h4>{t.title}</h4><p>{t.body}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
