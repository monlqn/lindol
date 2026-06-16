// Real shaking-intensity contours (USGS ShakeMap MMI) for the LATEST significant Philippine quake.
// Intensity = how hard the ground actually shook at each location (modeled from the fault, depth and
// soil) - the authoritative version of our estimated felt circles. ShakeMaps exist only for
// significant events (~M5.5+), so this follows the most recent one with a ShakeMap, not the all-time
// strongest (which would pin the overlay to the M7.8 mainshock long after newer quakes).
// National bbox, mirroring REGION.bbox in src/config.js so the intensity overlay covers the same
// area as the feed (not just Mindanao - Luzon/Visayas significant quakes need ShakeMaps too).
const REGION_Q = 'minlatitude=4.5&maxlatitude=21.5&minlongitude=116&maxlongitude=127';

// From newest-first candidates, take the most recent that actually has a ShakeMap product (newer
// quakes may not have one generated yet); fall back to the most recent event. Bounded to 6 newest.
export function pickShakemapEvent(features = []) {
  const feats = (features || []).slice(0, 6);
  return feats.find((f) => (f.properties?.types || '').includes('shakemap')) || feats[0] || null;
}

async function latestEventWithShakemap() {
  const start = new Date(Date.now() - 21 * 86400000).toISOString();
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}`
    + `&minmagnitude=5.5&${REGION_Q}&orderby=time`;
  const j = await (await fetch(url)).json();
  return pickShakemapEvent(j.features);
}

export default async function handler(req, res) {
  try {
    const f = await latestEventWithShakemap();
    if (!f) {
      res.setHeader('Cache-Control', 'public, s-maxage=600');
      return res.status(200).json({ event: null, contours: [] });
    }
    const d = await (await fetch(f.properties.detail)).json();
    const sm = d.properties.products?.shakemap?.[0];
    const contUrl = sm?.contents?.['download/cont_mmi.json']?.url;
    let contours = [];
    if (contUrl) {
      const g = await (await fetch(contUrl)).json();
      contours = (g.features || []).map((ft) => ({
        value: ft.properties.value,
        color: ft.properties.color,
        // MultiLineString -> array of lines, each line an array of [lng, lat].
        lines: ft.geometry.type === 'MultiLineString' ? ft.geometry.coordinates : [ft.geometry.coordinates],
      }));
    }
    const [lng, lat] = f.geometry.coordinates;
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      event: { mag: f.properties.mag, place: f.properties.place, time: f.properties.time, maxmmi: sm?.properties?.maxmmi ?? null, lat, lng },
      contours,
    });
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    return res.status(200).json({ event: null, contours: [], error: 'fetch_failed' });
  }
}
