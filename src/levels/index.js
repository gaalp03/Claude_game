// Az összes kézzel készített pálya betöltése (Vite import.meta.glob, build időben beágyazva).
import { loadLevel } from '../core/level-loader.js';

const modules = import.meta.glob('./level*.json', { eager: true, import: 'default' });

/** Nyers JSON pályák sorrendben */
export const RAW_LEVELS = Object.keys(modules)
  .sort()
  .map((k) => modules[k]);

/** Betöltött, ellenőrzött pályák */
export const LEVELS = RAW_LEVELS.map((raw) => loadLevel(raw));
