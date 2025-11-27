// Simple icon generation script
// Run: node scripts/generate-icons.js

import fs from 'fs';
import path from 'path';

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(process.cwd(), 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon
function createSvgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        fill="white" font-family="Arial, sans-serif" font-weight="bold" 
        font-size="${size * 0.5}">Q</text>
</svg>`;
}

// Generate icons
sizes.forEach(size => {
  const svg = createSvgIcon(size);
  const filename = `icon${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`Created ${filename}`);
});

console.log('\nNote: Chrome extensions require PNG icons.');
console.log('To convert SVGs to PNGs, you can use:');
console.log('  - Online converters like https://cloudconvert.com/svg-to-png');
console.log('  - ImageMagick: convert icon16.svg icon16.png');
console.log('  - Or install sharp: npm install sharp -D and update this script');

