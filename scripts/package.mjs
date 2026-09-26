// CrazyGames-feltöltéshez: production build → release/ghost-loop-crazygames.zip
// A zip gyökerében az index.html van (a CrazyGames ezt várja), minden útvonal relatív.
import { execSync } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'release');
const out = join(outDir, 'ghost-loop-crazygames.zip');

execSync('npm run build', { cwd: root, stdio: 'inherit' });

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(dist);

if (!files.some((f) => relative(dist, f) === 'index.html')) throw new Error('dist/index.html missing');

const zip = new AdmZip();
let total = 0;
for (const f of files) {
  const rel = relative(dist, f).split('\\').join('/');
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  zip.addLocalFile(f, dir);
  total += statSync(f).size;
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
if (existsSync(out)) rmSync(out);
zip.writeZip(out);

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`\n${files.length} files, ${mb(total)} uncompressed → ${relative(root, out)} (${mb(statSync(out).size)})`);
if (total > 50 * 1024 * 1024) console.warn('WARNING: build is larger than the 50 MB initial-download limit');
