import { createClient } from "npm:@supabase/supabase-js@2";

const BBOX = "minlatitude=4.5&maxlatitude=9.5&minlongitude=124&maxlongitude=128";
const MIN_MAG = 4.5;
const ALERT_RADIUS_KM = 300; // only notify subscribers within this distance of the epicenter

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

Deno.serve(async () => {
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

    // Dynamic import inside try/catch so a load failure reports cleanly (not WORKER_ERROR).
    const webpush = (await import("npm:web-push@3.6.7")).default;
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);

    const sb = createClient(SB_URL!, SB_SERVICE_KEY!);

    const start = new Date(Date.now() - 30 * 60000).toISOString();
    const usgs = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&${BBOX}&minmagnitude=${MIN_MAG}&orderby=time`,
    ).then((r) => r.json());

    const { data: state } = await sb.from("alert_state").select("last_quake_time").eq("id", 1).single();
    const last = state?.last_quake_time ?? 0;

    const fresh = (usgs.features ?? [])
      .filter((f: any) => f.properties?.time > last)
      .sort((a: any, b: any) => a.properties.time - b.properties.time);

    if (fresh.length === 0) return json({ ok: true, sent: 0, note: "no new quakes" });

    const { data: subs } = await sb.from("push_subscriptions").select("*");
    let sent = 0;
    for (const f of fresh) {
      const [qlng, qlat] = f.geometry?.coordinates ?? [];
      const payload = JSON.stringify({
        title: `M${f.properties.mag.toFixed(1)} earthquake near you`,
        body: `${f.properties.place} — reported just now (USGS). Not an early warning.`,
        url: "https://lindol.app/",
      });
      for (const s of subs ?? []) {
        // Scope to subscribers near the epicenter; notify those without a stored location.
        if (s.lat != null && s.lng != null && qlat != null &&
            haversineKm(s.lat, s.lng, qlat, qlng) > ALERT_RADIUS_KM) continue;
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
    await sb.from("alert_state").update({ last_quake_time: fresh[fresh.length - 1].properties.time }).eq("id", 1);
    return json({ ok: true, quakes: fresh.length, sent });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
