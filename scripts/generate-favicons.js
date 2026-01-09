const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'myface.png');
const outDir = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(src)) {
  console.error('Profile image not found at', src);
  process.exit(1);
}

async function gen() {
  try {
    // Generate PNGs
    await sharp(src).resize(16,16).png({compressionLevel:9}).toFile(path.join(outDir,'favicon-16.png'));
    await sharp(src).resize(32,32).png({compressionLevel:9}).toFile(path.join(outDir,'favicon-32.png'));
    await sharp(src).resize(180,180).png({compressionLevel:9}).toFile(path.join(outDir,'apple-touch-icon-180.png'));

    // Generate WEBP variants (preferred)
    await sharp(src).resize(16,16).webp({quality:90}).toFile(path.join(outDir,'favicon-16.webp'));
    await sharp(src).resize(32,32).webp({quality:90}).toFile(path.join(outDir,'favicon-32.webp'));
    await sharp(src).resize(180,180).webp({quality:90}).toFile(path.join(outDir,'apple-touch-icon-180.webp'));

    const manifest = {
      name: "Amaan Shaik",
      short_name: "Amaan",
      icons: [
        { src: "/assets/favicon-32.webp", sizes: "32x32", type: "image/webp" },
        { src: "/assets/favicon-32.png", sizes: "32x32", type: "image/png" },
        { src: "/assets/favicon-16.webp", sizes: "16x16", type: "image/webp" },
        { src: "/assets/favicon-16.png", sizes: "16x16", type: "image/png" },
        { src: "/assets/apple-touch-icon-180.webp", sizes: "180x180", type: "image/webp" },
        { src: "/assets/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }
      ],
      start_url: "/",
      display: "standalone",
      background_color: "#0f0f0f",
      theme_color: "#0f0f0f"
    };

    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log('Generated favicons and manifest in assets/');
  } catch (err) {
    console.error('Error generating favicons:', err);
    process.exit(1);
  }
}

gen();
