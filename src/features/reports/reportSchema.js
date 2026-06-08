export const CATEGORIES = [
  { key: 'damage', label: 'Damage',       color: '#9A5B16' },
  { key: 'road',   label: 'Blocked road', color: '#C08A1E' },
  { key: 'fire',   label: 'Fire',         color: '#E0521B' },
  { key: 'help',   label: 'Need help',    color: '#CC2A2A' },
  { key: 'safe',   label: 'Safe here',    color: '#3F7D43' },
  { key: 'other',  label: 'Other',        color: '#8A8175' },
];

const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function categoryColor(key) {
  return (BY_KEY[key] ?? BY_KEY.other).color;
}

// Returns { valid, errors[] }. Note optional, max 280 chars. Coords required numbers.
export function validateReport({ category, note = '', lat, lng }) {
  const errors = [];
  if (!BY_KEY[category]) errors.push('category');
  if (typeof lat !== 'number' || Number.isNaN(lat)) errors.push('lat');
  if (typeof lng !== 'number' || Number.isNaN(lng)) errors.push('lng');
  if (typeof note !== 'string' || note.length > 280) errors.push('note');
  return { valid: errors.length === 0, errors };
}
