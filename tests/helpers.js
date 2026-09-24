// Közös teszt-segédek
import { createWorld } from '../src/core/world.js';
import { mulberry32 } from '../src/core/rng.js';
import { IN_RIGHT, IN_JUMP, IN_LEFT } from '../src/core/physics.js';

/** Álvéletlen, de "játékosszerű" input-sorozat (tartott gombok, nem zaj) */
export function randomInputs(seed, frames) {
  const rng = mulberry32(seed);
  const out = [];
  let cur = 0;
  let hold = 0;
  for (let i = 0; i < frames; i++) {
    if (hold <= 0) {
      cur = rng.pick([0, IN_RIGHT, IN_RIGHT, IN_RIGHT | IN_JUMP, IN_LEFT, IN_JUMP, IN_RIGHT]);
      hold = rng.int(3, 40);
    }
    out.push(cur);
    hold--;
  }
  return out;
}

/** Egy kör pályája: minden entitás [x,y] minden lépés után */
export function trajectory(level, ghosts, inputs) {
  const w = createWorld(level, ghosts);
  const path = [];
  for (const bits of inputs) {
    if (w.status !== 'playing') break;
    w.step(bits);
    path.push(w.entities.map((e) => [e.x, e.y, e.alive]));
  }
  return { world: w, path };
}

/**
 * Szellem nélküli "trükk" keresése: jobbra futás és 1-2 ugrás tetszőleges időpontban.
 * Szellemes pályákon ez nem nyerhet, különben a szellem-mechanika megkerülhető.
 */
export function findTrivialWin(level, step = 3) {
  const limit = Math.min(level.frameLimit, 900);
  const tryJumps = (jumps) => {
    const w = createWorld(level, []);
    let j = 0;
    for (let f = 0; f < limit && w.status === 'playing'; f++) {
      let bits = IN_RIGHT;
      while (j < jumps.length && f >= jumps[j] + 40) j++;
      if (j < jumps.length && f >= jumps[j]) bits |= IN_JUMP;
      w.step(bits);
    }
    return w.status === 'won';
  };
  for (let a = 0; a < 360; a += step) {
    if (tryJumps([a])) return [a];
    for (let b = a + 42; b < 360; b += step * 3) {
      if (tryJumps([a, b])) return [a, b];
    }
  }
  return null;
}
