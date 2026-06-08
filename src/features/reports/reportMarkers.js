import L from 'leaflet';
import { categoryColor } from './reportSchema.js';

const ICON = { damage: '!', road: '=', fire: '~', help: '+', safe: '✓', other: '·' };

export function reportIcon(category) {
  const color = categoryColor(category);
  return L.divIcon({
    className: '', iconSize: [22, 22], iconAnchor: [11, 20],
    html: `<div class="rpin" style="background:${color}"><b>${ICON[category] ?? '·'}</b></div>`,
  });
}
