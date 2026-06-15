import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import 'leaflet.heat';

// Guards the heatmap toggle: if the plugin import ever stops augmenting L, the map would throw at
// runtime when the layer is turned on. This catches that at test time instead.
describe('leaflet.heat', () => {
  it('augments Leaflet with a heatLayer factory', () => {
    expect(typeof L.heatLayer).toBe('function');
  });
});
