// Mirror data/*.json into public/data/ so vite includes them in dist/.
const fs = require('node:fs');
const path = require('node:path');

const FILES = ['all.json', 'events.json'];

const srcDir = path.resolve(__dirname, '..', 'data');
const destDir = path.resolve(__dirname, '..', 'public', 'data');

fs.mkdirSync(destDir, { recursive: true });

for (const name of FILES) {
  const src = path.join(srcDir, name);
  const dest = path.join(destDir, name);
  if (!fs.existsSync(src)) {
    console.warn(`prep-public: ${src} not found; build will lack data/${name}`);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log(`prep-public: copied ${src} -> ${dest}`);
}
