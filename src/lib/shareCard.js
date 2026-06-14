// Render a clean, CURRENT share card (1080×1080) on a canvas and return it as a File
// to attach to a Web Share. Shows live data (quake count + latest event) so every
// share looks fresh. Returns null on any failure so callers fall back to the static banner.
import { REGION } from '../config.js';

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y, x + w, y + h, r);
  cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r);
  cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

export async function renderShareCard({ count = 0, latestMag = null, latestPlace = '' } = {}) {
  try {
    if (typeof document === 'undefined') return null;
    try { await document.fonts?.ready; } catch { /* fonts are optional */ }

    const S = 1080;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const cx = cv.getContext('2d');
    if (!cx) return null;

    const M = 88;
    const font = (w, s) => `${w} ${s}px Sora, Arial, sans-serif`;

    // background
    const bg = cx.createLinearGradient(0, 0, S * 0.4, S);
    bg.addColorStop(0, '#1A150F');
    bg.addColorStop(1, '#0C0907');
    cx.fillStyle = bg;
    cx.fillRect(0, 0, S, S);

    // LIVE pill
    cx.fillStyle = '#E0521B';
    roundRect(cx, M, 104, 156, 52, 26); cx.fill();
    cx.fillStyle = '#fff';
    cx.beginPath(); cx.arc(M + 32, 130, 8, 0, 7); cx.fill();
    cx.font = font(800, 25); cx.textBaseline = 'middle';
    cx.fillText('LIVE', M + 52, 132);

    // wordmark (ember O)
    cx.textBaseline = 'alphabetic';
    cx.font = font(800, 156);
    const wy = 340;
    let x = M;
    const seg = (t, color) => { cx.fillStyle = color; cx.fillText(t, x, wy); x += cx.measureText(t).width; };
    seg('LIND', '#F4EEE3'); seg('O', '#E0521B'); seg('L', '#F4EEE3');

    // tagline
    cx.font = font(600, 39); cx.fillStyle = '#B6AC9C';
    cx.fillText('Philippines · Live Earthquake Watch', M, wy + 74);

    // live stat
    cx.font = font(800, 168); cx.fillStyle = '#E0521B';
    cx.fillText(String(count), M, wy + 320);
    cx.font = font(600, 35); cx.fillStyle = '#E7DFD2';
    cx.fillText(`earthquakes tracked · last ${REGION.windowDays} days`, M, wy + 372);

    if (latestMag != null && Number.isFinite(Number(latestMag))) {
      cx.font = font(700, 40); cx.fillStyle = '#F4EEE3';
      const place = String(latestPlace || '').slice(0, 40);
      cx.fillText(`Latest: M${Number(latestMag).toFixed(1)}  ${place}`, M, wy + 452);
    }

    // seismograph trace
    cx.strokeStyle = 'rgba(224,82,27,.75)';
    cx.lineWidth = 5; cx.lineJoin = 'round'; cx.lineCap = 'round';
    cx.beginPath();
    const ty = 946;
    cx.moveTo(0, ty);
    cx.lineTo(360, ty); cx.lineTo(410, ty - 26); cx.lineTo(452, ty - 128);
    cx.lineTo(486, ty + 96); cx.lineTo(528, ty); cx.lineTo(S, ty);
    cx.stroke();

    // url
    cx.font = font(800, 46); cx.fillStyle = '#E0521B';
    cx.fillText('lindol.app', M, 1012);

    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (!blob) return null;
    return new File([blob], 'lindol.png', { type: 'image/png' });
  } catch {
    return null;
  }
}
