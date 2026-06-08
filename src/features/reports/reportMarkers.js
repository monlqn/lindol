import L from 'leaflet';
import { categoryColor, categoryIcon } from './reportSchema.js';

// A clean teardrop map pin colored by category, with the category emoji on a white center.
export function reportIcon(category) {
  const color = categoryColor(category);
  const icon = categoryIcon(category);
  return L.divIcon({
    className: '',
    iconSize: [34, 40],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
    html: `<div class="rpin" style="background:${color}"><span class="rpin-i">${icon}</span></div>`,
  });
}
