import { useEffect, useRef } from 'react';
import { REGION } from '../config.js';

// Real seismograph: each sharp spike is an ACTUAL recent quake (USGS), riding on a
// gently-flowing ambient noise floor (what a live seismometer shows at rest). A radar
// sweep scans across and the most recent quake pulses - alive, but the events are real.
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
      Math.min(baseline - 2, Math.max(4, ((mag - 2.5) / 5.5) * (baseline - 6)));

    const draw = () => {
      t += 1;
      const now = Date.now();
      const tStart = now - windowMs;
      const baseline = H * 0.64;
      cx.clearRect(0, 0, W, H);

      const qs = (dataRef.current || []).filter((q) => q && typeof q.mag === 'number' && q.time >= tStart);
      const qx = qs.map((q) => ({ x: ((q.time - tStart) / windowMs) * W, h: spikeH(q.mag, baseline), time: q.time }));
      let newest = null;
      for (const item of qx) if (!newest || item.time > newest.time) newest = item;

      sweep = (sweep + 1.1) % (W + 60);

      // one continuous trace: flowing ambient noise floor + sharp real-event spikes
      cx.beginPath();
      for (let x = 0; x <= W; x += 1.4) {
        const noise = (Math.sin(x * 0.05 + t * 0.06) + Math.sin(x * 0.11 - t * 0.035) * 0.6) * (H * 0.018);
        let spike = 0;
        for (const item of qx) {
          const d = Math.abs(x - item.x);
          if (d < 4) spike = Math.max(spike, item.h * (1 - d / 4));
        }
        const y = baseline + noise - spike;
        if (x === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
      }
      cx.strokeStyle = '#E0521B';
      cx.lineWidth = 1.5;
      cx.lineJoin = 'round';
      cx.shadowColor = 'rgba(224,82,27,.6)';
      cx.shadowBlur = 5;
      cx.stroke();
      cx.shadowBlur = 0;

      // the most recent quake pulses (the "live" event)
      if (newest) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.13);
        cx.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * pulse})`;
        cx.shadowColor = 'rgba(224,82,27,.9)';
        cx.shadowBlur = 6 + pulse * 10;
        cx.beginPath(); cx.arc(newest.x, baseline - newest.h, 2.2, 0, 7); cx.fill();
        cx.shadowBlur = 0;
      }

      // radar sweep: trailing glow + bright leading line
      const grad = cx.createLinearGradient(sweep - 60, 0, sweep, 0);
      grad.addColorStop(0, 'rgba(224,82,27,0)');
      grad.addColorStop(1, 'rgba(224,82,27,.28)');
      cx.fillStyle = grad;
      cx.fillRect(sweep - 60, 0, 60, H);
      cx.strokeStyle = 'rgba(255,180,130,.65)';
      cx.lineWidth = 1.2;
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
