// Időzítés-kereső pályatervezéshez: a megoldásban lévő "T?" helyőrzőkre (várakozás
// adott képkockáig) szimulációval keres működő értékeket, és kiírja/visszaírja a pályába.
// Használat: node scripts/solve-timing.mjs level14 [--write] [--step 3]
import { readFileSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../src/core/level-loader.js';
import { runSolution } from '../src/core/solver.js';

const name = process.argv[2];
const write = process.argv.includes('--write');
const si = process.argv.indexOf('--step');
const STEP = si > 0 ? +process.argv[si + 1] : 3;
const MAX = 720;
const file = `src/levels/${name}.json`;
const raw = JSON.parse(readFileSync(file, 'utf8'));
const level = loadLevel({ ...raw, solution: undefined });
const template = raw.solution;

// helyőrzők listája: [kör, token index]
const holes = [];
template.forEach((round, r) => round.forEach((t, i) => t === 'T?' && holes.push([r, i])));
console.log(`${holes.length} placeholder(s)`);

const fill = (vals) => template.map((round, r) => round.map((t, i) => {
  const k = holes.findIndex(([hr, hi]) => hr === r && hi === i);
  return k >= 0 ? `T${vals[k]}` : t;
}));

// kör-prefix ellenőrzés: az első r+1 kör lefut (a nem utolsók élve végeznek)
function prefixOk(vals, r) {
  const sol = fill(vals).slice(0, r + 1);
  const last = r === template.length - 1;
  const res = runSolution(level, last ? sol : sol.concat([[]]));
  return last ? res.ok : res.rounds > r || res.ok || /final round/.test(res.reason || '');
}

let tried = 0;
function search(vals, k) {
  if (k === holes.length) return runSolution(level, fill(vals)).ok ? vals : null;
  const [r] = holes[k];
  const lo = k > 0 && holes[k - 1][0] === r ? vals[k - 1] + STEP : 0;
  for (let v = lo; v <= MAX; v += STEP) {
    const nv = [...vals, v];
    tried++;
    // ha ez a kör utolsó helyőrzője, a kör prefixének működnie kell
    const lastInRound = k + 1 === holes.length || holes[k + 1][0] !== r;
    if (lastInRound) {
      const partial = nv.concat(new Array(holes.length - k - 1).fill(0));
      if (!prefixOk(partial, r)) continue;
    }
    const got = search(nv, k + 1);
    if (got) return got;
  }
  return null;
}

const vals = holes.length ? search([], 0) : [];
if (!vals) {
  console.log('NO SOLUTION found after', tried, 'tries');
  process.exit(1);
}
const sol = fill(vals);
const res = runSolution(level, sol);
console.log('values', vals, 'ok', res.ok, 'frames', res.frames, 'rounds', res.roundFrames);
console.log(JSON.stringify(sol));
if (write) {
  raw.solution = sol;
  writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');
  console.log('written', file);
}
