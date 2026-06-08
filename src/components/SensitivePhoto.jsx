import { useState } from 'react';

export default function SensitivePhoto({ url }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={`photo${revealed ? ' revealed' : ''}`}
      style={{ backgroundImage: `url('${url}')` }}
      onClick={() => setRevealed(true)}>
      <div className="gate">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        </svg>
        <span>Sensitive content</span><small>Tap to view · may be distressing</small>
      </div>
    </div>
  );
}
