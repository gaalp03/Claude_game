// Az összes kézzel készített pálya betöltése (Vite import.meta.glob, build időben beágyazva).
import { loadLevel } from '../core/level-loader.js';
import { runSolution } from '../core/solver.js';

const modules = import.meta.glob('./level*.json', { eager: true, import: 'default' });

/** Nyers JSON pályák sorrendben */
export const RAW_LEVELS = Object.keys(modules)
  .sort()
  .map((k) => modules[k]);

/** Betöltött, ellenőrzött pályák */
export const LEVELS = RAW_LEVELS.map((raw) => loadLevel(raw));

// Fejlesztői idő: a mellékelt megoldás utolsó körének hossza (ezt kell megverni a "Beat the Dev" éremhez).
// Betöltéskor egyszer lefuttatjuk a szimulációt (pályánként ~1 ms).
for (const level of LEVELS) {
  const res = level.solution ? runSolution(level, level.solution) : null;
  level.devFrames = res && res.ok ? res.frames : level.frameLimit;
}

export const CHAPTERS = [
  { name: 'Chapter 1', title: 'First Loops', from: 0, to: 12 },
  { name: 'Chapter 2', title: 'Paradox', from: 12, to: 24 }
].map((c) => ({ ...c, ids: LEVELS.slice(c.from, c.to).map((l) => l.id) }));

export const chapterOf = (index) => CHAPTERS.findIndex((c) => index >= c.from && index < c.to);

export const MAX_STARS = LEVELS.length * 3;
