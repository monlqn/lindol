import { renderQuakeCard } from './quakeShareCard.js';
import { getShareImageFile } from './share.js';
import { uploadPhoto } from '../features/reports/reportsApi.js';
import { supabase } from './supabase.js';
import { relativeTime } from './time.js';

// Share a quake: render the map card, upload it, and share a per-quake link whose Open Graph
// image is that card - so Facebook (which ignores attached images) shows the card too.
export async function shareQuake(quake, mmi = null) {
  if (!quake) return;
  const text = `M${quake.mag.toFixed(1)} earthquake · ${quake.place} · ${relativeTime(quake.time)}. Live Philippine Earthquake Tracker on LINDOL.`;
  let url = 'https://lindol.app/';
  const file = await renderQuakeCard(quake, { mmi });
  if (file && supabase) {
    try {
      const safeId = String(quake.id).replace(/[^a-z0-9]/gi, '').slice(0, 40) || `${Math.round(quake.time)}`;
      await uploadPhoto(supabase, file, `qcard-${safeId}`); // /q rebuilds the image URL from the id
      const p = new URLSearchParams({ id: safeId, m: quake.mag.toFixed(1), p: quake.place || 'Philippines', t: String(quake.time) });
      url = `https://lindol.app/q?${p.toString()}`;
    } catch { /* upload failed - fall back to base url */ }
  }
  const f = file || (await getShareImageFile());
  try {
    if (f && navigator.share && navigator.canShare?.({ files: [f] })) {
      await navigator.share({ title: 'LINDOL earthquake', text: `${text} ${url}`, files: [f] });
    } else if (navigator.share) {
      await navigator.share({ title: 'LINDOL earthquake', text, url });
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
    }
  } catch { /* cancelled */ }
}
