// Live earthquake events from the PHIVOLCS public bulletin - the local authority for
// Philippine seismicity, which records the small aftershocks USGS/EMSC miss. PHIVOLCS has
// no public API and serves an invalid TLS cert, so this runs server-side: it ignores the
// cert for that one host, parses the bulletin table into clean JSON, and is cached at the
// CDN so PHIVOLCS receives ~1 request every few minutes no matter how many users we have.
import https from 'https';

const BULLETIN = 'https://earthquake.phivolcs.dost.gov.ph/';
// The only host whose (invalid) TLS cert we deliberately skip. A redirect to anywhere
// else gets normal cert verification, so the bypass can't follow PHIVOLCS off-site.
const PHIVOLCS_HOST = 'earthquake.phivolcs.dost.gov.ph';
const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function getHtml(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        rejectUnauthorized: new URL(url).hostname !== PHIVOLCS_HOST,
        headers: { 'user-agent': 'Mozilla/5.0 (LINDOL/1.0; +https://lindol.app)' },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 3) {
          res.resume();
          resolve(getHtml(new URL(res.headers.location, url).href, redirects + 1));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve(data));
      },
    ).on('error', reject);
  });
}

const strip = (s) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

// "09 June 2026 - 04:21 PM" is Philippine Standard Time (UTC+8) -> epoch ms.
function parsePht(s) {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return NaN;
  const [, d, mon, y, hhRaw, mm, ap] = m;
  const month = MONTHS[mon.toLowerCase()];
  if (month == null) return NaN;
  let hh = Number(hhRaw) % 12;
  if (/pm/i.test(ap)) hh += 12;
  const iso = `${y}-${String(month + 1).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`
    + `T${String(hh).padStart(2, '0')}:${mm}:00+08:00`;
  return Date.parse(iso);
}

// Parse the bulletin HTML table into the same Quake shape as USGS/EMSC. Exported for tests.
export function parseBulletin(html) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const out = [];
  for (const row of rows) {
    const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || []).map(strip);
    if (cells.length < 6) continue;
    const [dt, latS, lngS, depthS, magS, ...rest] = cells;
    const time = parsePht(dt);
    const lat = parseFloat(latS);
    const lng = parseFloat(lngS);
    const mag = parseFloat(magS);
    const depthKm = parseFloat(depthS);
    if (!Number.isFinite(time) || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(mag)) continue;
    out.push({
      id: `phivolcs:${time}:${lat.toFixed(2)}:${lng.toFixed(2)}`,
      mag,
      place: rest.join(' ').replace(/\s+/g, ' ').trim() || 'Philippines',
      time,
      depthKm: Number.isFinite(depthKm) ? depthKm : null,
      lat,
      lng,
      source: 'phivolcs',
    });
  }
  return out;
}

export default async function handler(req, res) {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
  const min = Math.max(Number(req.query.min) || 0, 0);
  try {
    const html = await getHtml(BULLETIN);
    const cutoff = Date.now() - days * 86400000;
    const quakes = parseBulletin(html)
      .filter((q) => q.time >= cutoff && q.mag >= min)
      .sort((a, b) => b.time - a.time)
      .slice(0, 600);
    res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=600');
    res.status(200).json({ source: 'phivolcs', count: quakes.length, quakes });
  } catch {
    // Never 500 the client: return empty so the app falls back to USGS/EMSC cleanly.
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(200).json({ source: 'phivolcs', count: 0, quakes: [], error: 'fetch_failed' });
  }
}
