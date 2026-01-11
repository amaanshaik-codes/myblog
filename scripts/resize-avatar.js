// scripts/resize-avatar.js
// Generate responsive AVIF/WebP/PNG variants for the profile avatar using sharp
// Usage: node scripts/resize-avatar.js

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const src = path.join(__dirname, '..', 'assets', 'myface.png');
const outDir = path.join(__dirname, '..', 'assets');
const sizes = [48, 96, 185]; // avatar sizes (px)

async function build() {
  if (!fs.existsSync(src)) {
    console.error('Source avatar not found:', src);
    process.exit(1);
  }

  await Promise.all(sizes.map(async (size) => {
    const base = path.join(outDir, `myface-${size}`);

    // AVIF
    await sharp(src)
      .resize(size, size)
      .avif({ quality: 65 })
      .toFile(`${base}.avif`);

    // WebP
    await sharp(src)
      .resize(size, size)
      .webp({ quality: 75 })
      .toFile(`${base}.webp`);

    // Optimized PNG (lossless-ish)
    await sharp(src)
      .resize(size, size)
      .png({ compressionLevel: 8, palette: true })
      .toFile(`${base}.png`);

    console.log('Written:', `${base}.{avif,webp,png}`);
  }));

  // Also write a 1x1 tiny placeholder if desired
  const tinyBase = path.join(outDir, 'myface-16');
  await sharp(src).resize(16,16).webp({quality:50}).toFile(`${tinyBase}.webp`);
  console.log('Written tiny placeholder: myface-16.webp');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});