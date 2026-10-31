// Scan real avatars / nickname crops / group logo and write assets/manifest.json (the page falls back to placeholders).
// assets/avatars/<id>.jpg   — avatar for member id from js/data.js
// assets/nicks/<id>.png     — crop of a symbol-only nickname from the original screenshot
// assets/logo.jpg           — the group's logo
import fs from 'fs'; import path from 'path'; import url from 'url';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'assets');
const list = (d, ext) => fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)).filter(f => f.endsWith(ext)).map(f => f.slice(0, -ext.length)) : [];
const m = { avatars: list('avatars', '.jpg'), nicks: list('nicks', '.png'), logo: fs.existsSync(path.join(root, 'logo.jpg')) };
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(m, null, 1));
console.log(m);
