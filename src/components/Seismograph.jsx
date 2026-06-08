import { useEffect, useRef } from 'react';
import { REGION } from '../config.js';

// Real seismograph: each spike is an ACTUAL recent quake (magnitude over time, USGS).
// A radar sweep travels across and lights up each real event as it passes; the biggest
// event pulses. The spikes are real data — only the sweep/pulse are animation.
export default function Seismograph({ quakes = [] }) {
  const ref = useRef(null);
  const dataRef = useRef(quakes);
  dataRef.current = quakes;

  useEffect(() => {
    const cv = ref.current;
    const cx = cv.getContext('2d');
    let raf, W, H, t = 0, sweep = 0;
    const dims = () => {
      const r = cv.getBoundingClientRect();
      cv.width = r.width * devicePixelRatio;
      cv.height = r.height * devicePixelRatio;
      cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      W = r.width; H = r.height;
    };
    dims();
    const windowMs = REGION.windowDays * 86400000;
    const spikeH = (mag, baseline) =>
      Math.min(baseline - 2, Math.max(3, ((mag - 2.5) / 5.5) * (baseline - 4)));

    const draw = () => {
      t++;
      const now = Date.now();
      const tStart = now - windowMs;
      const baseline = H * 0.64;
      cx.clearRect(0, 0, W, H);

      cx.strokeStyle = 'rgba(224,82,27,.1)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, baseline); cx.lineTo(W, baseline); cx.stroke();

      const qs = (dataRef.current || [])
        .filter((q) => q && typeof q.mag === 'number' && q.time >= tStart)
        .sort((a, b) => a.time - b.time);

      sweep = (sweep + 0.9) % (W + 60);

      let big = null;
      qs.forEach((q) => {
        if (!big || q.mag > big.mag) big = q;
        const x = ((q.time - tStart) / windowMs) * W;
        const h = spikeH(q.mag, baseline);
        const prox = Math.max(0, 1 - Math.abs(x - sweep) / 70); // glow when the sweep is near
        cx.strokeStyle = `rgba(224,82,27,${0.45 + 0.5 * prox})`;
        cx.lineWidth = 1.3 + prox * 1.4;
        cx.shadowColor = 'rgba(224,82,27,.75)'; cx.shadowBlur = 3 + prox * 12;
        cx.lineJoin = 'round';
        cx.beginPath();
        cx.moveTo(x - 3, baseline); cx.lineTo(x, baseline - h); cx.lineTo(x + 3, baseline);
        cx.stroke();
      });
      cx.shadowBlur = 0;

      if (big) {
        const x = ((big.time - tStart) / windowMs) * W;
        const h = spikeH(big.mag, baseline);
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.12);
        cx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`;
        cx.shadowColor = 'rgba(224,82,27,.9)'; cx.shadowBlur = 6 + pulse * 8;
        cx.beginPath(); cx.arc(x, baseline - h, 2.2, 0, 7); cx.fill();
        cx.shadowBlur = 0;
      }

      // radar sweep: trailing glow + bright leading line
      const grad = cx.createLinearGradient(sweep - 55, 0, sweep, 0);
      grad.addColorStop(0, 'rgba(224,82,27,0)');
      grad.addColorStop(1, 'rgba(224,82,27,.22)');
      cx.fillStyle = grad; cx.fillRect(sweep - 55, 0, 55, H);
      cx.strokeStyle = 'rgba(255,170,120,.5)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(sweep, 0); cx.lineTo(sweep, H); cx.stroke();

      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => dims();
    addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); };
  }, []);

  return <canvas className="seismo" ref={ref} />;
}
