// Icon generation script using the logo SVG
// Run: node scripts/generate-icons.js

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(process.cwd(), 'public', 'icons');
const logoPath = path.join(process.cwd(), 'public', 'logo.svg');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Check if logo exists
if (!fs.existsSync(logoPath)) {
  console.error(`Error: Logo not found at ${logoPath}`);
  process.exit(1);
}

// Generate PNG icons from the SVG logo
async function generateIcons() {
  console.log('Generating icons from logo.svg...\n');
  
  for (const size of sizes) {
    try {
      const outputPath = path.join(iconsDir, `icon${size}.png`);
      
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 11, g: 13, b: 16, alpha: 1 } // #0B0D10 background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Created icon${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`✗ Failed to create icon${size}.png:`, error);
    }
  }
  
  console.log('\n✓ All icons generated successfully!');
  console.log(`Icons saved to: ${iconsDir}`);
}

generateIcons().catch(error => {
  console.error('Error generating icons:', error);
  process.exit(1);
});

