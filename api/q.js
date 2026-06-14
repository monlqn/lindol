// Per-quake Open Graph page so Facebook (which ignores share-sheet images and only scrapes the
// shared URL) shows the rendered quake card. The client uploads the card to Supabase storage and
// shares /q?img=<card url>&mag=&place=&t=. Humans are redirected into the app; crawlers read the tags.
const SITE = 'https://lindol.app';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const { id, m, p, t, img, mag, place } = req.query;
  const theMag = m || mag;
  const thePlace = p || place;
  const mLabel = theMag && /^[\d.]+$/.test(String(theMag)) ? `M${theMag}` : 'Earthquake';
  const loc = thePlace ? ` — ${String(thePlace).slice(0, 60)}` : '';
  const title = `${mLabel} earthquake${loc}`;
  let when = '';
  if (t && /^\d+$/.test(String(t))) {
    try { when = ` · ${new Date(Number(t)).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`; } catch { /* ignore */ }
  }
  const desc = `Magnitude ${theMag || '?'}${when}. Live Philippine earthquake & aftershock tracking on LINDOL.`;
  // Rebuild the card image URL from the short id (or accept a full Supabase URL for old links).
  const SB = process.env.VITE_SUPABASE_URL;
  let image = `${SITE}/og-image.png`;
  if (typeof img === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\//i.test(img)) image = img;
  else if (typeof id === 'string' && /^[a-z0-9]+$/i.test(id) && SB) image = `${SB}/storage/v1/object/public/report-photos/qcard-${id}.jpg`;
  const appUrl = `${SITE}/`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
  res.status(200).send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="LINDOL">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(appUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(appUrl)}">
<meta http-equiv="refresh" content="0;url=${esc(appUrl)}">
</head><body style="font-family:system-ui,sans-serif;background:#0c0907;color:#eee;padding:28px;text-align:center">
<p>Opening LINDOL…</p>
<p><a style="color:#E0521B" href="${esc(appUrl)}">Tap here</a> if it doesn't redirect.</p>
<script>location.replace(${JSON.stringify(appUrl)})</script>
</body></html>`);
}
