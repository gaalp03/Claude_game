// Hibakereső: egy pálya megoldásának utolsó körét lépésenként kiírja.
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/core/level-loader.js';
import { runSolution, makeBot } from '../src/core/solver.js';
import { createWorld } from '../src/core/world.js';
const [,, name, every = '10', roundArg] = process.argv;
const level = loadLevel(JSON.parse(readFileSync(`src/levels/${name}.json`, 'utf8')));
const sol = level.solution;
const r = roundArg ? parseInt(roundArg) : sol.length - 1;
const pre = runSolution(level, sol.slice(0, r).concat([[]]));
const world = createWorld(level, pre.ghosts);
const bot = makeBot(sol[r]);
const T = 30;
while (world.status === 'playing') {
  const b = bot(world);
  const evs = world.step(b ?? 0);
  if (world.frame % +every === 0 || evs.length) {
    const e = world.entities.map((e) => `${e.ghost ? 'G' : 'P'}(${((e.x + e.w / 2) / T).toFixed(2)},${((e.y + e.h) / T).toFixed(2)}${e.grounded ? 'g' : ''}${e.alive ? '' : 'X'})`).join(' ');
    const extra = world.movers.map((m) => `M${(m.y / T).toFixed(2)}`).concat(world.hazards.filter(h=>h.def.to).map((h) => `H(${(h.x/T).toFixed(1)},${(h.y/T).toFixed(2)})`)).join(' ');
    console.log(world.frame, b, e, extra, evs.map((x) => x.type).join(','));
  }
  if (b === null && world.frame > 2000) break;
}
console.log('status', world.status);
