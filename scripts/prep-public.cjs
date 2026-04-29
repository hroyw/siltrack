// Mirror data/all.json into public/data/all.json so vite includes it in dist/.
const fs = require('node:fs');
const path = require('node:path');

const src = path.resolve(__dirname, '..', 'data', 'all.json');
const destDir = path.resolve(__dirname, '..', 'public', 'data');
const dest = path.join(destDir, 'all.json');

if (!fs.existsSync(src)) {
  console.warn(`prep-public: ${src} not found; build will lack data/all.json`);
  process.exit(0);
}
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`prep-public: copied ${src} -> ${dest}`);
