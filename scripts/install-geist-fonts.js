const fs = require('fs');
const path = require('path');

const candidates = [
  'node_modules/geist/dist/fonts',
  'node_modules/geist-fonts/dist',
  'node_modules/@geist/fonts/dist',
  'node_modules/@geist/geist-fonts/dist',
];

const outDir = path.join(__dirname, '..', 'assets', 'fonts');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let found = false;
for (const c of candidates) {
  const full = path.join(__dirname, '..', c);
  if (!fs.existsSync(full)) continue;
  const files = fs.readdirSync(full).filter((f) => /woff2?$/.test(f));
  if (!files.length) continue;
  for (const f of files) {
    const src = path.join(full, f);
    const dst = path.join(outDir, f);
    try {
      fs.copyFileSync(src, dst);
      console.log('Copied', f, '→', path.relative(process.cwd(), dst));
    } catch (err) {
      console.error('Failed to copy', src, err.message);
    }
  }
  found = true;
}

if (!found) {
  console.log('\nNo Geist font files found in node_modules.');
  console.log('Run `npm i geist` (or place your WOFF2 files in assets/fonts/) and re-run this script:');
  console.log('  npm run install-geist-fonts');
} else {
  console.log('\nGeist fonts installed to assets/fonts/');
}
