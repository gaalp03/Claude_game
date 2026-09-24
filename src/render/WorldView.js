// A szimuláció kirajzolása Phaser Graphics-szal: minden alakzat kódból, képfájl nélkül.
// A fizika 60 Hz-en lép; a rajzolás interpolál az előző és a mostani állapot között,
// így 120 Hz-es kijelzőn is folyamatos a mozgás.

import Phaser from 'phaser';
import { COLORS, ghostAlpha } from '../ui/theme.js';

const TRAIL_LEN = 16;

const lerp = (a, b, t) => a + (b - a) * t;

export class WorldView {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.time = 0;

    // gomb → szín hozzárendelés (a gombok sorrendje alapján)
    this.linkColor = new Map();
    level.buttons.forEach((b, i) => this.linkColor.set(b.id, COLORS.links[i % COLORS.links.length]));

    // minden pálya-elem egy konténerben: mobilon kicsinyítve, a vezérlők fölé tesszük
    this.root = scene.add.container(0, 0);
    this.bg = scene.add.graphics();
    this.staticG = scene.add.graphics();
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.dyn = scene.add.graphics();
    this.fx = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.root.add([this.bg, this.staticG, this.glow, this.dyn, this.fx]);

    this.emitters = {};
    const mk = (key, color, extra = {}) => {
      this.emitters[key] = scene.add.particles(0, 0, 'spark', {
        speed: { min: 60, max: 280 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 280, max: 750 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 380,
        tint: color,
        blendMode: 'ADD',
        emitting: false,
        ...extra
      });
      this.root.add(this.emitters[key]);
    };
    mk('live', COLORS.live);
    mk('ghost', COLORS.ghost);
    mk('hazard', COLORS.hazard);
    mk('goal', COLORS.goal, { speed: { min: 80, max: 380 }, lifespan: { min: 500, max: 1200 }, gravityY: 120 });
    mk('dust', 0x8fa0ff, { speed: { min: 10, max: 60 }, lifespan: { min: 150, max: 350 }, gravityY: -40, scale: { start: 0.6, end: 0 } });

    this.doorOpen = new Map(); // ajtó id → látható nyitottság 0..1
    this.squash = new Map(); // entitás index → {sx, sy}
    this.trails = [];
    this._drawStatic();
  }

  destroy() {
    this.root.destroy();
  }

  /** Pálya elhelyezése a képernyőn (asztalon teljes méret, érintős módban kisebb) */
  setLayout(scale, x, y) {
    this.root.setScale(scale).setPosition(x, y);
  }

  _drawStatic() {
    const { level } = this;
    const g = this.bg;
    g.fillStyle(COLORS.bg, 1);
    g.fillRect(-40, -40, level.width + 80, level.height + 80);
    g.lineStyle(1, COLORS.grid, 0.6);
    for (let x = 0; x <= level.width; x += 30) g.lineBetween(x, 0, x, level.height);
    for (let y = 0; y <= level.height; y += 30) g.lineBetween(0, y, level.width, y);

    const s = this.staticG;
    // platformok
    for (const p of level.solids) {
      if (p.border) continue;
      s.fillStyle(COLORS.platform, 1);
      s.fillRect(p.x, p.y, p.w, p.h);
      s.lineStyle(1, COLORS.platformEdge, 0.35);
      s.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      s.lineStyle(2, COLORS.platformEdge, 0.95);
      s.lineBetween(p.x, p.y + 1, p.x + p.w, p.y + 1);
    }
    // álló tüskék
    for (const h of level.hazards) {
      if (h.to) continue;
      this._spikes(s, h.x, h.y, h.w, h.h);
      s.fillStyle(COLORS.hazard, 0.08);
      s.fillRect(h.x - 3, h.y - 6, h.w + 6, h.h + 6);
    }
    // mozgó platformok pályája
    for (const m of level.movers) {
      const col = m.buttons ? this.linkColor.get(m.buttons[0]) : COLORS.dim;
      s.lineStyle(1, col, 0.25);
      const cx0 = m.from.x + m.w / 2;
      const cx1 = m.to.x + m.w / 2;
      const steps = Math.max(1, Math.floor(Math.hypot(cx1 - cx0, m.to.y - m.from.y) / 10));
      for (let i = 0; i < steps; i += 2) {
        const a = i / steps;
        const b = Math.min(1, (i + 1) / steps);
        s.lineBetween(lerp(cx0, cx1, a), lerp(m.from.y, m.to.y, a), lerp(cx0, cx1, b), lerp(m.from.y, m.to.y, b));
      }
    }
  }

  _spikes(g, x, y, w, h) {
    const n = Math.max(1, Math.round(w / 10));
    const sw = w / n;
    g.fillStyle(COLORS.hazard, 1);
    for (let i = 0; i < n; i++) {
      g.fillTriangle(x + i * sw, y + h, x + i * sw + sw / 2, y, x + (i + 1) * sw, y + h);
    }
  }

  /** Új kör: nyomvonalak és animációs állapotok törlése */
  resetRound(world) {
    this.trails = world.ghosts.map(() => []);
    this.squash.clear();
    for (const d of world.doors) this.doorOpen.set(d.def.id, d.solid ? 0 : 1);
  }

  /** Szimulációs események vizuális lekövetése */
  onEvent(ev, world) {
    const e = ev.who !== undefined ? world.entities[ev.who] : null;
    if (ev.type === 'jump' && e) {
      this.squash.set(ev.who, { sx: 0.78, sy: 1.25 });
      if (!e.ghost) this.emitters.dust.explode(4, e.x + e.w / 2, e.y + e.h);
    } else if (ev.type === 'land' && e) {
      this.squash.set(ev.who, { sx: 1.25, sy: 0.78 });
      if (!e.ghost) this.emitters.dust.explode(5, e.x + e.w / 2, e.y + e.h);
    } else if (ev.type === 'death') {
      if (ev.ghost) {
        this.emitters.ghost.explode(22, ev.x, ev.y);
      } else {
        this.emitters.live.explode(34, ev.x, ev.y);
        this.emitters.hazard.explode(18, ev.x, ev.y);
      }
    } else if (ev.type === 'win') {
      const p = world.player;
      this.emitters.goal.explode(60, p.x + p.w / 2, p.y + p.h / 2);
      this.emitters.live.explode(20, p.x + p.w / 2, p.y + p.h / 2);
    }
  }

  /** Szellem rögzítésekor a játékos helyén lila robbanás */
  ghostBurst(x, y) {
    this.emitters.ghost.explode(30, x, y);
  }

  /** Nyomvonalak frissítése fizikai lépésenként */
  afterStep(world) {
    world.ghosts.forEach((g, i) => {
      const t = this.trails[i] || (this.trails[i] = []);
      if (!g.alive) {
        t.length = 0;
        return;
      }
      t.push(g.x, g.y);
      if (t.length > TRAIL_LEN * 2) t.splice(0, 2);
    });
  }

  draw(world, alpha, dtMs, ready) {
    this.time += dtMs / 1000;
    const g = this.dyn;
    const gl = this.glow;
    g.clear();
    gl.clear();
    this.fx.clear();
    const t = this.time;

    // cél: villogó zöld kapu
    const goal = this.level.goal;
    const pulse = 0.55 + 0.45 * Math.sin(t * 6);
    gl.fillStyle(COLORS.goal, 0.08 + 0.1 * pulse);
    gl.fillRect(goal.x - 8, goal.y - 8, goal.w + 16, goal.h + 16);
    g.fillStyle(COLORS.goal, 0.18 + 0.2 * pulse);
    g.fillRect(goal.x, goal.y, goal.w, goal.h);
    g.lineStyle(2, COLORS.goal, 0.6 + 0.4 * pulse);
    g.strokeRect(goal.x + 1, goal.y + 1, goal.w - 2, goal.h - 2);
    const bar = (t * 40) % goal.h;
    g.lineStyle(2, COLORS.goal, 0.8);
    g.lineBetween(goal.x + 3, goal.y + goal.h - bar, goal.x + goal.w - 3, goal.y + goal.h - bar);

    // gombok
    for (const b of world.buttons) {
      const d = b.def;
      const col = this.linkColor.get(d.id);
      const hgt = b.pressed ? 2 : 5;
      if (b.pressed) {
        gl.fillStyle(col, 0.25);
        gl.fillRect(d.x - 4, d.surface - 12, d.w + 8, 14);
      }
      g.fillStyle(col, b.pressed ? 1 : 0.8);
      g.fillRect(d.x + 2, d.surface - hgt, d.w - 4, hgt);
      g.fillStyle(col, 0.4);
      g.fillRect(d.x, d.surface - 1, d.w, 1);
    }

    // ajtók (függőleges: felcsúszik; vízszintes híd: elhalványul)
    for (const d of world.doors) {
      const id = d.def.id;
      const target = d.solid ? 0 : 1;
      let v = this.doorOpen.get(id) ?? target;
      v += (target - v) * Math.min(1, dtMs / 70);
      if (Math.abs(target - v) < 0.01) v = target;
      this.doorOpen.set(id, v);
      const col = this.linkColor.get(d.def.buttons[0]);
      const vertical = d.h >= d.w;
      if (vertical) {
        const h = d.h * (1 - v);
        if (h > 0.5) {
          g.fillStyle(col, 0.28);
          g.fillRect(d.x, d.y, d.w, h);
          g.lineStyle(2, col, 0.9);
          g.strokeRect(d.x + 1, d.y + 1, d.w - 2, Math.max(0, h - 2));
          g.lineStyle(1, col, 0.5);
          for (let yy = d.y + 8; yy < d.y + h - 2; yy += 8) g.lineBetween(d.x + 4, yy, d.x + d.w - 4, yy);
          gl.fillStyle(col, 0.1);
          gl.fillRect(d.x - 4, d.y, d.w + 8, h);
        }
        g.lineStyle(1, col, 0.18);
        g.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
      } else {
        const a = 1 - v;
        g.lineStyle(1, col, 0.25);
        g.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
        if (a > 0.02) {
          g.fillStyle(col, 0.45 * a);
          g.fillRect(d.x, d.y, d.w, d.h);
          g.lineStyle(2, col, a);
          g.lineBetween(d.x, d.y + 1, d.x + d.w, d.y + 1);
          gl.fillStyle(col, 0.12 * a);
          gl.fillRect(d.x, d.y - 4, d.w, d.h + 8);
        }
      }
      // jelzőfények: melyik gombok kellenek, és melyik aktív
      const n = d.def.buttons.length;
      const lx = vertical ? d.x + d.w / 2 : d.x + d.w / 2 - (n - 1) * 5;
      d.def.buttons.forEach((bid, i) => {
        const on = world.buttonMap.get(bid);
        const bc = this.linkColor.get(bid);
        const px = vertical ? lx : lx + i * 10;
        const py = vertical ? d.y - 6 - i * 9 : d.y - 6;
        g.fillStyle(bc, on ? 1 : 0.3);
        g.fillCircle(px, py, 3);
        if (on) {
          gl.fillStyle(bc, 0.35);
          gl.fillCircle(px, py, 7);
        }
      });
    }

    // mozgó platformok (interpolálva)
    for (const m of world.movers) {
      const col = m.def.buttons ? this.linkColor.get(m.def.buttons[0]) : 0x9fb4ff;
      const x = m.x - m.dx * (1 - alpha);
      const y = m.y - m.dy * (1 - alpha);
      g.fillStyle(col, 0.35);
      g.fillRect(x, y, m.w, m.h);
      g.lineStyle(3, col, 1);
      g.lineBetween(x, y + 1.5, x + m.w, y + 1.5);
      gl.fillStyle(col, 0.12);
      gl.fillRect(x - 3, y - 4, m.w + 6, m.h + 8);
    }

    // mozgó veszélyes falak
    for (const h of world.hazards) {
      if (!h.def.to) continue;
      const x = lerp(h.prevX ?? h.x, h.x, alpha);
      const y = lerp(h.prevY ?? h.y, h.y, alpha);
      gl.fillStyle(COLORS.hazard, 0.18);
      gl.fillRect(x - 5, y - 5, h.w + 10, h.h + 10);
      g.fillStyle(COLORS.hazard, 0.35);
      g.fillRect(x, y, h.w, h.h);
      g.lineStyle(2, COLORS.hazard, 1);
      g.strokeRect(x + 1, y + 1, h.w - 2, h.h - 2);
      g.lineStyle(1, COLORS.hazard, 0.7);
      for (let k = 6; k < h.w + h.h; k += 10) {
        const x0 = x + Math.min(k, h.w);
        const y0 = y + Math.max(0, k - h.w);
        const x1 = x + Math.max(0, k - h.h);
        const y1 = y + Math.min(k, h.h);
        g.lineBetween(x0, y0, x1, y1);
      }
    }

    // szellemek nyomvonala
    const count = world.ghosts.length;
    world.ghosts.forEach((gh, i) => {
      const tr = this.trails[i];
      if (!tr || !gh.alive) return;
      const a = ghostAlpha(i, count);
      const n = tr.length / 2;
      for (let k = 0; k < n; k++) {
        const f = (k + 1) / n;
        const size = 4 + f * 8;
        this.fx.fillStyle(COLORS.ghost, a * 0.28 * f);
        this.fx.fillRect(tr[k * 2] + gh.w / 2 - size / 2, tr[k * 2 + 1] + gh.h / 2 - size / 2, size, size);
      }
    });

    // entitások
    for (const e of world.entities) {
      if (!e.alive) continue;
      const x = lerp(e.prevX, e.x, alpha);
      const y = lerp(e.prevY, e.y, alpha);
      const sq = this.squash.get(e.index);
      let sx = 1;
      let sy = 1;
      if (sq) {
        sq.sx += (1 - sq.sx) * Math.min(1, dtMs / 90);
        sq.sy += (1 - sq.sy) * Math.min(1, dtMs / 90);
        sx = sq.sx;
        sy = sq.sy;
      }
      const w = e.w * sx;
      const h = e.h * sy;
      const bx = x + e.w / 2 - w / 2;
      const by = y + e.h - h;
      if (e.ghost) {
        const a = ghostAlpha(e.index, count);
        gl.fillStyle(COLORS.ghost, a * 0.25);
        gl.fillRect(bx - 4, by - 4, w + 8, h + 8);
        g.fillStyle(COLORS.ghost, a * 0.75);
        g.fillRect(bx, by, w, h);
        g.lineStyle(1.5, COLORS.ghost, Math.min(1, a + 0.3));
        g.strokeRect(bx + 0.75, by + 0.75, w - 1.5, h - 1.5);
        this._eyes(g, e, bx, by, w, 0x1a0630, a + 0.2);
      } else {
        const blink = ready ? 0.75 + 0.25 * Math.sin(t * 8) : 1;
        gl.fillStyle(COLORS.live, 0.22 * blink);
        gl.fillRect(bx - 6, by - 6, w + 12, h + 12);
        g.fillStyle(COLORS.live, blink);
        g.fillRect(bx, by, w, h);
        this._eyes(g, e, bx, by, w, 0x04121a, 1);
      }
    }
  }

  _eyes(g, e, bx, by, w, color, a) {
    const f = e.facing || 1;
    const cx = bx + w / 2 + f * 3;
    g.fillStyle(color, Math.min(1, a));
    g.fillRect(cx - 5, by + 8, 3, 6);
    g.fillRect(cx + 2, by + 8, 3, 6);
  }
}
