import { categoryColor, CATEGORIES } from '../features/reports/reportSchema.js';
import { relativeTime } from './time.js';
import { formatKm } from './geo.js';

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y, x + w, y + h, r);
  cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r);
  cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCover(cx, img, x, y, w, h) {
  const ir = img.width / img.height, r = w / h;
  let sw, sh, sx, sy;
  if (ir > r) { sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
  cx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapLines(cx, text, maxW, maxLines) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  let truncated = false;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (cx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) { truncated = i < words.length - 1; line = ''; break; }
    } else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (cx.measureText(`${last}…`).width > maxW && last.length) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

// Render a share card (1080×1350) from an actual citizen report: its photo, category,
// note, location and time, with LINDOL branding. Returns a File, or null on failure.
export async function renderReportCard(report) {
  try {
    if (typeof document === 'undefined' || !report) return null;
    try { await document.fonts?.ready; } catch { /* fonts optional */ }

    const W = 1080, H = 1350, M = 64, PH = 720; // photo height
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    const font = (w, s) => `${w} ${s}px Sora, Arial, sans-serif`;
    const color = categoryColor(report.category);
    const label = LABEL[report.category] ?? 'Report';

    // background
    const bg = cx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#16120D'); bg.addColorStop(1, '#0C0907');
    cx.fillStyle = bg; cx.fillRect(0, 0, W, H);

    // photo (or a category-colored block if none)
    const img = report.photoUrl ? await loadImage(report.photoUrl) : null;
    if (img) {
      drawCover(cx, img, 0, 0, W, PH);
      const scrim = cx.createLinearGradient(0, PH - 220, 0, PH);
      scrim.addColorStop(0, 'rgba(12,9,7,0)'); scrim.addColorStop(1, 'rgba(12,9,7,.85)');
      cx.fillStyle = scrim; cx.fillRect(0, PH - 220, W, 220);
    } else {
      cx.fillStyle = color; cx.fillRect(0, 0, W, PH);
      cx.fillStyle = 'rgba(255,255,255,.92)'; cx.font = font(800, 64);
      cx.textAlign = 'center'; cx.fillText(label.toUpperCase(), W / 2, PH / 2 + 20);
      cx.textAlign = 'left';
    }

    // LINDOL chip over the photo (top-left)
    cx.fillStyle = 'rgba(12,9,7,.66)';
    roundRect(cx, M, 48, 196, 56, 28); cx.fill();
    cx.fillStyle = '#E0521B'; cx.beginPath(); cx.arc(M + 32, 76, 9, 0, 7); cx.fill();
    cx.fillStyle = '#fff'; cx.font = font(800, 26); cx.textBaseline = 'middle';
    cx.fillText('LINDOL', M + 52, 78); cx.textBaseline = 'alphabetic';

    // category badge
    cx.font = font(800, 30);
    const bw = cx.measureText(label.toUpperCase()).width + 44;
    cx.fillStyle = color; roundRect(cx, M, 770, bw, 56, 28); cx.fill();
    cx.fillStyle = '#fff'; cx.textBaseline = 'middle';
    cx.fillText(label.toUpperCase(), M + 22, 799); cx.textBaseline = 'alphabetic';

    // note
    cx.fillStyle = '#F4EEE3'; cx.font = font(600, 44);
    const note = report.note || 'Citizen report';
    const lines = wrapLines(cx, note, W - M * 2, 5);
    let y = 900;
    for (const ln of lines) { cx.fillText(ln, M, y); y += 58; }

    // meta (location · distance · time)
    const parts = [
      `${report.lat.toFixed(3)}, ${report.lng.toFixed(3)}`,
      report.distanceKm != null ? `${formatKm(report.distanceKm)} away` : null,
      relativeTime(report.createdAt),
    ].filter(Boolean);
    cx.fillStyle = '#B6AC9C'; cx.font = font(600, 30);
    cx.fillText(parts.join('   ·   '), M, 1218);

    // footer: wordmark + url + accent line
    cx.strokeStyle = 'rgba(224,82,27,.7)'; cx.lineWidth = 4; cx.lineCap = 'round';
    cx.beginPath();
    cx.moveTo(0, 1290); cx.lineTo(640, 1290); cx.lineTo(672, 1264);
    cx.lineTo(700, 1320); cx.lineTo(732, 1290); cx.lineTo(W, 1290); cx.stroke();

    cx.font = font(800, 40); cx.textBaseline = 'alphabetic';
    let x = M;
    const seg = (t, c) => { cx.fillStyle = c; cx.fillText(t, x, H - 46); x += cx.measureText(t).width; };
    seg('LIND', '#F4EEE3'); seg('O', '#E0521B'); seg('L', '#F4EEE3');
    cx.fillStyle = '#E0521B'; cx.font = font(800, 34); cx.textAlign = 'right';
    cx.fillText('lindol.app', W - M, H - 48); cx.textAlign = 'left';

    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (!blob) return null;
    return new File([blob], 'lindol-report.png', { type: 'image/png' });
  } catch {
    return null;
  }
}
