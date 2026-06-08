import { useEffect, useRef } from 'react';
import { REGION } from '../config.js';

// Real seismograph: plots ACTUAL recent quakes (magnitude over time) from USGS.
// `quakes`: array of { time (epoch ms), mag }. A radar sweep adds liveness; the spikes are real data.
export default function Seismograph({ quakes = [] }) {
  const ref = useRef(null);
  const dataRef = useRef(quakes);
  dataRef.current = quakes;

  useEffect(() => {
    const cv = ref.current;
    const cx = cv.getContext('2d');
    let raf, W, H;
    const dims = () => {
      const r = cv.getBoundingClientRect();
      cv.width = r.width * devicePixelRatio;
      cv.height = r.height * devicePixelRatio;
      cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      W = r.width; H = r.height;
    };
    dims();
    const windowMs = REGION.windowDays * 86400000;
    let sweep = 0;

    const draw = () => {
      const now = Date.now();
      const tStart = now - windowMs;
      const baseline = H * 0.62;
      cx.clearRect(0, 0, W, H);

      cx.strokeStyle = 'rgba(224,82,27,.12)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, baseline); cx.lineTo(W, baseline); cx.stroke();

      const qs = (dataRef.current || [])
        .filter((q) => q && typeof q.mag === 'number' && q.time >= tStart)
        .sort((a, b) => a.time - b.time);

      const spikeH = (mag) => Math.min(baseline - 2, Math.max(3, ((mag - 2.5) / 5.5) * (baseline - 4)));

      cx.beginPath();
      cx.moveTo(0, baseline);
      qs.forEach((q) => {
        const x = ((q.time - tStart) / windowMs) * W;
        const h = spikeH(q.mag);
        cx.lineTo(x - 3, baseline);
        cx.lineTo(x, baseline - h);
        cx.lineTo(x + 3, baseline);
      });
      cx.lineTo(W, baseline);
      cx.strokeStyle = '#E0521B'; cx.lineWidth = 1.6;
      cx.shadowColor = 'rgba(224,82,27,.55)'; cx.shadowBlur = 6;
      cx.lineJoin = 'round'; cx.stroke(); cx.shadowBlur = 0;

      if (qs.length) {
        const big = qs.reduce((m, q) => (q.mag > m.mag ? q : m), qs[0]);
        const x = ((big.time - tStart) / windowMs) * W;
        cx.fillStyle = '#fff';
        cx.beginPath(); cx.arc(x, baseline - spikeH(big.mag), 1.8, 0, 7); cx.fill();
      }

      sweep = (sweep + 0.6) % (W + 40);
      const grad = cx.createLinearGradient(sweep - 40, 0, sweep, 0);
      grad.addColorStop(0, 'rgba(224,82,27,0)');
      grad.addColorStop(1, 'rgba(224,82,27,.16)');
      cx.fillStyle = grad;
      cx.fillRect(sweep - 40, 0, 40, H);

      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => dims();
    addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); };
  }, []);

  return <canvas className="seismo" ref={ref} />;
}
