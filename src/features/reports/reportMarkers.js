import L from 'leaflet';
import { categoryColor } from './reportSchema.js';

// A clean teardrop map pin colored by category, with a white center dot.
export function reportIcon(category) {
  const color = categoryColor(category);
  return L.divIcon({
    className: '',
    iconSize: [26, 30],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
    html: `<div class="rpin" style="background:${color}"><span class="rpin-dot"></span></div>`,
  });
}
