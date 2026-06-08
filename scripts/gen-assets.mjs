import sharp from 'sharp';
await sharp('public/icons/icon.svg').resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp('public/icons/icon.svg').resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp('public/og-image.svg').resize(1200, 630).png().toFile('public/og-image.png');
console.log('assets generated');
