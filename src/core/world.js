// A pálya teljes, determinisztikus szimulációja: élő játékos, szellemek,
// gombok, ajtók, mozgó platformok és veszélyek. Phaser-független, így tesztelhető
// és a napi pálya-generátor is ezzel ellenőrzi a megoldhatóságot.

import { createBody, stepBody, overlaps, overlapsInset } from './physics.js';
import { inputAt } from './replay.js';

const SPIKE_INSET = 4;
const BLOCK_INSET = 3;

// Háromszög-hullám [0,1]-ben: oda-vissza mozgó elemekhez
function pingPong(t) {
  const m = t % 2;
  return m < 1 ? m : 2 - m;
}

/**
 * Oda-vissza mozgás helyzete [0,1]-ben, opcionális megállással a végpontokon.
 * pause = 0 esetén pontosan a régi pingPong-ot adja (a meglévő pályák bitre egyeznek).
 */
function shuttle(frame, d, len) {
  if (len <= 0) return 0;
  if (!d.pause) return pingPong((frame * d.speed) / len + d.phase);
  const leg = len / d.speed;
  const hold = d.pause * 60;
  const cycle = 2 * leg + 2 * hold;
  const tt = (frame + d.phase * leg) % cycle;
  if (tt < leg) return tt / leg;
  if (tt < leg + hold) return 1;
  if (tt < 2 * leg + hold) return 1 - (tt - leg - hold) / leg;
  return 0;
}

export class World {
  /**
   * @param level betöltött (loadLevel) pálya
   * @param recordings korábbi körök input-tömbjei, régebbi elől
   */
  constructor(level, recordings = []) {
    this.level = level;
    this.frame = 0;
    this.status = 'playing'; // playing | won | dead | timeout
    this.liveInputs = [];
    this.recordings = recordings;

    const sx = level.spawn.x;
    const sy = level.spawn.y;
    this.ghosts = recordings.map((rec, index) => {
      const body = createBody(sx, sy);
      body.index = index;
      body.ghost = true;
      body.rec = rec;
      return body;
    });
    this.player = createBody(sx, sy);
    this.player.index = recordings.length;
    this.player.ghost = false;
    this.entities = [...this.ghosts, this.player];

    this.movers = level.movers.map((m) => {
      const len = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);
      return { def: m, x: m.from.x, y: m.from.y, w: m.w, h: m.h, dx: 0, dy: 0, dist: 0, len };
    });
    this.hazards = level.hazards.map((h) => {
      const len = h.to ? Math.hypot(h.to.x - h.from.x, h.to.y - h.from.y) : 0;
      return { def: h, x: h.x, y: h.y, w: h.w, h: h.h, len };
    });
    this.doors = level.doors.map((d) => ({ def: d, x: d.x, y: d.y, w: d.w, h: d.h, solid: !d.invert, active: false }));
    this.buttons = level.buttons.map((b) => ({ def: b, pressed: false }));
    this.buttonMap = new Map();

    this._placeKinematics(0);
    this._updateButtons([]);
    this._updateDoors([]);
  }

  // Idő alapú (állapot nélküli) oda-vissza mozgás a nem gombvezérelt elemeknél
  _placeKinematics(frame) {
    for (const m of this.movers) {
      const d = m.def;
      const ox = m.x;
      const oy = m.y;
      if (!d.buttons) {
        m.dist = shuttle(frame, d, m.len) * m.len;
      } else {
        const active = this._linkActive(d.buttons, d.mode);
        const target = active ? m.len : 0;
        if (m.dist < target) m.dist = Math.min(target, m.dist + d.speed);
        else if (m.dist > target) m.dist = Math.max(target, m.dist - d.speed);
      }
      const k = m.len > 0 ? m.dist / m.len : 0;
      m.x = d.from.x + (d.to.x - d.from.x) * k;
      m.y = d.from.y + (d.to.y - d.from.y) * k;
      m.dx = frame === 0 ? 0 : m.x - ox;
      m.dy = frame === 0 ? 0 : m.y - oy;
    }
    for (const h of this.hazards) {
      const d = h.def;
      if (!d.to) continue;
      const t = shuttle(frame, d, h.len);
      h.prevX = frame === 0 ? d.from.x + (d.to.x - d.from.x) * t : h.x;
      h.prevY = frame === 0 ? d.from.y + (d.to.y - d.from.y) * t : h.y;
      h.x = d.from.x + (d.to.x - d.from.x) * t;
      h.y = d.from.y + (d.to.y - d.from.y) * t;
    }
  }

  _linkActive(ids, mode) {
    if (mode === 'all') return ids.every((id) => this.buttonMap.get(id));
    return ids.some((id) => this.buttonMap.get(id));
  }

  _updateButtons(events) {
    for (const b of this.buttons) {
      let pressed = false;
      for (const e of this.entities) {
        if (e.alive && overlaps(e, b.def)) {
          pressed = true;
          break;
        }
      }
      if (pressed !== b.pressed) {
        b.pressed = pressed;
        events.push({ type: 'button', id: b.def.id, pressed });
      }
      this.buttonMap.set(b.def.id, pressed);
    }
  }

  _updateDoors(events) {
    for (const d of this.doors) {
      d.active = this._linkActive(d.def.buttons, d.def.mode);
      const wantSolid = d.def.invert ? d.active : !d.active;
      if (wantSolid === d.solid) continue;
      if (wantSolid) {
        // Nem zárunk rá senkire: amíg valaki benne áll, nyitva marad
        const blocked = this.entities.some((e) => e.alive && overlaps(e, d));
        if (blocked) continue;
      }
      d.solid = wantSolid;
      events.push({ type: 'door', id: d.def.id, solid: wantSolid });
    }
  }

  isDoorOpen(id) {
    const d = this.doors.find((x) => x.def.id === id);
    return d ? !d.solid : false;
  }

  /** Egy fix időlépés. @param bits az élő játékos inputja erre a lépésre */
  step(bits) {
    const events = [];
    if (this.status !== 'playing') return events;
    const f = this.frame;
    this.liveInputs.push(bits);

    this._placeKinematics(f + 1);
    this._updateDoors(events);

    const solids = this.level.solids.slice();
    for (const d of this.doors) if (d.solid) solids.push(d);

    // Sorrend: régebbi szellemek előbb, az élő játékos utoljára. Mindenki csak
    // a nála régebbi szellemekre állhat rá, így a korábbi körök pontosan ismétlődnek.
    const platforms = this.movers.slice();
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.alive) continue;
      if (e.groundRef && e.groundRef.alive === false) e.groundRef = null;
      const input = e.ghost ? inputAt(e.rec, f) : bits;
      const evs = stepBody(e, input, solids, platforms);
      for (const t of evs) events.push({ type: t, who: e.index, ghost: e.ghost });
      if (e.ghost && f === e.rec.length) events.push({ type: 'ghostEnd', who: e.index });
      if (e.ghost) platforms.push(e);
    }

    // Veszélyek és kiesés
    for (const e of this.entities) {
      if (!e.alive) continue;
      let dead = e.y > this.level.height + 40;
      if (!dead) {
        for (const h of this.hazards) {
          const inset = h.def.kind === 'spikes' ? SPIKE_INSET : BLOCK_INSET;
          if (overlapsInset(e, h, inset)) {
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        e.alive = false;
        e.dx = 0;
        e.dy = 0;
        events.push({ type: 'death', who: e.index, ghost: e.ghost, x: e.x + e.w / 2, y: e.y + e.h / 2 });
      }
    }

    this._updateButtons(events);
    this.frame = f + 1;

    if (!this.player.alive) {
      this.status = 'dead';
    } else if (overlaps(this.player, this.level.goal)) {
      this.status = 'won';
      events.push({ type: 'win', frame: this.frame });
    } else if (this.frame >= this.level.frameLimit) {
      this.status = 'timeout';
      events.push({ type: 'timeout' });
    }
    return events;
  }
}

export function createWorld(level, recordings) {
  return new World(level, recordings);
}
