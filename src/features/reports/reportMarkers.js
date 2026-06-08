import L from 'leaflet';
import { categoryColor, categoryIcon } from './reportSchema.js';

// A clean teardrop map pin colored by category, with the category emoji on a white center.
export function reportIcon(category, resolved = false) {
  const color = categoryColor(category);
  const icon = resolved ? '✅' : categoryIcon(category);
  return L.divIcon({
    className: '',
    iconSize: [34, 40],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
    html: `<div class="rpin${resolved ? ' resolved' : ''}" style="background:${color}"><span class="rpin-i">${icon}</span></div>`,
  });
}
