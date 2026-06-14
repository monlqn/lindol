import { useState } from 'react';

const SLIDES = [
  { icon: '🌋', title: 'Welcome to LINDOL',
    body: "The Philippines' live earthquake watch, with the active Sarangani sequence highlighted. Free, no sign-up, works offline." },
  { icon: '📍', title: "See what's happening",
    body: 'A live map of real quakes (USGS), a loud alarm for strong quakes near you, and a safety guide that works with no signal.' },
  { icon: '🤝', title: 'Report and verify, together',
    body: 'Report damage or "I’m safe" with a photo + your location. Neighbours confirm it, you can escalate to authorities, then mark it resolved.' },
  { icon: '⚠️', title: 'One important thing',
    body: 'LINDOL is an awareness tool, not a 911 replacement and not early warning. If you feel shaking, act immediately. For emergencies, call 911.' },
];

// First-visit welcome carousel. onStartTour launches the interactive tour; onSkip finishes.
export default function IntroOverlay({ onStartTour, onSkip }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div className="intro-scrim">
      <div className="intro-card">
        <div className="intro-emoji">{s.icon}</div>
        <h2>{s.title}</h2>
        <p className="intro-sub">{s.body}</p>
        <div className="intro-dots">
          {SLIDES.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}
        </div>
        {last ? (
          <>
            <button className="submit" onClick={onStartTour}>Take a quick tour</button>
            <button className="intro-skip" onClick={onSkip}>Skip — I’ll explore</button>
          </>
        ) : (
          <div className="intro-nav">
            <button className="intro-skip" onClick={onSkip}>Skip</button>
            <button className="submit intro-next" onClick={() => setI(i + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
