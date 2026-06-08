import { useState, useEffect, useRef } from 'react';
import { getShareImageFile } from '../lib/share.js';
import { renderShareCard } from '../lib/shareCard.js';

const SHARE_TITLE = 'LINDOL — Southern Mindanao Live Earthquake Watch';
const SHARE_TEXT = 'Live earthquakes, aftershocks & safety for Southern Mindanao. Stay informed:';

export default function ShareButton({ stats }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://lindol.app/';
  const enc = encodeURIComponent;
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      // Attach the banner image so it shows even if the target hasn't cached our OG tags.
      try {
        // A freshly rendered card with live data, falling back to the static banner.
        const file = (await renderShareCard(stats || {})) || (await getShareImageFile());
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: SHARE_TITLE, text: `${SHARE_TEXT} ${url}`, files: [file] });
          return;
        }
      } catch { /* fall through to a plain link share */ }
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
      } catch {
        /* user cancelled the native sheet — no-op */
      }
    } else {
      setOpen((o) => !o);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const links = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(SHARE_TEXT)}&url=${enc(url)}` },
    { label: 'Threads', href: `https://www.threads.net/intent/post?text=${enc(SHARE_TEXT + ' ' + url)}` },
  ];

  return (
    <div className="share" ref={containerRef}>
      <button type="button" className="share-btn" onClick={handleShare} aria-expanded={open} aria-haspopup="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Share LINDOL
      </button>
      {open && (
        <div className="share-menu">
          {links.map((l) => (
            <a key={l.label} className="share-opt" href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
          ))}
          <button type="button" className="share-opt" onClick={copyLink}>{copied ? 'Link copied!' : 'Copy link'}</button>
        </div>
      )}
    </div>
  );
}
