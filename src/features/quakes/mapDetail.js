// Magnitude floor for the map's level-of-detail. Zoomed out to the country/region view we only
// plot the larger quakes, so a dense aftershock swarm doesn't collapse into one unreadable blob;
// zooming in lowers the floor until every quake (down to the 2.0 feed minimum) is shown. The map
// pairs this with a recency override so freshly-detected quakes are never hidden by the floor.
export function magFloorForZoom(zoom) {
  return Math.max(0, 4.5 - (zoom - 6) * 0.5);
}
