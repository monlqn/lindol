// Render a shareable "Community Responder" recognition card (1080x1080) for a user's
// level + points + impact. Returns a File, or null on failure.
function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y, x + w, y + h, r);
  cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r);
  cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

export async function renderResponderCard({ nickname, levelName, levelIcon, points, stats } = {}) {
  try {
    if (typeof document === 'undefined') return null;
    try { await document.fonts?.ready; } catch { /* fonts optional */ }
    const S = 1080;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    const font = (w, s) => `${w} ${s}px Sora, Arial, sans-serif`;

    const bg = cx.createLinearGradient(0, 0, S * 0.4, S);
    bg.addColorStop(0, '#1A150F'); bg.addColorStop(1, '#0C0907');
    cx.fillStyle = bg; cx.fillRect(0, 0, S, S);

    cx.textAlign = 'center';

    // brand
    cx.font = font(800, 40);
    let x = S / 2 - cx.measureText('LINDOL').width / 2;
    cx.textAlign = 'left';
    const seg = (t, c) => { cx.fillStyle = c; cx.fillText(t, x, 150); x += cx.measureText(t).width; };
    seg('LIND', '#F4EEE3'); seg('O', '#E0521B'); seg('L', '#F4EEE3');

    cx.textAlign = 'center';
    cx.font = font(600, 26); cx.fillStyle = '#B6AC9C';
    cx.fillText('COMMUNITY RESPONDER', S / 2, 205);

    // level icon in a ring
    cx.fillStyle = '#1E1812';
    cx.beginPath(); cx.arc(S / 2, 410, 130, 0, 7); cx.fill();
    cx.strokeStyle = '#E0521B'; cx.lineWidth = 6; cx.stroke();
    cx.font = font(800, 130); cx.fillText(levelIcon || '🌱', S / 2, 458);

    // level name + nickname
    cx.font = font(800, 78); cx.fillStyle = '#F4EEE3';
    cx.fillText(levelName || 'Newcomer', S / 2, 620);
    cx.font = font(600, 40); cx.fillStyle = '#E0521B';
    cx.fillText(nickname || 'Anonymous', S / 2, 678);

    // points pill
    cx.fillStyle = '#E0521B';
    const pts = `${points || 0} points`;
    cx.font = font(800, 44);
    const pw = cx.measureText(pts).width + 70;
    roundRect(cx, S / 2 - pw / 2, 720, pw, 78, 39); cx.fill();
    cx.fillStyle = '#fff'; cx.fillText(pts, S / 2, 774);

    // impact line
    if (stats) {
      cx.font = font(600, 32); cx.fillStyle = '#B6AC9C';
      const line = `${stats.verifiedReports || 0} verified reports  ·  ${stats.confirmsGiven || 0} confirms given`;
      cx.fillText(line, S / 2, 880);
    }

    cx.font = font(800, 38); cx.fillStyle = '#E0521B';
    cx.fillText('lindol.app', S / 2, 1000);

    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (!blob) return null;
    return new File([blob], 'lindol-responder.png', { type: 'image/png' });
  } catch {
    return null;
  }
}
