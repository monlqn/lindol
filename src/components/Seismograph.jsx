import { useEffect, useRef } from 'react';

export default function Seismograph() {
  const ref = useRef(null);
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
    const N = 160, pts = Array(N).fill(0);
    let t = 0, spikeT = 40;
    const step = () => {
      t++;
      let v = (Math.sin(t * 0.18) + Math.sin(t * 0.37)) * 0.06 + (Math.random() - 0.5) * 0.08;
      spikeT--; if (spikeT <= 0) spikeT = 60 + Math.random() * 120;
      if (spikeT < 6) v += (Math.random() - 0.5) * (spikeT / 6) * 1.7;
      pts.push(v); if (pts.length > N) pts.shift();
      cx.clearRect(0, 0, W, H);
      cx.strokeStyle = 'rgba(224,82,27,.12)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, H / 2); cx.lineTo(W, H / 2); cx.stroke();
      cx.beginPath();
      pts.forEach((p, i) => {
        const x = (i / (N - 1)) * W, y = H / 2 - p * H * 0.46;
        i ? cx.lineTo(x, y) : cx.moveTo(x, y);
      });
      cx.strokeStyle = '#E0521B'; cx.lineWidth = 1.6;
      cx.shadowColor = 'rgba(224,82,27,.6)'; cx.shadowBlur = 6;
      cx.lineJoin = 'round'; cx.stroke(); cx.shadowBlur = 0;
      raf = requestAnimationFrame(step);
    };
    step();
    const onResize = () => dims();
    addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); };
  }, []);
  return <canvas className="seismo" ref={ref} />;
}
