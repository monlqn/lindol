import sharp from 'sharp';

const OUT = 'C:/Users/User/OneDrive/Desktop/Lindol';
const W = 1080, H = 1350;

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#1A150F"/><stop offset="1" stop-color="#0C0907"/></linearGradient>
  <filter id="g" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

const F = (w, s) => `font-family="Sora, Arial, sans-serif" font-weight="${w}" font-size="${s}"`;
const trace = (y) => `<g filter="url(#g)" opacity="0.6"><path d="M0 ${y} H360 L405 ${y - 22} L445 ${y - 115} L480 ${y + 95} L520 ${y} H1080" stroke="#E0521B" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/></g>`;
const livePill = (x, y) => `<rect x="${x}" y="${y}" width="150" height="52" rx="26" fill="#E0521B"/><circle cx="${x + 30}" cy="${y + 26}" r="8" fill="#fff"/><text x="${x + 50}" y="${y + 34}" ${F(800, 25)} fill="#fff" letter-spacing="3">LIVE</text>`;
const wordmark = (x, y, s) => `<text x="${x}" y="${y}" ${F(800, s)} fill="#F4EEE3" letter-spacing="-4">LIND<tspan fill="#E0521B">O</tspan>L</text>`;
const url = (y) => `<text x="540" y="${y}" text-anchor="middle" ${F(800, 46)} fill="#E0521B" letter-spacing="1">lindol.app</text>`;
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${defs}<rect width="${W}" height="${H}" fill="url(#bg)"/>${inner}</svg>`;

// 1) HERO
const hero = svg(`
${livePill(80, 120)}
${wordmark(70, 640, 150)}
<text x="80" y="715" ${F(600, 40)} fill="#B6AC9C">Live earthquake watch for the Philippines</text>
<text x="80" y="775" ${F(600, 32)} fill="#8A8175">Southern Mindanao  |  citizen reports  |  safety</text>
${trace(1090)}
${url(1255)}`);

// 2) FEATURES
const feats = [
  'Live quakes on a map (USGS)',
  'Report damage, fire and roads',
  'Loud alarm for quakes near you',
  'Offline safety guide + hotlines',
  'Confirm and resolve, together',
];
const featLines = feats.map((t, i) => {
  const y = 440 + i * 130;
  return `<circle cx="92" cy="${y - 12}" r="8" fill="#E0521B"/><text x="124" y="${y}" ${F(600, 40)} fill="#E7DFD2">${t}</text>`;
}).join('');
const features = svg(`
${wordmark(80, 180, 72)}
<text x="80" y="300" ${F(800, 54)} fill="#F4EEE3">What you can do</text>
${featLines}
<text x="80" y="1140" ${F(700, 34)} fill="#E0521B">Free  |  No sign-up  |  Works offline</text>
${url(1255)}`);

// 3) HOW IT WORKS
const steps = ['1   Report what you see', '2   Neighbours confirm it', '3   Escalate to authorities', '4   Marked resolved'];
const stepLines = steps.map((t, i) => `<text x="100" y="${450 + i * 120}" ${F(700, 44)} fill="#F4EEE3">${t}</text>`).join('');
const how = svg(`
${wordmark(80, 180, 72)}
<text x="80" y="300" ${F(800, 54)} fill="#F4EEE3">How it works</text>
${stepLines}
<rect x="80" y="980" width="920" height="128" rx="16" fill="#221610" stroke="#C08A1E" stroke-width="2"/>
<text x="112" y="1032" ${F(700, 28)} fill="#D6A23A">Awareness tool, not early warning.</text>
<text x="112" y="1074" ${F(400, 26)} fill="#B6AC9C">In an emergency call 911 or your DRRMO.</text>
${url(1255)}`);

await sharp(Buffer.from(hero)).png().toFile(`${OUT}/promo-1-hero.png`);
await sharp(Buffer.from(features)).png().toFile(`${OUT}/promo-2-features.png`);
await sharp(Buffer.from(how)).png().toFile(`${OUT}/promo-3-howitworks.png`);
console.log('created 3 promo images in', OUT);
