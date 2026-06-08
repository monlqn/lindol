import { useState } from 'react';
import { DONATION } from '../config.js';

// "Support LINDOL" — voluntary GCash donations. Renders nothing until a real
// GCash number is configured, so no placeholder/fake details are ever shown.
export default function SupportCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!DONATION?.gcashNumber) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(DONATION.gcashNumber);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="support-card">
      <div className="support-h">💙 Support LINDOL</div>
      <p>LINDOL is free and ad-free. If it helped you or your community, you can chip in to keep it online.</p>
      <button className="support-btn" onClick={() => setOpen(true)}>Donate via GCash</button>

      {open && (
        <div className="support-scrim" onClick={() => setOpen(false)}>
          <div className="support-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="support-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            <div className="support-h" style={{ marginBottom: 10 }}>Donate via GCash</div>
            {DONATION.gcashQr && <img className="support-qr" src={DONATION.gcashQr} alt="GCash QR code" />}
            {DONATION.gcashName && <div className="support-name">{DONATION.gcashName}</div>}
            <button className="support-num" onClick={copy}>
              {DONATION.gcashNumber}<span>{copied ? ' · Copied!' : ' · tap to copy'}</span>
            </button>
            <p className="support-note">
              Open GCash → <b>Send Money</b> → paste the number{DONATION.gcashQr ? ', or scan the QR above' : ''}. Any amount helps. Salamat! 🙏
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
