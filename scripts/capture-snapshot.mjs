// One-off snapshot of the M7.8 Sarangani sequence + concurrent PH seismicity.
// PHIVOLCS is perishable (live scrape, no archive), so we freeze it now by scraping the
// bulletin directly with the same TLS bypass the serverless proxy uses (reusing parseBulletin).
// USGS/EMSC are archived upstream but captured too so the snapshot is self-sufficient.
// Run: node scripts/capture-snapshot.mjs
import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBulletin } from '../api/phivolcs.js';
import { parseQuakes } from '../src/features/quakes/quakeApi.js';
import { parseEmscQuakes } from '../src/features/quakes/emscApi.js';
import { mergeQuakes } from '../src/features/quakes/quakeMerge.js';

const START = '2026-06-07';          // a day before the 8 June mainshock, to be safe
const BBOX = { minLat: 4.5, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 };
const MIN = 2.0;
const PHIVOLCS_HOST = 'earthquake.phivolcs.dost.gov.ph';
const BULLETIN = 'https://earthquake.phivolcs.dost.gov.ph/';

// Same fetch the proxy uses: skip the (invalid) cert for the PHIVOLCS host only, follow redirects.
function getHtml(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      rejectUnauthorized: new URL(url).hostname !== PHIVOLCS_HOST,
      headers: { 'user-agent': 'Mozilla/5.0 (LINDOL/1.0; +https://lindol.app)' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 3) {
        res.resume(); resolve(getHtml(new URL(res.headers.location, url).href, redirects + 1)); return;
      }
      let data = ''; res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        } else {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson`
  + `&starttime=${START}&minlatitude=${BBOX.minLat}&maxlatitude=${BBOX.maxLat}`
  + `&minlongitude=${BBOX.minLng}&maxlongitude=${BBOX.maxLng}&minmagnitude=${MIN}&orderby=time`;
const emscUrl = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json`
  + `&starttime=${START}&minlatitude=${BBOX.minLat}&maxlatitude=${BBOX.maxLat}`
  + `&minlongitude=${BBOX.minLng}&maxlongitude=${BBOX.maxLng}&minmagnitude=${MIN}&orderby=time&limit=2000`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  let usgs = [], emsc = [], phiv = [];
  try { usgs = parseQuakes(await getJson(usgsUrl)); }
  catch (e) { console.warn('USGS failed:', e.message); }
  try { emsc = parseEmscQuakes(await getJson(emscUrl)); }
  catch (e) { console.warn('EMSC failed:', e.message); }
  try {
    const cutoff = Date.parse(START);
    phiv = parseBulletin(await getHtml(BULLETIN)).filter((q) => q.time >= cutoff && q.mag >= MIN);
  } catch (e) { console.warn('PHIVOLCS failed:', e.message); }
  // PHIVOLCS first so it wins on value, same precedence as the live app.
  const merged = mergeQuakes(mergeQuakes(phiv, usgs), emsc);
  merged.sort((a, b) => b.time - a.time);
  if (merged.length < 50) {
    console.error(`Only ${merged.length} quakes captured. Refusing to overwrite the snapshot with a suspiciously small result.`);
    process.exit(1);
  }
  const outDir = join(dirname(fileURLToPath(import.meta.url)), '../src/features/quakes/snapshots');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sarangani-2026-06.json'), JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} quakes (PHIVOLCS ${phiv.length}, USGS ${usgs.length}, EMSC ${emsc.length}).`);
}
main();
