// Lightweight list of recent events that have a measured max intensity (USGS ShakeMap `mmi`),
// so each quake record can show its own intensity. One USGS query - mmi is in the list response,
// no per-event detail fetches. Matched to the feed quakes client-side by time + location.
export default async function handler(req, res) {
  try {
    const start = new Date(Date.now() - 21 * 86400000).toISOString();
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}`
      + '&minmagnitude=5&minlatitude=4.5&maxlatitude=21.5&minlongitude=116&maxlongitude=127&orderby=time'; // national bbox (mirrors REGION.bbox)
    const j = await fetch(url).then((r) => r.json());
    const events = (j.features ?? [])
      // Prefer instrumental intensity (mmi); fall back to community "Did You Feel It" (cdi).
      .filter((f) => f.properties?.mmi != null || f.properties?.cdi != null)
      .map((f) => {
        const [lng, lat] = f.geometry?.coordinates ?? [];
        const mmi = f.properties.mmi ?? f.properties.cdi;
        return { mag: f.properties.mag, time: f.properties.time, lat, lng, mmi, felt: f.properties.mmi == null };
      })
      .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.time) && Number.isFinite(e.mmi));
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
    res.status(200).json({ events });
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json({ events: [] });
  }
}
