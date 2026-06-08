import { useState } from 'react';

const KEY = 'lindol:seen-intro-v1';

const FEATURES = [
  {
    t: 'Live quakes & aftershocks',
    d: 'Real-time USGS data for Southern Mindanao on a map - magnitude, depth, and distance from you.',
  },
  {
    t: 'Report what you see',
    d: 'Share damage, blocked roads, fires, or "I’m safe" - pinned to your GPS, with a camera-only photo so it stays real.',
  },
  {
    t: 'Safety that works offline',
    d: 'Drop-Cover-Hold and aftershock tips stay available with no signal. Add it to your home screen to use it like an app.',
  },
];

// First-visit welcome that introduces what the app does. Shown once per device.
export default function IntroOverlay() {
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(KEY); } catch { return true; }
  });
  if (!open) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <div className="intro-scrim" onClick={(e) => e.target === e.currentTarget && dismiss()}>
      <div className="intro-card">
        <div className="intro-mark"><span className="epi-o"><i /></span></div>
        <h2>Welcome to LINDOL</h2>
        <p className="intro-sub">Southern Mindanao&rsquo;s live earthquake watch. Here&rsquo;s what you can do:</p>
        <ul className="intro-feats">
          {FEATURES.map((f) => (
            <li key={f.t}><b>{f.t}</b><span>{f.d}</span></li>
          ))}
        </ul>
        <button className="submit" onClick={dismiss}>Get started</button>
        <p className="intro-note">Free · no sign-up · works offline</p>
      </div>
    </div>
  );
}
