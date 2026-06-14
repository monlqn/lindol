import SectionLabel from './SectionLabel.jsx';
import { useNews } from '../features/news/useNews.js';
import { relativeTime } from '../lib/time.js';

// A clearly-labelled band of NEWS headlines about the affected areas, pinned above the
// citizen reports. These are links to outside outlets - never presented as citizen reports.
export default function SituationUpdates() {
  const { items } = useNews();
  if (!items.length) return null;

  // A favicon URL is a logo (show contained); anything else is a real article photo (cover).
  const isLogo = (u) => !u || u.includes('s2/favicons');
  const onImgError = (e, fallback) => {
    const img = e.currentTarget;
    if (fallback && img.src !== fallback) { img.src = fallback; img.dataset.logo = '1'; }
    else { img.style.display = 'none'; }
  };

  return (
    <section className="reveal situation">
      <div className="feed-head">
        <SectionLabel>📰 Situation updates · from the news</SectionLabel>
      </div>
      <p className="situation-note">
        Headlines from news outlets about the affected areas - tap to read the full report at the source.
        These are news links, not citizen reports.
      </p>
      <div className="news-list">
        {items.map((n) => (
          <a key={n.id} className="news-item" href={n.url} target="_blank" rel="noopener noreferrer">
            <span className={`news-thumb${isLogo(n.image) ? ' logo' : ''}`} aria-hidden="true">
              {n.image
                ? <img src={n.image} alt="" loading="lazy" onError={(e) => onImgError(e, n.fallbackImage)} />
                : <span className="news-thumb-fallback">📰</span>}
            </span>
            <span className="news-body">
              <span className="news-title">{n.title}</span>
              <span className="news-meta">
                <span className="news-src">{n.source}</span>
                {n.publishedAt ? ` · ${relativeTime(n.publishedAt)}` : ''}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
