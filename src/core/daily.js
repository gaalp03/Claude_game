// "Daily Loop": a mai dátumból képzett seed alapján mindenki ugyanazt a pályát kapja.
// A generátor paraméterezett sablonokból épít pályát, mindegyikhez a megoldását is
// megírja (bot-tokenekkel), majd a determinisztikus szimulációval LEFUTTATJA.
// Csak igazoltan megoldható pálya kerülhet ki; ha egy seed nem ad ilyet, a következő
// próbálkozás jön, végső esetben a kézzel tervezett (tesztelt) pályák közül választunk.

import { hashString, mulberry32 } from './rng.js';
import { loadLevel } from './level-loader.js';
import { runSolution, mirrorSolution } from './solver.js';

export const DAILY_EPOCH = '2026-01-01';
const COLS = 32;
const ROWS = 18;
const FLOOR = 16;
const MAX_ATTEMPTS = 40;

/** Helyi dátum → "YYYY-MM-DD" */
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** A napi pálya sorszáma (1 = az indulás napja) */
export function dailyNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  const [ey, em, ed] = DAILY_EPOCH.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000) + 1;
}

export function prevDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Segédfüggvények a sablonokhoz

function baseLevel() {
  return { platforms: [], hazards: [], buttons: [], doors: [], movers: [], gaps: [] };
}

/** Padló szakaszokra bontva a gödrök (gaps) kihagyásával */
function buildFloor(L) {
  const cuts = L.gaps.slice().sort((a, b) => a.x - b.x);
  let x = 0;
  for (const g of cuts) {
    if (g.x > x) L.platforms.push({ x, y: FLOOR, w: g.x - x, h: 2 });
    x = g.x + g.w;
  }
  if (x < COLS) L.platforms.push({ x, y: FLOOR, w: COLS - x, h: 2 });
}

/**
 * Ugrandó akadályok (tüske vagy gödör) szórása egy szakaszra.
 * Visszaadja az akadályokat; a bot ezek előtt ugrik.
 */
function scatterObstacles(rng, L, from, to, maxCount) {
  const out = [];
  let x = from;
  const count = rng.int(0, maxCount);
  for (let i = 0; i < count; i++) {
    const w = rng.pick([1, 1.5, 2]);
    const start = x + rng.half(0, 2);
    if (start + w > to) break;
    if (rng.chance(0.4)) {
      L.gaps.push({ x: start, w });
      L.hazards.push({ x: start, y: 17.5, w, h: 0.5 });
    } else {
      L.hazards.push({ x: start, y: FLOOR - 0.5, w, h: 0.5 });
    }
    out.push({ x: start, w });
    x = start + w + 4.5;
  }
  return out;
}

const fx = (v) => +v.toFixed(2);

/** Bot-tokenek: séta from → to, az akadályok előtt ugrással. stop=false esetén nem fékez. */
function travel(obstacles, from, to, stop = true) {
  const t = [];
  for (const o of obstacles) {
    if (o.x > from && o.x < to) t.push(`R@${fx(o.x - 1.1)}`, 'RJ16', 'Rg');
  }
  t.push(stop ? `@${fx(to)}` : `R@${fx(to)}`);
  return t;
}

/** Oszlop + ajtó: az ajtó felett a plafonig fal, hogy ne lehessen átugrani */
function addDoor(L, id, x, buttons, extra = {}) {
  L.platforms.push({ x, y: 0, w: 1, h: 11 });
  L.doors.push({ id, x, y: 11, w: 1, h: 5, buttons, ...extra });
}

// ---------------------------------------------------------------------------
// Sablonok: mindegyik {L, solution, ghosts, tag} objektumot ad

const TEMPLATES = [
  {
    tag: 'door',
    build(rng) {
      const L = baseLevel();
      const bx = rng.int(6, 10);
      const dx = rng.int(15, 21);
      const gx = rng.int(dx + 4, 30);
      L.buttons.push({ id: 'b1', x: bx, y: FLOOR, w: 1.5 });
      addDoor(L, 'd1', dx, ['b1']);
      const obs = [
        ...scatterObstacles(rng, L, bx + 2.5, dx - 1.5, 1),
        ...scatterObstacles(rng, L, dx + 2, gx - 2, 1)
      ];
      return {
        L, ghosts: 1, goal: gx,
        solution: [[...travel(obs, 2, bx + 0.75), 'W5'], travel(obs, 2, gx)]
      };
    }
  },
  {
    tag: 'step',
    build(rng) {
      const L = baseLevel();
      const wx = rng.int(11, 19);
      const ww = rng.pick([1, 2]);
      const gx = rng.int(wx + ww + 5, 30);
      L.platforms.push({ x: wx, y: FLOOR - 3, w: ww, h: 3 });
      const before = scatterObstacles(rng, L, 4, wx - 4, 1);
      const after = scatterObstacles(rng, L, wx + ww + 3, gx - 2, 1);
      const approach = [...travel(before, 2, wx - 1.8)];
      return {
        L, ghosts: 1, goal: gx,
        solution: [
          [...travel(before, 2, wx - 1, false), 'R20', 'W5'],
          [...approach, 'RJ25', 'Rg', 'W2', 'RJ30', 'Rg', ...travel(after, wx + ww, gx)]
        ]
      };
    }
  },
  {
    tag: 'lift',
    build(rng) {
      const L = baseLevel();
      const bx = rng.int(5, 9);
      const lx = rng.int(bx + 7, 21);
      const sy = rng.int(6, 9);
      const gx = rng.int(lx + 5, 30);
      L.gaps.push({ x: lx, w: 3 });
      L.platforms.push({ x: lx + 3, y: sy, w: COLS - lx - 3, h: 1 });
      L.hazards.push({ x: lx + 3, y: FLOOR - 0.5, w: COLS - lx - 3, h: 0.5 });
      L.buttons.push({ id: 'b1', x: bx, y: FLOOR, w: 1.5 });
      L.movers.push({ id: 'm1', x: lx, y: FLOOR, w: 3, h: 0.5, to: { x: lx, y: sy }, speed: 4, button: 'b1' });
      const obs = scatterObstacles(rng, L, bx + 2.5, lx - 2, 1);
      // A szellem csak akkor lép a gombra, amikor az élő játékos már a liften áll
      const liveFrames = Math.ceil(((lx + 1.5 - 2) * 30) / 3.4) + 30 * obs.length + 20;
      const ghostFrames = Math.ceil(((bx + 0.75 - 2) * 30) / 3.4) + 15;
      const wait = Math.max(0, liveFrames - ghostFrames + 20);
      return {
        L, ghosts: 1, goal: gx, goalY: sy,
        solution: [[`T${wait}`, `@${bx + 0.75}`, 'W5'], [...travel(obs, 2, lx + 1.5), 'Wo:m1', `@${gx}`]]
      };
    }
  },
  {
    tag: 'bridge',
    build(rng) {
      const L = baseLevel();
      const bx = rng.int(5, 9);
      const px = rng.int(bx + 5, 16);
      const pw = rng.int(6, 7);
      const gx = rng.int(px + pw + 3, 30);
      L.gaps.push({ x: px, w: pw });
      L.hazards.push({ x: px, y: 17.5, w: pw, h: 0.5 });
      L.buttons.push({ id: 'b1', x: bx, y: FLOOR, w: 1.5 });
      L.doors.push({ id: 'br', x: px, y: FLOOR, w: pw, h: 0.5, buttons: ['b1'], invert: true });
      const obs = scatterObstacles(rng, L, px + pw + 2.5, gx - 2, 1);
      return {
        L, ghosts: 1, goal: gx,
        solution: [[`@${bx + 0.75}`, 'W5'], travel(obs, 2, gx)]
      };
    }
  },
  {
    tag: 'twodoors',
    build(rng) {
      const L = baseLevel();
      const b1 = rng.int(4, 7);
      const d1 = rng.int(b1 + 4, 13);
      const d2 = rng.int(d1 + 7, 23);
      const b2 = rng.int(d1 + 2, d2 - 4);
      const gx = rng.int(d2 + 4, 30);
      L.buttons.push({ id: 'b1', x: b1, y: FLOOR, w: 1.5 }, { id: 'b2', x: b2, y: FLOOR, w: 1.5 });
      addDoor(L, 'd1', d1, ['b1']);
      addDoor(L, 'd2', d2, ['b2']);
      const obs = scatterObstacles(rng, L, d2 + 2, gx - 2, 1);
      return {
        L, ghosts: 2, goal: gx,
        solution: [[`@${b1 + 0.75}`, 'W5'], [`@${b2 + 0.75}`, 'W5'], travel(obs, 2, gx)]
      };
    }
  },
  {
    tag: 'stack',
    build(rng) {
      const L = baseLevel();
      const wx = rng.int(13, 20);
      const gx = rng.int(wx + 7, 30);
      L.platforms.push({ x: wx, y: FLOOR - 4, w: 2, h: 4 });
      const after = scatterObstacles(rng, L, wx + 5, gx - 2, 1);
      return {
        L, ghosts: 2, goal: gx,
        solution: [
          [`R@${wx - 1}`, 'R20', 'W5'],
          [`@${fx(wx - 1.8)}`, 'RJ25', 'Rg', 'R5', 'W5'],
          [`@${fx(wx - 1.8)}`, 'RJ25', 'Rg', 'W2', 'Jg', 'W2', 'RJ30', 'Rg', ...travel(after, wx + 2, gx)]
        ]
      };
    }
  },
  {
    tag: 'doorstep',
    build(rng) {
      const L = baseLevel();
      const bx = rng.int(4, 7);
      const dx = rng.int(bx + 4, 12);
      const wx = rng.int(dx + 5, 22);
      const gx = rng.int(wx + 6, 30);
      L.buttons.push({ id: 'b1', x: bx, y: FLOOR, w: 1.5 });
      addDoor(L, 'd1', dx, ['b1']);
      L.platforms.push({ x: wx, y: FLOOR - 3, w: 1, h: 3 });
      const after = scatterObstacles(rng, L, wx + 4, gx - 2, 1);
      return {
        L, ghosts: 2, goal: gx,
        solution: [
          [`@${bx + 0.75}`, 'W5'],
          ['Wo:d1', `R@${wx - 1}`, 'R20', 'W5'],
          ['Wo:d1', `@${fx(wx - 1.8)}`, 'RJ25', 'Rg', 'W2', 'RJ30', 'Rg', ...travel(after, wx + 1, gx)]
        ]
      };
    }
  }
];

export const TEMPLATE_TAGS = TEMPLATES.map((t) => t.tag);

function mirrorRaw(raw) {
  const W = raw.size.w;
  const fr = (r) => ({ ...r, x: W - r.x - r.w });
  const out = { ...raw };
  out.platforms = raw.platforms.map(fr);
  out.hazards = raw.hazards.map(fr);
  out.buttons = raw.buttons.map((b) => ({ ...b, x: W - b.x - (b.w ?? 1) }));
  out.doors = raw.doors.map(fr);
  out.movers = raw.movers.map((m) => ({ ...fr(m), to: { x: W - m.to.x - m.w, y: m.to.y } }));
  out.spawn = { x: W - raw.spawn.x, y: raw.spawn.y };
  out.goal = { x: W - raw.goal.x, y: raw.goal.y };
  out.solution = mirrorSolution(raw.solution, W);
  return out;
}

/** Egy sablon + seed → nyers (JSON-formátumú) pálya, még ellenőrzés nélkül */
export function buildCandidate(seed, forcedTag = null) {
  const rng = mulberry32(seed);
  const tpl = forcedTag ? TEMPLATES.find((t) => t.tag === forcedTag) : rng.pick(TEMPLATES);
  const res = tpl.build(rng);
  const L = res.L;
  buildFloor(L);
  let raw = {
    id: 'daily',
    name: 'Daily Loop',
    size: { w: COLS, h: ROWS },
    timeLimit: 15,
    ghosts: res.ghosts,
    spawn: { x: 2, y: FLOOR },
    goal: { x: res.goal, y: res.goalY ?? FLOOR },
    platforms: L.platforms,
    hazards: L.hazards,
    buttons: L.buttons,
    doors: L.doors,
    movers: L.movers,
    solution: res.solution
  };
  if (rng.chance(0.5)) raw = mirrorRaw(raw);
  return { raw, tag: tpl.tag };
}

/** Ellenőrzés: betölthető, a megoldás nyer, pontosan a megadott számú szellemmel */
export function verifyRaw(raw) {
  let level;
  try {
    level = loadLevel(raw);
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  const res = runSolution(level, raw.solution);
  if (!res.ok) return { ok: false, reason: res.reason };
  if (res.ghosts.length !== raw.ghosts) return { ok: false, reason: 'ghost count mismatch' };
  return { ok: true, res };
}

/**
 * A nap pályája. Csak ellenőrzötten megoldható pályát ad vissza.
 * @param key "YYYY-MM-DD"
 * @param fallbackPool kézzel tervezett, tesztelt pályák (nyers JSON) végső esetre
 */
export function generateDaily(key, fallbackPool = []) {
  const number = dailyNumber(key);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = hashString(`ghostloop:${key}:${attempt}`);
    const { raw, tag } = buildCandidate(seed);
    const first = verifyRaw(raw);
    if (!first.ok) continue;
    // Időkeret szűkítése a leghosszabb kör alapján, majd újraellenőrzés
    const longest = Math.max(...first.res.roundFrames) / 60;
    raw.timeLimit = Math.min(15, Math.max(8, Math.ceil(longest * 1.5 + 2)));
    const second = verifyRaw(raw);
    if (!second.ok) continue;
    raw.name = `Daily Loop #${number}`;
    raw.id = `daily-${key}`;
    raw.hint = 'Same loop for everyone today. Fewer attempts, fewer ghosts, faster time.';
    return { raw, key, number, tag, attempt, fallback: false };
  }
  // Végső tartalék: tesztekkel igazolt kézi pálya
  if (fallbackPool.length) {
    const pick = fallbackPool[hashString(key) % fallbackPool.length];
    const raw = { ...pick, id: `daily-${key}`, name: `Daily Loop #${number}` };
    return { raw, key, number, tag: 'handmade', attempt: MAX_ATTEMPTS, fallback: true };
  }
  throw new Error(`no verified daily level for ${key}`);
}
