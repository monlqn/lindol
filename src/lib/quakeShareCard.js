// Render a shareable square image of a quake on a real (satellite) map: tiles composited around
// the epicentre + a magnitude marker + intensity + details + LINDOL branding. Returns a File.
import { mmiRoman, mmiColor } from './intensity.js';

const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ROADS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const TS = 256;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImg(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

function loadTile(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function magColor(m) {
  return m >= 6 ? '#D81E34' : m >= 5 ? '#F0461E' : m >= 4 ? '#F5851B' : m >= 3 ? '#F2B01E' : '#E4C84A';
}

export async function renderQuakeCard(quake, { zoom = 9, size = 1080, mmi = null } = {}) {
  try {
    const z = zoom;
    const cx = lon2x(quake.lng, z) * TS; // centre in world pixels
    const cy = lat2y(quake.lat, z) * TS;
    const left = cx - size / 2;
    const top = cy - size / 2;

    // Ensure Sora (the app font) is loaded before drawing text to canvas.
    if (document.fonts?.load) {
      try { await Promise.all(['800 88px Sora', '700 40px Sora', '500 32px Sora'].map((f) => document.fonts.load(f))); } catch { /* fallback font */ }
    }

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, size, size);
    const logoP = loadImg('/icons/icon-192.png'); // start logo load in parallel with the tiles

    // Composite the tiles that cover the canvas, imagery first then place labels on top.
    const tx0 = Math.floor(left / TS); const tx1 = Math.floor((left + size) / TS);
    const ty0 = Math.floor(top / TS); const ty1 = Math.floor((top + size) / TS);
    const max = 2 ** z;
    const jobs = [];
    for (const layer of [TILE, ROADS]) {
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) {
          const xx = ((tx % max) + max) % max;
          if (ty < 0 || ty >= max) continue;
          const url = layer.replace('{z}', z).replace('{x}', xx).replace('{y}', ty);
          const dx = tx * TS - left; const dy = ty * TS - top;
          jobs.push(loadTile(url).then((img) => { if (img) ctx.drawImage(img, dx, dy, TS, TS); }));
        }
      }
    }
    await Promise.all(jobs);

    // Epicentre marker (centre).
    const mx = size / 2; const my = size / 2;
    const col = magColor(quake.mag);
    ctx.beginPath(); ctx.arc(mx, my, 82, 0, Math.PI * 2);
    ctx.fillStyle = `${col}33`; ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, 48, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 42px Sora, system-ui, sans-serif';
    ctx.fillText(quake.mag.toFixed(1), mx, my + 2);

    // Intensity badge (top-right) when this quake has measured intensity.
    const hasMmi = mmi != null && mmi >= 2;
    if (hasMmi) {
      const label = `INTENSITY ${mmiRoman(mmi)}`;
      ctx.font = '800 34px Sora, system-ui, sans-serif';
      const bw = ctx.measureText(label).width + 48; const bh = 66; const bx = size - bw - 40; const by = 40;
      ctx.fillStyle = mmiColor(mmi); roundRect(ctx, bx, by, bw, bh, 16); ctx.fill();
      ctx.fillStyle = '#161616'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + bw / 2, by + bh / 2 + 2);
    }

    // Bottom gradient + text.
    const gh = 430;
    const g = ctx.createLinearGradient(0, size - gh, 0, size);
    g.addColorStop(0, 'rgba(11,15,20,0)'); g.addColorStop(0.45, 'rgba(11,15,20,0.85)'); g.addColorStop(1, 'rgba(11,15,20,0.97)');
    ctx.fillStyle = g; ctx.fillRect(0, size - gh, size, gh);

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = col; ctx.font = '800 92px Sora, system-ui, sans-serif';
    ctx.fillText(`M${quake.mag.toFixed(1)} Earthquake`, 56, size - 268);
    ctx.fillStyle = '#fff'; ctx.font = '700 42px Sora, system-ui, sans-serif';
    const place = (quake.place || 'Philippines').slice(0, 44);
    ctx.fillText(place, 56, size - 200);
    ctx.fillStyle = 'rgba(255,255,255,.74)'; ctx.font = '500 32px Sora, system-ui, sans-serif';
    const when = new Date(quake.time).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const depth = quake.depthKm != null ? ` · ${Math.round(quake.depthKm)} km deep` : '';
    const intens = hasMmi ? ` · Intensity ${mmiRoman(mmi)}` : '';
    ctx.fillText(`${when}${depth}${intens}`, 56, size - 150);

    // Branding: logo + LINDOL + tagline.
    const logo = await logoP;
    let bx2 = 56;
    if (logo) { ctx.drawImage(logo, bx2, size - 102, 56, 56); bx2 += 70; }
    ctx.fillStyle = '#F0461E'; ctx.font = '800 46px Sora, system-ui, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText('LINDOL', bx2, size - 74);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = '500 30px Sora, system-ui, sans-serif';
    ctx.fillText('Live Philippine Earthquake Tracker · www.lindol.app', 56, size - 28);

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) return null;
    return new File([blob], `lindol-m${quake.mag.toFixed(1)}.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}
