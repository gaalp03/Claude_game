// Parancssori ellenőrző: minden pálya betöltése és a mellékelt megoldás lefuttatása.
// Használat: npm run verify  (vagy: node scripts/verify-levels.mjs level05)
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLevel } from '../src/core/level-loader.js';
import { runSolution } from '../src/core/solver.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/levels');
const filter = process.argv[2];
let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  if (filter && !file.includes(filter)) continue;
  const raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  try {
    const level = loadLevel(raw);
    const res = runSolution(level, level.solution);
    const ghostsOk = res.ghosts.length === level.ghosts;
    const ok = res.ok && ghostsOk;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${file.padEnd(14)} ${level.name.padEnd(18)} ghosts=${res.ghosts.length}/${level.ghosts} ` +
        `time=${(res.frames / 60).toFixed(2)}s/${level.timeLimit}s ${res.ok ? '' : res.reason}`
    );
  } catch (err) {
    failed++;
    console.log(`ERR  ${file}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
