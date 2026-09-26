// Haladás mentése: teljesített pályák, legjobb idők, legkevesebb szellem, napi sorozat,
// kinézet, achievementek és beállítások. A tároló bármilyen getItem/setItem objektum lehet
// (localStorage, a CrazyGames Data Module, vagy tesztben egy memória-tároló).

import { prevDateKey } from './daily.js';
import { medalRank } from './progress.js';

export const SAVE_KEY = 'ghostloop.save.v1';

export const PB_KEY = 'ghostloop.pb.v1';

export function defaultSave() {
  return {
    levels: {}, // id → { done, bestFrames, fewestGhosts, attempts, stars, medal }
    daily: { streak: 0, best: 0, last: null, history: {} },
    settings: { muted: false, music: true, skin: 'neon', lowFx: false },
    stats: { deaths: 0, ghosts: 0, loops: 0, wins: 0 },
    achievements: {}, // id → időbélyeg
    savedAt: 0 // utolsó írás ideje (ütközéskor a beállításokat a frissebb adja)
  };
}

export function safeStorage() {
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
      Object.assign(data.stats, parsed.stats || {});
      Object.assign(data.achievements, parsed.achievements || {});
      data.savedAt = Number(parsed.savedAt) || 0;
    }
  } catch {
    // sérült mentés: alapértékekkel folytatjuk
  }
  return data;
}

export function writeSave(data, storage = safeStorage()) {
  if (!storage) return false;
  try {
    data.savedAt = Date.now();
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

// ---------------------------------------------------------------- két mentés egyesítése
// Helyi és felhős (Data Module) mentés ütközésekor semmi sem veszhet el: mindenből a jobb
// eredmény marad meg. Tiszta függvény, a bemeneteket nem módosítja.

const minOf = (x, y) => (x == null ? (y ?? null) : y == null ? x : Math.min(x, y));

function mergeLevel(a, b) {
  if (!a) return { ...b };
  if (!b) return { ...a };
  const out = { ...a, ...b };
  out.done = !!(a.done || b.done);
  out.bestFrames = minOf(a.bestFrames, b.bestFrames);
  out.fewestGhosts = minOf(a.fewestGhosts, b.fewestGhosts);
  out.attempts = minOf(a.attempts, b.attempts);
  const stars = (a.stars | 0) | (b.stars | 0);
  if (stars || 'stars' in a || 'stars' in b) out.stars = stars;
  const medal = medalRank(b.medal) > medalRank(a.medal) ? b.medal : a.medal;
  if (medal) out.medal = medal;
  else delete out.medal;
  return out;
}

/** Napi eredmény: a teljesített és gyorsabb a jobb. */
function betterDaily(a, b) {
  if (!a) return b;
  if (!b) return a;
  const fa = a.frames ?? Infinity;
  const fb = b.frames ?? Infinity;
  return fb < fa ? b : a;
}

/**
 * @param {object} local helyi mentés (a beállításoknál az eszközfüggők innen jönnek)
 * @param {object} cloud felhős mentés
 */
export function mergeSaves(local, cloud) {
  const a = local || defaultSave();
  const b = cloud || defaultSave();
  const out = defaultSave();

  for (const id of new Set([...Object.keys(a.levels || {}), ...Object.keys(b.levels || {})])) {
    out.levels[id] = mergeLevel(a.levels?.[id], b.levels?.[id]);
  }

  const da = { ...defaultSave().daily, ...(a.daily || {}) };
  const db = { ...defaultSave().daily, ...(b.daily || {}) };
  const history = {};
  for (const k of new Set([...Object.keys(da.history || {}), ...Object.keys(db.history || {})])) {
    history[k] = betterDaily(da.history?.[k], db.history?.[k]);
  }
  // sorozat: a később játszott forrásé; azonos napnál a hosszabb
  const newer = (da.last || '') > (db.last || '') ? da : (db.last || '') > (da.last || '') ? db : da.streak >= db.streak ? da : db;
  out.daily = {
    streak: newer.streak || 0,
    last: newer.last || null,
    best: Math.max(da.best || 0, db.best || 0, newer.streak || 0),
    history
  };

  // beállítások: a frissebben mentett forrásé, a képminőség (lowFx) viszont eszközfüggő, marad a helyi
  const settingsSrc = (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
  Object.assign(out.settings, a.settings || {}, settingsSrc.settings || {});
  if (a.settings && 'lowFx' in a.settings) out.settings.lowFx = a.settings.lowFx;

  for (const k of new Set([...Object.keys(a.stats || {}), ...Object.keys(b.stats || {})])) {
    out.stats[k] = Math.max(Number(a.stats?.[k]) || 0, Number(b.stats?.[k]) || 0);
  }

  for (const id of new Set([...Object.keys(a.achievements || {}), ...Object.keys(b.achievements || {})])) {
    const ta = a.achievements?.[id];
    const tb = b.achievements?.[id];
    out.achievements[id] = ta && tb ? Math.min(ta, tb) : ta || tb;
  }

  out.savedAt = Math.max(a.savedAt || 0, b.savedAt || 0);
  return out;
}

/**
 * PB-nyomvonalak egyesítése: pályánként annak a forrásnak a futása marad, amelyiknek
 * jobb (kisebb) a legjobb ideje; ha csak az egyikben van, az.
 */
export function mergePB(localPB, cloudPB, localSave, cloudSave) {
  const out = {};
  const a = localPB || {};
  const b = cloudPB || {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (typeof a[id] !== 'string') out[id] = b[id];
    else if (typeof b[id] !== 'string') out[id] = a[id];
    else {
      const fa = localSave?.levels?.[id]?.bestFrames ?? Infinity;
      const fb = cloudSave?.levels?.[id]?.bestFrames ?? Infinity;
      out[id] = fb < fa ? b[id] : a[id];
    }
  }
  return out;
}

// ---------------------------------------------------------------- legjobb futás (PB-szellem)
// Külön kulcs alatt, hogy a fő mentés kicsi maradjon; pályánként egy kódolt trajektória.

/** Az összes PB-nyomvonal (pálya id → kódolt futás) */
export function readPBMap(storage = safeStorage()) {
  if (!storage) return {};
  try {
    const all = JSON.parse(storage.getItem(PB_KEY) || '{}');
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}

export function writePBMap(map, storage = safeStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(PB_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function loadPB(id, storage = safeStorage()) {
  if (!storage) return null;
  try {
    const all = JSON.parse(storage.getItem(PB_KEY) || '{}');
    return typeof all[id] === 'string' ? all[id] : null;
  } catch {
    return null;
  }
}

export function savePB(id, encoded, storage = safeStorage()) {
  if (!storage) return false;
  try {
    const all = JSON.parse(storage.getItem(PB_KEY) || '{}');
    all[id] = encoded;
    storage.setItem(PB_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
