// PHIVOLCS reported intensities (PEIS) for recent significant quakes - the local authority, which
// assigns intensity to felt quakes that USGS never maps. Each event's intensity lives on its detail
// page, so we scrape the bulletin for significant recent quakes and fetch their detail pages (in
// parallel, capped). Returns each quake's MAX reported intensity. CDN-cached so PHIVOLCS isn't hammered.
import https from 'https';

const BASE = 'https://earthquake.phivolcs.dost.gov.ph/';
// Only this host's (invalid) cert is skipped; a redirect elsewhere is verified normally.
const PHIVOLCS_HOST = 'earthquake.phivolcs.dost.gov.ph';
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: new URL(url).hostname !== PHIVOLCS_HOST, headers: { 'user-agent': 'Mozilla/5.0 (LINDOL/1.0; +https://lindol.app)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 3) {
        res.resume();
        resolve(get(new URL(res.headers.location, url).href, redirects + 1));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

// Gazetteer of the places PHIVOLCS names in Southern Mindanao intensity reports (+ provinces as
// fallback). [matchSubstring(UPPER), display, lat, lng]. Used to put a coordinate on each report
// so the app can find the intensity nearest the user. More specific names are matched first.
const GAZ = [
  ['GENERAL SANTOS', 'General Santos', 6.11, 125.17], ['CITY OF DAVAO', 'Davao City', 7.07, 125.61],
  ['DAVAO CITY', 'Davao City', 7.07, 125.61], ['DIGOS', 'Digos', 6.75, 125.36],
  ['KORONADAL', 'Koronadal', 6.50, 124.85], ['CAGAYAN DE ORO', 'Cagayan de Oro', 8.48, 124.65],
  ['ZAMBOANGA', 'Zamboanga City', 6.91, 122.08], ['COTABATO', 'Cotabato City', 7.22, 124.25],
  ['TANDAG', 'Tandag', 9.08, 126.20], ['MALAYBALAY', 'Malaybalay', 8.16, 125.13],
  ['GINGOOG', 'Gingoog', 8.82, 125.10], ['ALABEL', 'Alabel', 6.10, 125.29], ['GLAN', 'Glan', 5.82, 125.20],
  ['MALAPATAN', 'Malapatan', 5.96, 125.26], ['MALUNGON', 'Malungon', 6.27, 125.28],
  ['MAASIM', 'Maasim', 5.87, 125.30], ['KIAMBA', 'Kiamba', 5.99, 124.62], ['MAITUM', 'Maitum', 6.03, 124.48],
  ['POLOMOLOK', 'Polomolok', 6.22, 125.06], ['TUPI', 'Tupi', 6.33, 124.95], ['TAMPAKAN', 'Tampakan', 6.43, 124.92],
  ['SURALLAH', 'Surallah', 6.37, 124.74], ['NORALA', 'Norala', 6.52, 124.65], ['TBOLI', "T'boli", 6.27, 124.78],
  ['LAKE SEBU', 'Lake Sebu', 6.21, 124.71], ['BANGA', 'Banga', 6.42, 124.78], ['SANTO NI', 'Santo Niño', 6.42, 124.55],
  ['MATANAO', 'Matanao', 6.73, 125.23], ['MAGSAYSAY', 'Magsaysay', 6.71, 125.21],
  ['SANTA MARIA', 'Santa Maria', 6.18, 125.46], ['STA. MARIA', 'Santa Maria', 6.18, 125.46], ['MALITA', 'Malita', 6.41, 125.61],
  ['ISULAN', 'Isulan', 6.63, 124.60], ['TACURONG', 'Tacurong', 6.69, 124.68], ['ESPERANZA', 'Esperanza', 6.55, 124.53],
  ['BAGUMBAYAN', 'Bagumbayan', 6.51, 124.83], ['MAMBAJAO', 'Mambajao', 9.25, 124.72], ['NABUNTURAN', 'Nabunturan', 7.61, 125.96],
  ['LIBONA', 'Libona', 8.35, 124.74], ['SAN FERNANDO', 'San Fernando', 8.0, 125.0],
  // province fallbacks
  ['SARANGANI', 'Sarangani', 5.92, 125.20], ['SOUTH COTABATO', 'South Cotabato', 6.27, 124.85],
  ['DAVAO DEL SUR', 'Davao del Sur', 6.77, 125.35], ['DAVAO OCCIDENTAL', 'Davao Occidental', 6.10, 125.60],
  ['SULTAN KUDARAT', 'Sultan Kudarat', 6.55, 124.50], ['DAVAO DE ORO', 'Davao de Oro', 7.55, 126.0],
  ['BUKIDNON', 'Bukidnon', 8.0, 125.1], ['MISAMIS ORIENTAL', 'Misamis Oriental', 8.5, 124.8],
  ['SURIGAO DEL SUR', 'Surigao del Sur', 8.7, 126.1], ['CAMIGUIN', 'Camiguin', 9.17, 124.73],
];

function parsePht(s) {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return NaN;
  const [, d, mon, y, hhRaw, mm, ap] = m;
  const month = MONTHS[mon.toLowerCase()];
  if (month == null) return NaN;
  let hh = Number(hhRaw) % 12;
  if (/pm/i.test(ap)) hh += 12;
  return Date.parse(`${y}-${String(month + 1).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${mm}:00+08:00`);
}

// Parse per-location intensities from a detail page -> { max, reports:[{place, mmi, lat, lng}] }.
function parseIntensities(html) {
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');
  const blocks = [...txt.matchAll(/Intensity\s+([IVX]+)\s*[-]\s*([^]*?)(?=Intensity\s+[IVX]+\s*[-]|Instrumental|Expecting|Issued|Reported by|This is an|$)/gi)];
  let max = 0;
  const byPlace = new Map();
  for (const b of blocks) {
    const mmi = ROMAN[b[1].toUpperCase()];
    if (!mmi) continue;
    max = Math.max(max, mmi);
    const up = b[2].toUpperCase();
    for (const g of GAZ) {
      if (up.includes(g[0])) {
        const prev = byPlace.get(g[1]);
        if (!prev || mmi > prev.mmi) byPlace.set(g[1], { place: g[1], mmi, lat: g[2], lng: g[3] });
      }
    }
  }
  return { max, reports: [...byPlace.values()] };
}

export default async function handler(req, res) {
  try {
    const html = await get(BASE);
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const items = [];
    for (const row of rows) {
      const hrefM = row.match(/href="([^"]+)"/i);
      const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || []).map(strip);
      if (cells.length < 6 || !hrefM) continue;
      const time = parsePht(cells[0]);
      const lat = parseFloat(cells[1]);
      const lng = parseFloat(cells[2]);
      const mag = parseFloat(cells[4]);
      if (![time, lat, lng, mag].every(Number.isFinite)) continue;
      let href = hrefM[1].split('\\').join('/');
      if (!/^https?:/.test(href)) href = new URL(href, BASE).href;
      items.push({ time, lat, lng, mag, href });
    }

    // Fetch detail pages for significant quakes (capped). Take the STRONGEST (so the mainshock is
    // always included for "intensity near you") plus the most RECENT, deduped.
    const cutoff = Date.now() - 9 * 86400000;
    const recent = items.filter((q) => q.mag >= 4 && q.time >= cutoff);
    const byMag = [...recent].sort((a, b) => b.mag - a.mag).slice(0, 12);
    const byTime = [...recent].sort((a, b) => b.time - a.time).slice(0, 22);
    const seen = new Set();
    const sig = [];
    for (const q of [...byMag, ...byTime]) {
      const k = `${q.time}-${q.lat}`;
      if (!seen.has(k)) { seen.add(k); sig.push(q); }
    }

    const events = [];
    await Promise.all(sig.map(async (q) => {
      try {
        const detail = await get(q.href);
        const { max, reports } = parseIntensities(detail);
        if (max >= 2) events.push({ time: q.time, lat: q.lat, lng: q.lng, mag: q.mag, mmi: max, reports, source: 'PHIVOLCS' });
      } catch { /* skip this one */ }
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ events });
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ events: [] });
  }
}
