// Haladás mentése localStorage-ba: teljesített pályák, legjobb idők, legkevesebb
// szellem, napi sorozat és beállítások. A tároló injektálható (tesztekhez).

import { prevDateKey } from './daily.js';

export const SAVE_KEY = 'ghostloop.save.v1';

export function defaultSave() {
  return {
    levels: {}, // id → { done, bestFrames, fewestGhosts, attempts }
    daily: { streak: 0, best: 0, last: null, history: {} },
    settings: { muted: false }
  };
}

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(storage = safeStorage()) {
  const data = defaultSave();
  if (!storage) return data;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return data;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      Object.assign(data.levels, parsed.levels || {});
      Object.assign(data.daily, parsed.daily || {});
      data.daily.history = { ...(parsed.daily?.history || {}) };
      Object.assign(data.settings, parsed.settings || {});
    }
  } catch {
    // sérült mentés: alapértékekkel folytatjuk
  }
  return data;
}

export function writeSave(data, storage = safeStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Pálya teljesítése; visszaadja, mi lett új rekord. */
export function recordLevel(data, id, frames, ghosts, attempts) {
  const prev = data.levels[id];
  const firstClear = !prev || !prev.done;
  const entry = prev ? { ...prev } : { done: false, bestFrames: null, fewestGhosts: null, attempts: null };
  const newTime = entry.bestFrames === null || frames < entry.bestFrames;
  const newGhosts = entry.fewestGhosts === null || ghosts < entry.fewestGhosts;
  entry.done = true;
  if (newTime) entry.bestFrames = frames;
  if (newGhosts) entry.fewestGhosts = ghosts;
  if (entry.attempts === null || attempts < entry.attempts) entry.attempts = attempts;
  data.levels[id] = entry;
  return { firstClear, newTime, newGhosts };
}

export function isLevelDone(data, id) {
  return !!data.levels[id]?.done;
}

/** Napi eredmény rögzítése és a sorozat frissítése (egy nap csak egyszer számít). */
export function recordDaily(data, key, result) {
  const d = data.daily;
  const already = d.history[key];
  if (!already) {
    d.history[key] = result;
    if (d.last === key) {
      // ugyanaz a nap, nincs változás
    } else if (d.last && d.last === prevDateKey(key)) {
      d.streak += 1;
    } else {
      d.streak = 1;
    }
    d.last = key;
    if (d.streak > d.best) d.best = d.streak;
  }
  return { first: !already, streak: d.streak };
}

/** Aktuális sorozat: ha tegnap sem játszott, már megszakadt (0). */
export function currentStreak(data, todayKey) {
  const d = data.daily;
  if (!d.last) return 0;
  if (d.last === todayKey || d.last === prevDateKey(todayKey)) return d.streak;
  return 0;
}
