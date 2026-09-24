// Megoldás-ellenőrző: egy egyszerű "bot" nyelv (tokenek) alapján inputokat állít elő,
// körönként szellemet rögzít, és a determinisztikus szimulációval igazolja, hogy a
// pálya teljesíthető. A kézi pályák tesztjei és a napi generátor is ezt használja.
//
// Tokenek (x értékek rácsegységben, a játékos középpontjára):
//   R30 / L30 / W30     jobbra / balra / semmi 30 lépésig
//   RJ20 / LJ20 / J20   ugrás lenyomva tartva (+ irány) 20 lépésig
//   Rg / RJg / Wg       ...amíg újra talajt nem ér
//   Wo:d1 / Ro:d1       ...amíg a "d1" ajtó nyitva nincs (vagy a "p1" platform a végén)
//   T120                várakozás, amíg a kör el nem éri a 120. lépést
//   @12.5               odasétál x = 12.5-höz és megáll
//   R@12.5 / L@12.5     fut, amíg a középpont el nem éri x = 12.5-öt (nem fékez)

import { IN_LEFT, IN_RIGHT, IN_JUMP, TILE, GROUND_DECEL } from './physics.js';
import { createWorld } from './world.js';

const MAX_TOKEN_FRAMES = 900;

function dirBits(c) {
  return c === 'L' ? IN_LEFT : c === 'R' ? IN_RIGHT : 0;
}

/** Egy token → állapotgép, ami lépésenként inputot ad, vagy null-t, ha végzett. */
function makeAction(token) {
  let m;
  if ((m = /^([LRW]?)(J?)(\d+)$/.exec(token))) {
    const bits = dirBits(m[1]) | (m[2] ? IN_JUMP : 0);
    let left = parseInt(m[3], 10);
    return () => (left-- > 0 ? bits : null);
  }
  if ((m = /^([LRW]?)(J?)g$/.exec(token))) {
    const bits = dirBits(m[1]) | (m[2] ? IN_JUMP : 0);
    let n = 0;
    return (w) => {
      n++;
      if (n > 2 && w.player.grounded) return null;
      return bits;
    };
  }
  if ((m = /^([LRW]?)(J?)o:(\w+)$/.exec(token))) {
    const bits = dirBits(m[1]) | (m[2] ? IN_JUMP : 0);
    const id = m[3];
    return (w) => {
      const mover = w.movers.find((x) => x.def.id === id);
      const done = mover ? mover.dist >= mover.len : w.isDoorOpen(id);
      return done ? null : bits;
    };
  }
  if ((m = /^T(\d+)$/.exec(token))) {
    const until = parseInt(m[1], 10);
    return (w) => (w.frame < until ? 0 : null);
  }
  if ((m = /^([LR])@(-?[\d.]+)$/.exec(token))) {
    const right = m[1] === 'R';
    const target = parseFloat(m[2]) * TILE;
    return (w) => {
      const cx = w.player.x + w.player.w / 2;
      if (right ? cx >= target : cx <= target) return null;
      return right ? IN_RIGHT : IN_LEFT;
    };
  }
  if ((m = /^@(-?[\d.]+)$/.exec(token))) {
    const target = parseFloat(m[1]) * TILE;
    return (w) => {
      const p = w.player;
      const d = target - (p.x + p.w / 2);
      if (Math.abs(d) <= 1.5 && Math.abs(p.vx) < 0.01) return null;
      const brake = (p.vx * p.vx) / (2 * GROUND_DECEL) + Math.abs(p.vx);
      if (d > 0) {
        if (p.vx > 0 && brake >= d) return 0;
        return d > 1.5 ? IN_RIGHT : 0;
      }
      if (p.vx < 0 && brake >= -d) return 0;
      return d < -1.5 ? IN_LEFT : 0;
    };
  }
  throw new Error(`unknown solution token "${token}"`);
}

/** Tokenlistából input-forrást készít. */
export function makeBot(tokens) {
  let idx = 0;
  let action = null;
  let spent = 0;
  return (world) => {
    for (;;) {
      if (!action) {
        if (idx >= tokens.length) return null;
        action = makeAction(tokens[idx++]);
        spent = 0;
      }
      const bits = action(world);
      if (bits === null) {
        action = null;
        continue;
      }
      if (++spent > MAX_TOKEN_FRAMES) throw new Error(`token "${tokens[idx - 1]}" never finished`);
      return bits;
    }
  };
}

/**
 * Egy teljes megoldás lefuttatása (körök tokenlistái). Az utolsó előtti körök végén
 * rögzítünk (mint az R gomb), az utolsó körnek célba kell érnie.
 * @returns {{ok:boolean, reason?:string, ghosts:Uint8Array[], frames:number, rounds:number}}
 */
export function runSolution(level, solution) {
  const ghosts = [];
  if (!solution || solution.length === 0) return { ok: false, reason: 'no solution', ghosts, frames: 0, rounds: 0 };
  for (let r = 0; r < solution.length; r++) {
    const last = r === solution.length - 1;
    const world = createWorld(level, ghosts);
    let bot;
    try {
      bot = makeBot(solution[r]);
      while (world.status === 'playing') {
        const bits = bot(world);
        if (bits === null && !last) break;
        world.step(bits === null ? 0 : bits);
      }
    } catch (err) {
      return { ok: false, reason: `round ${r + 1}: ${err.message}`, ghosts, frames: world.frame, rounds: r + 1 };
    }
    if (!last) {
      if (world.status !== 'playing') {
        return { ok: false, reason: `round ${r + 1} ended with "${world.status}" before recording`, ghosts, frames: world.frame, rounds: r + 1 };
      }
      if (world.frame === 0) return { ok: false, reason: `round ${r + 1} is empty`, ghosts, frames: 0, rounds: r + 1 };
      ghosts.push(Uint8Array.from(world.liveInputs));
    } else if (world.status !== 'won') {
      const p = world.player;
      return {
        ok: false,
        reason: `final round ended with "${world.status}" at frame ${world.frame} (player x=${((p.x + p.w / 2) / TILE).toFixed(2)}, y=${((p.y + p.h) / TILE).toFixed(2)})`,
        ghosts,
        frames: world.frame,
        rounds: r + 1
      };
    } else {
      return { ok: true, ghosts, frames: world.frame, rounds: r + 1 };
    }
  }
  return { ok: false, reason: 'unreachable', ghosts, frames: 0, rounds: 0 };
}

/** Megoldás tükrözése vízszintesen (napi generátorhoz) */
export function mirrorSolution(solution, cols) {
  const flip = (v) => +(cols - parseFloat(v)).toFixed(3);
  return solution.map((round) =>
    round.map((t) => {
      let m;
      if ((m = /^@(-?[\d.]+)$/.exec(t))) return `@${flip(m[1])}`;
      if ((m = /^([LR])@(-?[\d.]+)$/.exec(t))) return `${m[1] === 'L' ? 'R' : 'L'}@${flip(m[2])}`;
      if (/^[LR]/.test(t)) return (t[0] === 'L' ? 'R' : 'L') + t.slice(1);
      return t;
    })
  );
}
