// Situation updates with article images. Primary source is GDELT (a free global news index
// that returns each article's lead image), filtered to English / Philippine coverage. If GDELT
// is unavailable or thin, we fall back to Google News RSS (publisher logos). Per-item we fall
// back to the publisher favicon when an article has no image. Server-side + CDN-cached (~10 min)
// so neither source is hit per user.
const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GNEWS_QUERIES = [
  'Mindanao earthquake',
  'Sarangani earthquake',
  '"General Santos" earthquake',
  'Davao earthquake',
];

const UA = { 'user-agent': 'Mozilla/5.0 (LINDOL/1.0; +https://lindol.app)' };

function withTimeout(url, ms, opts = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t));
}

const faviconFor = (domain) => (domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : null);

// ---- GDELT (real article images) ----
// seendate looks like "20260609T115700Z".
function parseSeen(s) {
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, se] = m;
  const t = Date.parse(`${Y}-${Mo}-${D}T${h}:${mi}:${se}Z`);
  return Number.isFinite(t) ? t : null;
}

async function fetchGdelt() {
  const url = `${GDELT}?query=${encodeURIComponent('Mindanao earthquake')}`
    + '&mode=ArtList&maxrecords=40&timespan=4d&format=json&sort=datedesc';
  const r = await withTimeout(url, 9000, { headers: UA });
  if (!r.ok) return [];
  const text = await r.text();
  // GDELT replies with a plain-text scold when rate-limited - bail to the fallback.
  if (!text.startsWith('{')) return [];
  const j = JSON.parse(text);
  const arts = Array.isArray(j.articles) ? j.articles : [];
  const seen = new Set();
  return arts
    .filter((a) => a && a.url && a.title)
    .filter((a) => {
      const lang = (a.language || '').toLowerCase();
      return lang.startsWith('eng') || lang.includes('english') || (a.domain || '').endsWith('.ph');
    })
    .filter((a) => { const k = a.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((a) => ({
      id: a.url,
      title: a.title,
      source: a.domain || 'News',
      url: a.url,
      image: a.socialimage || faviconFor(a.domain),
      fallbackImage: faviconFor(a.domain),
      publishedAt: parseSeen(a.seendate),
    }));
}

// ---- Google News RSS (publisher logos) - fallback ----
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};
const clean = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ').trim();

function sourceDomain(itemXml) {
  const m = itemXml.match(/<source[^>]*\burl="([^"]+)"/i);
  if (!m) return '';
  try { return new URL(m[1]).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function parseRss(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const out = [];
  for (const it of items) {
    const link = clean(tag(it, 'link'));
    const rawTitle = clean(tag(it, 'title'));
    if (!link || !rawTitle) continue;
    const source = clean(tag(it, 'source')) || 'News';
    const title = source && rawTitle.endsWith(` - ${source}`)
      ? rawTitle.slice(0, -(source.length + 3)).trim() : rawTitle;
    const pub = Date.parse(clean(tag(it, 'pubDate')));
    const domain = sourceDomain(it);
    out.push({
      id: link,
      title,
      source,
      url: link,
      image: faviconFor(domain),
      fallbackImage: faviconFor(domain),
      publishedAt: Number.isFinite(pub) ? pub : null,
    });
  }
  return out;
}

async function fetchGoogle() {
  const results = await Promise.all(GNEWS_QUERIES.map(async (q) => {
    try {
      const p = new URLSearchParams({ q, hl: 'en-PH', gl: 'PH', ceid: 'PH:en' });
      const r = await withTimeout(`https://news.google.com/rss/search?${p.toString()}`, 5000, { headers: UA });
      if (!r.ok) return [];
      return parseRss(await r.text());
    } catch { return []; }
  }));
  return results.flat();
}

export default async function handler(req, res) {
  try {
    // Run both in parallel: GDELT for real photos, Google News always ready as a fallback so
    // the feed never goes empty and there's no sequential latency penalty when GDELT is slow.
    const [gd, gg] = await Promise.all([
      fetchGdelt().catch(() => []),
      fetchGoogle().catch(() => []),
    ]);

    // Prefer GDELT items (they carry real images); fill with Google items not already present.
    const items = [...gd];
    const seen = new Set(gd.map((i) => i.title.toLowerCase()));
    for (const it of gg) {
      const k = it.title.toLowerCase();
      if (!seen.has(k)) { seen.add(k); items.push(it); }
    }

    const out = items
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .slice(0, 18);

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ count: out.length, items: out });
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ count: 0, items: [], error: 'fetch_failed' });
  }
}

export { parseRss };
