// Server-rendered Open Graph tags for a single report, so Facebook (which scrapes the
// link instead of honoring a shared image) shows the report's real photo + details.
// Humans are redirected into the app at /?r=<id>; crawlers read the meta tags.
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SITE = 'https://lindol.app';
const LABEL = {
  damage: 'Damage', road: 'Road damage', fire: 'Fire',
  help: 'Need help', safe: 'Safe report', other: 'Report',
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  const appUrl = `${SITE}/?r=${encodeURIComponent(id)}`;
  let title = 'Citizen report on LINDOL';
  let desc = 'Live earthquakes, aftershocks & citizen reports for the Philippines.';
  let image = `${SITE}/og-image.png`;

  try {
    if (SB_URL && SB_KEY && /^[0-9a-f-]{10,}$/i.test(id)) {
      const r = await fetch(
        `${SB_URL}/rest/v1/reports?id=eq.${id}&select=category,note,lat,lng,photo_url&limit=1`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
      );
      const rows = await r.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        const cat = LABEL[row.category] || 'Report';
        title = `${cat} reported on LINDOL`;
        const loc = (row.lat != null && row.lng != null)
          ? ` near ${Number(row.lat).toFixed(2)}, ${Number(row.lng).toFixed(2)}` : '';
        desc = `${row.note ? `${row.note} - ` : ''}Citizen report${loc}. See it live on LINDOL.`;
        if (row.photo_url) image = row.photo_url;
      }
    }
  } catch { /* fall back to generic OG */ }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
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
<p>Opening LINDOL...</p>
<p><a style="color:#E0521B" href="${esc(appUrl)}">Tap here</a> if it doesn't redirect.</p>
<script>location.replace(${JSON.stringify(appUrl)})</script>
</body></html>`);
}
