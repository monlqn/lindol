// Full-screen photo viewer. Tap anywhere (or ✕) to close.
export default function Lightbox({ url, onClose }) {
  if (!url) return null;
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button className="lb-close" onClick={onClose} aria-label="Close">✕</button>
      <img src={url} alt="Report photo" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
