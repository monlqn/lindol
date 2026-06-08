import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SB_URL")!, Deno.env.get("SB_SERVICE_KEY")!);
webpush.setVapidDetails(
  "mailto:" + (Deno.env.get("VAPID_SUBJECT") || "alerts@lindol.app"),
  Deno.env.get("VAPID_PUBLIC")!,
  Deno.env.get("VAPID_PRIVATE")!,
);

const BBOX = "minlatitude=4.5&maxlatitude=9.5&minlongitude=124&maxlongitude=128";
const MIN_MAG = 4.5;

Deno.serve(async () => {
  const start = new Date(Date.now() - 30 * 60000).toISOString();
  const usgs = await fetch(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&${BBOX}&minmagnitude=${MIN_MAG}&orderby=time`,
  ).then((r) => r.json());

  const { data: state } = await sb.from("alert_state").select("last_quake_time").eq("id", 1).single();
  const last = state?.last_quake_time ?? 0;

  const fresh = (usgs.features ?? [])
    .filter((f: any) => f.properties?.time > last)
    .sort((a: any, b: any) => a.properties.time - b.properties.time);
  if (fresh.length === 0) return new Response("no new", { status: 200 });

  const { data: subs } = await sb.from("push_subscriptions").select("*");
  for (const f of fresh) {
    const payload = JSON.stringify({
      title: `M${f.properties.mag.toFixed(1)} aftershock reported`,
      body: `${f.properties.place} — reported just now (USGS). Not an early warning.`,
      url: "https://lindol.app/",
    });
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (e: any) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
  }
  const newest = fresh[fresh.length - 1].properties.time;
  await sb.from("alert_state").update({ last_quake_time: newest }).eq("id", 1);
  return new Response(`sent for ${fresh.length} quake(s)`, { status: 200 });
});
