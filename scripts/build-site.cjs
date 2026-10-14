const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });

// Root application files are the source of truth; public contains legacy copies.
for (const name of fs.readdirSync(root)) {
  if (/\.(js|css|mp3)$/.test(name) && name !== 'vite.config.js') {
    fs.copyFileSync(path.join(root, name), path.join(output, name));
  }
}
for (const name of ['assets', 'texture']) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<base href="/test_polio/">', '');
fs.writeFileSync(path.join(output, 'index.html'), html);
console.log('Built current application files into dist for root hosting.');
