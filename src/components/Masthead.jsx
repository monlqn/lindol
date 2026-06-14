import Seismograph from './Seismograph.jsx';
import { REGION } from '../config.js';

export default function Masthead({ quakes = [] }) {
  return (
    <header className="masthead">
      <div className="brandrow">
        <div className="wordmark" aria-label="LINDOL">
          <span aria-hidden="true">LIND<span className="epi-o"><i /></span>L</span>
        </div>
        <div className="tagline">Philippines · live earthquake watch</div>
      </div>
      <Seismograph quakes={quakes} />
      <div className="seismo-cap">{quakes.length} quakes · last {REGION.windowDays} days · USGS</div>
    </header>
  );
}
