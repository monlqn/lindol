import { useShakemap } from '../features/quakes/useShakemap.js';
import { intensityAt, nearestTownIntensity, mmiRoman, mmiLabel, mmiColor } from '../lib/intensity.js';

function Card({ mmi, head, sub }) {
  const col = mmiColor(mmi);
  return (
    <div className="felt-you reveal" style={{ borderColor: col }}>
      <span className="fy-mmi" style={{ background: col }}>{mmiRoman(mmi)}</span>
      <div className="fy-body">
        <b>Intensity {mmiRoman(mmi)} · {mmiLabel(mmi)}</b> {head}
        <div className="fy-sub">{sub}</div>
      </div>
    </div>
  );
}

// How hard it shook where YOU are. Prefers the PHIVOLCS-reported intensity at the town nearest you
// (actual felt, the local authority); falls back to the USGS ShakeMap modeled value at your spot.
export default function FeltAtYou({ user, shakemaps = [] }) {
  const sm = useShakemap();
  if (!user) return null;

  const town = nearestTownIntensity(user, shakemaps);
  if (town && town.mmi >= 2) {
    return (
      <Card mmi={town.mmi} head="near you"
        sub={`Reported at ${town.place} (~${Math.round(town.distanceKm)} km away) by PHIVOLCS, from the M${town.mag.toFixed(1)}.`} />
    );
  }

  if (sm?.event && sm.contours?.length) {
    const mmi = intensityAt(user, sm.contours);
    if (mmi >= 2) {
      return (
        <Card mmi={mmi} head="at your location"
          sub={`from the M${sm.event.mag.toFixed(1)}. Modelled shaking (USGS ShakeMap).`} />
      );
    }
  }
  return null;
}
