// Pályabetöltő: a JSON-ban rácsegységben (1 egység = TILE px) megadott pályát
// ellenőrzi, kiegészíti az alapértékekkel és pixel-koordinátás futásidejű formára alakítja.

import { TILE, STEP_HZ } from './physics.js';

export class LevelError extends Error {
  constructor(levelId, message) {
    super(`Level "${levelId}": ${message}`);
    this.name = 'LevelError';
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function requireRect(id, what, r, { minSize = 0 } = {}) {
  if (!r || typeof r !== 'object') throw new LevelError(id, `${what} must be an object`);
  for (const k of ['x', 'y', 'w', 'h']) {
    if (!isNum(r[k])) throw new LevelError(id, `${what}.${k} must be a number`);
  }
  if (r.w <= minSize || r.h <= minSize) throw new LevelError(id, `${what} must have positive size`);
}

function requirePoint(id, what, p) {
  if (!p || !isNum(p.x) || !isNum(p.y)) throw new LevelError(id, `${what} must have numeric x and y`);
}

const px = (v) => v * TILE;
const rectPx = (r) => ({ x: px(r.x), y: px(r.y), w: px(r.w), h: px(r.h) });

/**
 * JSON pálya → futásidejű pálya. Hibás adatnál LevelError-t dob.
 * @param {object} raw a JSON tartalma
 */
export function loadLevel(raw) {
  if (!raw || typeof raw !== 'object') throw new LevelError('?', 'level must be an object');
  const id = raw.id;
  if (typeof id !== 'string' || !id) throw new LevelError('?', 'id must be a non-empty string');
  if (typeof raw.name !== 'string') throw new LevelError(id, 'name must be a string');

  const size = raw.size || { w: 32, h: 18 };
  if (!isNum(size.w) || !isNum(size.h) || size.w < 8 || size.h < 6) {
    throw new LevelError(id, 'size must be at least 8x6');
  }
  const timeLimit = raw.timeLimit;
  if (!isNum(timeLimit) || timeLimit < 3 || timeLimit > 60) {
    throw new LevelError(id, 'timeLimit must be between 3 and 60 seconds');
  }
  const ghosts = raw.ghosts ?? 0;
  if (!Number.isInteger(ghosts) || ghosts < 0 || ghosts > 4) {
    throw new LevelError(id, 'ghosts must be an integer 0..4');
  }

  requirePoint(id, 'spawn', raw.spawn);
  requirePoint(id, 'goal', raw.goal);

  const W = px(size.w);
  const H = px(size.h);

  // Tömör elemek; a "border" a pálya két oldalára láthatatlan falat tesz
  const solids = [];
  (raw.platforms || []).forEach((p, i) => {
    requireRect(id, `platforms[${i}]`, p);
    solids.push(rectPx(p));
  });
  if (raw.border !== false) {
    solids.push({ x: -TILE, y: -H, w: TILE, h: H * 3, border: true });
    solids.push({ x: W, y: -H, w: TILE, h: H * 3, border: true });
  }

  const hazards = (raw.hazards || []).map((h, i) => {
    requireRect(id, `hazards[${i}]`, h);
    const out = { ...rectPx(h), kind: h.kind || (h.to ? 'block' : 'spikes') };
    if (h.to) {
      requirePoint(id, `hazards[${i}].to`, h.to);
      if (!isNum(h.speed) || h.speed <= 0) throw new LevelError(id, `hazards[${i}].speed must be > 0`);
      out.from = { x: out.x, y: out.y };
      out.to = { x: px(h.to.x), y: px(h.to.y) };
      out.speed = (h.speed * TILE) / STEP_HZ; // egység/s → px/lépés
      out.phase = isNum(h.phase) ? h.phase : 0;
    }
    return out;
  });

  const buttonIds = new Set();
  const buttons = (raw.buttons || []).map((b, i) => {
    if (typeof b.id !== 'string') throw new LevelError(id, `buttons[${i}].id must be a string`);
    if (buttonIds.has(b.id)) throw new LevelError(id, `duplicate button id "${b.id}"`);
    buttonIds.add(b.id);
    if (!isNum(b.x) || !isNum(b.y)) throw new LevelError(id, `buttons[${i}] needs x and y`);
    const w = isNum(b.w) ? b.w : 1;
    // a gomb a megadott y felszínen ül, 8 px magas érzékelő zónával
    return { id: b.id, x: px(b.x), y: px(b.y) - 8, w: px(w), h: 8, surface: px(b.y) };
  });

  const checkLinks = (what, list) => {
    if (!Array.isArray(list) || list.length === 0) throw new LevelError(id, `${what} needs at least one button`);
    for (const bid of list) {
      if (!buttonIds.has(bid)) throw new LevelError(id, `${what} references unknown button "${bid}"`);
    }
  };
  const linkList = (o) => (o.buttons ? o.buttons : o.button ? [o.button] : null);

  const objIds = new Set();
  const claimId = (oid, what) => {
    if (typeof oid !== 'string' || !oid) throw new LevelError(id, `${what}.id must be a string`);
    if (objIds.has(oid) || buttonIds.has(oid)) throw new LevelError(id, `duplicate id "${oid}"`);
    objIds.add(oid);
  };

  const doors = (raw.doors || []).map((d, i) => {
    claimId(d.id, `doors[${i}]`);
    requireRect(id, `doors[${i}]`, d);
    const links = linkList(d);
    checkLinks(`door "${d.id}"`, links);
    const mode = d.mode || 'any';
    if (mode !== 'any' && mode !== 'all') throw new LevelError(id, `door "${d.id}" mode must be any|all`);
    return { id: d.id, ...rectPx(d), buttons: links, mode, invert: !!d.invert };
  });

  const movers = (raw.movers || []).map((m, i) => {
    claimId(m.id, `movers[${i}]`);
    requireRect(id, `movers[${i}]`, m);
    requirePoint(id, `movers[${i}].to`, m.to);
    if (!isNum(m.speed) || m.speed <= 0) throw new LevelError(id, `mover "${m.id}" speed must be > 0`);
    const links = linkList(m);
    if (links) checkLinks(`mover "${m.id}"`, links);
    return {
      id: m.id,
      ...rectPx(m),
      from: { x: px(m.x), y: px(m.y) },
      to: { x: px(m.to.x), y: px(m.to.y) },
      speed: (m.speed * TILE) / STEP_HZ,
      buttons: links,
      mode: m.mode || 'any',
      phase: isNum(m.phase) ? m.phase : 0
    };
  });

  const spawn = { x: px(raw.spawn.x), y: px(raw.spawn.y) };
  const goal = { x: px(raw.goal.x) - TILE / 2, y: px(raw.goal.y) - TILE * 1.2, w: TILE, h: TILE * 1.2 };

  if (spawn.x <= 0 || spawn.x >= W || spawn.y <= 0 || spawn.y > H) throw new LevelError(id, 'spawn is outside the level');
  if (goal.x < 0 || goal.x + goal.w > W || goal.y < 0 || goal.y + goal.h > H) throw new LevelError(id, 'goal is outside the level');

  // A kezdőpont és a cél nem lóghat bele tömör elembe
  const spawnBox = { x: spawn.x - 11, y: spawn.y - 28, w: 22, h: 28 };
  for (const s of solids) {
    if (s.border) continue;
    const hit = (r) => r.x < s.x + s.w && r.x + r.w > s.x && r.y < s.y + s.h && r.y + r.h > s.y;
    if (hit(spawnBox)) throw new LevelError(id, 'spawn overlaps a platform');
    if (hit(goal)) throw new LevelError(id, 'goal overlaps a platform');
  }

  let solution = null;
  if (raw.solution !== undefined) {
    if (!Array.isArray(raw.solution) || raw.solution.some((r) => !Array.isArray(r))) {
      throw new LevelError(id, 'solution must be an array of rounds (arrays of tokens)');
    }
    solution = raw.solution.map((r) => r.slice());
  }

  return {
    id,
    name: raw.name,
    hint: typeof raw.hint === 'string' ? raw.hint : '',
    cols: size.w,
    rows: size.h,
    width: W,
    height: H,
    timeLimit,
    frameLimit: Math.round(timeLimit * STEP_HZ),
    ghosts,
    spawn,
    goal,
    solids,
    hazards,
    buttons,
    doors,
    movers,
    solution
  };
}
