import { useRef, useState } from 'react';

// Wraps a scrollable container and adds swipe-down-to-refresh when at the top.
export default function PullToRefresh({ onRefresh, className = '', children }) {
  const ref = useRef(null);
  const startY = useRef(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const TRIGGER = 60;

  const onStart = (e) => {
    startY.current = (ref.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null;
  };
  const onMove = (e) => {
    if (startY.current == null || busy) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy * 0.5, 80));
  };
  const onEnd = async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= TRIGGER && !busy) {
      setBusy(true); setPull(38);
      try { await onRefresh?.(); } catch { /* ignore */ }
      setBusy(false);
    }
    setPull(0);
  };

  return (
    <div ref={ref} className={className} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}>
      <div className="ptr" style={{ height: `${pull}px`, opacity: pull ? 1 : 0 }}>
        <span className={`ptr-ic${busy ? ' spin' : ''}`}>↻</span>
      </div>
      {children}
    </div>
  );
}
