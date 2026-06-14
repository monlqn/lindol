import { createClient } from "npm:@supabase/supabase-js@2";

// Background push alerts for significant quakes near a subscriber, fired even when the app
// is closed (invoked every minute by pg_cron - see supabase/alerts-cron.sql). Sources are
// complementary: PHIVOLCS (the local authority, via our own cached /api/phivolcs) is preferred,
// with USGS as the dependable backup. Threshold stays at M4.5+ so we never spam with small
// aftershocks. This is an awareness alert (arrives after detection), not early warning.
const BBOX = "minlatitude=4.5&maxlatitude=9.5&minlongitude=124&maxlongitude=128";
const MIN_MAG = 4.5;
const WINDOW_MS = 30 * 60000;

// "Felt" radius grows with magnitude - notify only subscribers who'd plausibly feel it.
function feltRadiusKm(mag: number) {
  if (mag >= 7) return 600;
  if (mag >= 6) return 350;
  if (mag >= 5) return 180;
  return 90;
}
const PHIVOLCS_API = "https://lindol.app/api/phivolcs?days=1&min=4.5";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Q = { time: number; mag: number; place: string; lat: number; lng: number; source: string };

// Same physical quake if close in time, place and magnitude (de-dupes USGS vs PHIVOLCS).
function sameQuake(a: Q, b: Q) {
  if (Math.abs(a.time - b.time) > 90000) return false;
  if (Math.abs(a.mag - b.mag) > 1.2) return false;
  return haversineKm(a.lat, a.lng, b.lat, b.lng) <= 80;
}

async function fetchUsgs(): Promise<Q[]> {
  try {
    const start = new Date(Date.now() - WINDOW_MS).toISOString();
    const j = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&${BBOX}&minmagnitude=${MIN_MAG}&orderby=time`,
    ).then((r) => r.json());
    return (j.features ?? []).map((f: any) => {
      const [lng, lat] = f.geometry?.coordinates ?? [];
      return { time: f.properties?.time, mag: f.properties?.mag, place: f.properties?.place ?? "Philippines", lat, lng, source: "USGS" };
    }).filter((q: Q) => Number.isFinite(q.time) && Number.isFinite(q.mag) && Number.isFinite(q.lat));
  } catch {
    return [];
  }
}

async function fetchPhivolcs(): Promise<Q[]> {
  try {
    const j = await fetch(PHIVOLCS_API).then((r) => r.json());
    const cutoff = Date.now() - WINDOW_MS;
    return (j.quakes ?? [])
      .map((q: any) => ({ time: q.time, mag: q.mag, place: q.place ?? "Philippines", lat: q.lat, lng: q.lng, source: "PHIVOLCS" }))
      .filter((q: Q) => Number.isFinite(q.time) && Number.isFinite(q.mag) && Number.isFinite(q.lat) && q.time >= cutoff);
  } catch {
    return [];
  }
}

async function fetchEmsc(): Promise<Q[]> {
  try {
    const start = new Date(Date.now() - WINDOW_MS).toISOString();
    const j = await fetch(
      `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&start=${start}&minlat=4.5&maxlat=9.5&minlon=124&maxlon=128&minmag=${MIN_MAG}&orderby=time&limit=50`,
    ).then((r) => r.json());
    return (j.features ?? []).map((f: any) => {
      const pr = f.properties ?? {};
      const c = f.geometry?.coordinates ?? [];
      return {
        time: typeof pr.time === "string" ? Date.parse(pr.time) : pr.time,
        mag: pr.mag, place: pr.flynn_region ?? "Philippines", lat: c[1] ?? pr.lat, lng: c[0] ?? pr.lon, source: "EMSC",
      };
    }).filter((q: Q) => Number.isFinite(q.time) && Number.isFinite(q.mag) && Number.isFinite(q.lat));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const SB_URL = Deno.env.get("SB_URL");
    const SB_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY");
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC");
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE");
    const subjRaw = Deno.env.get("VAPID_SUBJECT") || "alerts@lindol.app";
    const VAPID_SUBJECT = /^(mailto:|https?:)/.test(subjRaw) ? subjRaw : "mailto:" + subjRaw;

    const missing = Object.entries({ SB_URL, SB_SERVICE_KEY, VAPID_PUBLIC, VAPID_PRIVATE })
      .filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) return json({ error: "Missing secrets: " + missing.join(", ") }, 500);

    // The function URL is public; only the pg_cron job (which sends the service_role key,
    // see alerts-cron.sql) may trigger pushes or advance the alert watermark.
    if (req.headers.get("authorization") !== `Bearer ${SB_SERVICE_KEY}`) {
      return json({ error: "unauthorized" }, 401);
    }

    const webpush = (await import("npm:web-push@3.6.7")).default;
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);

    const sb = createClient(SB_URL!, SB_SERVICE_KEY!);

    const { data: state } = await sb.from("alert_state").select("last_quake_time").eq("id", 1).single();
    const last = state?.last_quake_time ?? 0;

    // PHIVOLCS first so it wins on duplicates; USGS + EMSC fill anything it didn't report.
    // EMSC included so the push catches its fast detections too (closes the alarm-vs-push gap).
    const [phiv, usgs, emsc] = await Promise.all([fetchPhivolcs(), fetchUsgs(), fetchEmsc()]);
    const merged: Q[] = [...phiv];
    for (const u of [...usgs, ...emsc]) if (!merged.some((m) => sameQuake(m, u))) merged.push(u);

    const fresh = merged.filter((q) => q.time > last).sort((a, b) => a.time - b.time);
    // Include source counts even when idle, so the deployed version is verifiable at a glance.
    if (fresh.length === 0) {
      return json({ ok: true, sent: 0, note: "no new quakes", sources: { phivolcs: phiv.length, usgs: usgs.length, emsc: emsc.length } });
    }

    // Advance the watermark to the newest event seen this run (pre-send) so a duplicate from
    // the other source can't re-trigger on the next run.
    const maxTime = fresh.reduce((m, q) => Math.max(m, q.time), last);

    const { data: subs } = await sb.from("push_subscriptions").select("*");
    let sent = 0;
    for (const q of fresh) {
      const payload = JSON.stringify({
        title: `M${q.mag.toFixed(1)} earthquake near you`,
        body: `${q.place} - reported just now (${q.source}). Not an early warning.`,
        url: "https://lindol.app/",
      });
      for (const s of subs ?? []) {
        if (s.lat != null && s.lng != null && q.lat != null &&
            haversineKm(s.lat, s.lng, q.lat, q.lng) > feltRadiusKm(q.mag)) continue;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
    }
    await sb.from("alert_state").update({ last_quake_time: maxTime }).eq("id", 1);
    return json({ ok: true, quakes: fresh.length, sources: { phivolcs: phiv.length, usgs: usgs.length, emsc: emsc.length }, sent });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
