// Determinisztikus platformer-fizika fix időlépéssel (1 lépés = 1/60 s).
// Csak alap aritmetikát használunk (+, -, *, /, min, max), így ugyanaz az
// input mindig bitre pontosan ugyanazt a mozgást adja – erre épül a szellem-visszajátszás.

export const TILE = 30; // egy rácsegység pixelben
export const STEP_HZ = 60; // fizikai lépések másodpercenként
export const STEP_MS = 1000 / STEP_HZ;

// Input bitek (egy képkocka inputja egyetlen bájt)
export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;

// Játékos méretei és mozgási konstansai (px, px/lépés, px/lépés²)
export const BODY_W = 22;
export const BODY_H = 28;
export const GRAVITY = 0.55;
export const MAX_FALL = 10;
export const RUN_MAX = 3.4;
export const GROUND_ACCEL = 0.8;
export const GROUND_DECEL = 0.9;
export const AIR_ACCEL = 0.55;
export const AIR_DECEL = 0.2;
export const JUMP_V = -9.4;
export const JUMP_CUT = -3.5; // korán elengedett ugrásnál ennyire vágjuk a felfelé sebességet
export const COYOTE_FRAMES = 6; // ennyi lépésig még lehet ugrani a perem elhagyása után
export const JUMP_BUFFER_FRAMES = 6; // ennyi lépéssel a földet érés előtt lenyomott ugrás is érvényes

const EPS = 0.01;
// egyirányú platformra (lift, szellem) ennyi px-rel a teteje alól is "fellép" a test
const STEP_UP = 4;

/** Új test (élő játékos vagy szellem) a megadott talppontra (középső x, alsó y). */
export function createBody(spawnX, spawnBottom) {
  const x = spawnX - BODY_W / 2;
  const y = spawnBottom - BODY_H;
  return {
    x, y, w: BODY_W, h: BODY_H,
    vx: 0, vy: 0,
    prevX: x, prevY: y, // előző lépés pozíciója (interpolációhoz és hordozáshoz)
    dx: 0, dy: 0, // ebben a lépésben megtett elmozdulás (a rajta állók ezzel mozognak)
    grounded: false,
    groundRef: null, // mozgó talaj (szellem vagy mozgó platform), amin áll
    coyote: 0,
    jumpBuffer: 0,
    prevJumpHeld: false,
    facing: 1,
    alive: true
  };
}

/** Két téglalap szigorú átfedése (az érintkezés nem számít átfedésnek). */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Átfedés befelé zsugorított második téglalappal (megbocsátó veszély-hitbox). */
export function overlapsInset(a, b, inset) {
  return (
    a.x < b.x + b.w - inset &&
    a.x + a.w > b.x + inset &&
    a.y < b.y + b.h - inset &&
    a.y + a.h > b.y + inset
  );
}

/**
 * Egy test egy fizikai lépése.
 * @param body a test állapota (helyben módosul)
 * @param bits az adott lépés inputja (IN_* bitek)
 * @param solids tömör téglalapok listája (fal, padló, zárt ajtó)
 * @param platforms egyirányú platformok (csak felülről lehet rájuk állni): {x,y,w,dx,dy}
 * @returns események tömbje ('jump', 'land')
 */
export function stepBody(body, bits, solids, platforms) {
  const events = [];
  body.prevX = body.x;
  body.prevY = body.y;

  const dir = ((bits & IN_RIGHT) ? 1 : 0) - ((bits & IN_LEFT) ? 1 : 0);
  const jumpHeld = (bits & IN_JUMP) !== 0;
  const jumpPressed = jumpHeld && !body.prevJumpHeld;
  body.prevJumpHeld = jumpHeld;

  // Vízszintes gyorsulás / lassulás
  if (dir !== 0) {
    const accel = body.grounded ? GROUND_ACCEL : AIR_ACCEL;
    body.vx += dir * accel;
    if (body.vx > RUN_MAX) body.vx = RUN_MAX;
    if (body.vx < -RUN_MAX) body.vx = -RUN_MAX;
    body.facing = dir;
  } else {
    const decel = body.grounded ? GROUND_DECEL : AIR_DECEL;
    if (body.vx > 0) body.vx = Math.max(0, body.vx - decel);
    else if (body.vx < 0) body.vx = Math.min(0, body.vx + decel);
  }

  // Ugrás: puffer + coyote idő
  body.jumpBuffer = jumpPressed ? JUMP_BUFFER_FRAMES : Math.max(0, body.jumpBuffer - 1);
  body.coyote = body.grounded ? COYOTE_FRAMES : Math.max(0, body.coyote - 1);
  if (body.jumpBuffer > 0 && body.coyote > 0) {
    body.vy = JUMP_V;
    body.jumpBuffer = 0;
    body.coyote = 0;
    body.grounded = false;
    body.groundRef = null;
    events.push('jump');
  }
  // Változó ugrásmagasság: elengedett gombnál levágjuk az emelkedést
  if (!jumpHeld && body.vy < JUMP_CUT) body.vy = JUMP_CUT;

  body.vy += GRAVITY;
  if (body.vy > MAX_FALL) body.vy = MAX_FALL;

  // Hordozás: ha mozgó dolgon álltunk, vele mozgunk
  const ref = body.groundRef;
  const carryX = ref ? ref.dx : 0;
  const carryY = ref ? ref.dy : 0;

  // X tengely
  const moveX = body.vx + carryX;
  body.x += moveX;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    // függőlegesen EPS-nél kisebb átfedés nem fal (lebegőpontos hiba mozgó platformon)
    if (!(body.x < s.x + s.w && body.x + body.w > s.x && body.y < s.y + s.h - EPS && body.y + body.h > s.y + EPS)) continue;
    if (moveX > 0) body.x = s.x - body.w;
    else if (moveX < 0) body.x = s.x + s.w;
    else {
      // álló test esetén a közelebbi oldalra toljuk ki
      const cx = body.x + body.w / 2;
      body.x = cx < s.x + s.w / 2 ? s.x - body.w : s.x + s.w;
    }
    body.vx = 0;
  }

  // Y tengely
  body.y += carryY;
  const prevBottom = body.y + body.h;
  const wasGrounded = body.grounded;
  body.grounded = false;
  body.groundRef = null;
  body.y += body.vy;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!overlaps(body, s)) continue;
    if (body.vy > 0 || body.y + body.h / 2 < s.y + s.h / 2) {
      body.y = s.y - body.h;
      body.vy = 0;
      body.grounded = true;
    } else {
      body.y = s.y + s.h;
      if (body.vy < 0) body.vy = 0;
    }
  }
  // Egyirányú platformok: csak akkor állunk rájuk, ha felülről érkezünk
  if (body.vy >= 0) {
    let best = null;
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (body.x + body.w <= p.x || body.x >= p.x + p.w) continue;
      if (prevBottom <= p.y + STEP_UP && body.y + body.h >= p.y) {
        if (best === null || p.y < best.y) best = p;
      }
    }
    if (best !== null) {
      body.y = best.y - body.h;
      body.vy = 0;
      body.grounded = true;
      body.groundRef = best;
    }
  }
  if (body.grounded && !wasGrounded) events.push('land');

  body.dx = body.x - body.prevX;
  body.dy = body.y - body.prevY;
  return events;
}
