// A szimuláció kirajzolása Phaser Graphics-szal: minden alakzat kódból, képfájl nélkül.
// A fizika 60 Hz-en lép; a rajzolás interpolál az előző és a mostani állapot között,
// így 120 Hz-es kijelzőn is folyamatos a mozgás.
//
// Rétegek (alulról): statikus pálya → statikus fény (ADD) → dinamikus fény (ADD)
// → dinamikus alakzatok → effektek (ADD) → részecskék → szellem-sorszámok.

import Phaser from 'phaser';
import { COLORS, ghostAlpha, textStyle } from '../ui/theme.js';
import { drawPlayer, drawGhost, neonLine, softGlow } from './draw.js';

const TRAIL_LEN = 18;
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
    this.staticG = scene.add.graphics();
    this.staticGlow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.dyn = scene.add.graphics();
    this.fx = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.root.add([this.staticG, this.staticGlow, this.glow, this.dyn, this.fx]);

    this.emitters = {};
    const mk = (key, color, extra = {}) => {
      const e = scene.add.particles(0, 0, 'spark', {
        speed: { min: 60, max: 300 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 300, max: 800 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 380,
        tint: color,
        blendMode: 'ADD',
        emitting: false,
        ...extra
      });
      this.emitters[key] = e;
      this.root.add(e);
    };
    mk('live', [COLORS.live, 0xffffff]);
    mk('ghost', [COLORS.ghost, 0xe0b0ff]);
    mk('hazard', [COLORS.hazard, 0xffb0c0]);
    mk('goal', [COLORS.goal, 0xffffff, COLORS.live], { speed: { min: 80, max: 420 }, lifespan: { min: 600, max: 1400 }, gravityY: 90 });
    mk('dust', 0xaab8ff, { speed: { min: 10, max: 60 }, lifespan: { min: 180, max: 380 }, gravityY: -40, scale: { start: 0.6, end: 0 } });
    mk('spark', [0xffffff, COLORS.links[0]], { speed: { min: 20, max: 120 }, lifespan: { min: 200, max: 500 }, gravityY: 200, scale: { start: 0.7, end: 0 } });
    // a célból folyamatosan szálló zöld szikrák
    const goal = level.goal;
    this.goalStream = scene.add.particles(goal.x + goal.w / 2, goal.y + goal.h, 'spark', {
      x: { min: -goal.w / 2 + 3, max: goal.w / 2 - 3 },
      speedY: { min: -90, max: -40 },
      speedX: { min: -8, max: 8 },
      lifespan: { min: 600, max: 1100 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [COLORS.goal, 0xd8ffe8],
      blendMode: 'ADD',
      frequency: 70
    });
    this.root.add(this.goalStream);

    // szellem-sorszámok (legfeljebb 4 szellem)
    this.labels = [];
    for (let i = 0; i < 4; i++) {
      const t = scene.add.text(0, 0, String(i + 1), textStyle(10, 0xe8c8ff, { fontStyle: 'bold' })).setOrigin(0.5, 1).setVisible(false);
      this.labels.push(t);
      this.root.add(t);
    }

    this.doorOpen = new Map(); // ajtó id → látható nyitottság 0..1
    this.squash = new Map(); // entitás index → {sx, sy}
    this.trails = [];
    this.afterimages = []; // élő figura "sebesség-szellemképei"
    this.rings = []; // lökéshullámok
    this.rewind = 0; // új kör "visszatekerés" effekt ereje
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
    const s = this.staticG;
    const gl = this.staticGlow;

    // a pálya kerete (érintős módban a kicsinyített terület széle)
    s.lineStyle(1, COLORS.platformEdge, 0.12);
    s.strokeRect(0.5, 0.5, level.width - 1, level.height - 1);

    // platformok: színátmenetes test, pontrács, fénylő tető, sarokjelek
    for (const p of level.solids) {
      if (p.border) continue;
      s.fillGradientStyle(COLORS.platform, COLORS.platform, COLORS.platformDark, COLORS.platformDark, 1);
      s.fillRect(p.x, p.y, p.w, p.h);
      s.fillStyle(COLORS.platformEdge, 0.1);
      for (let yy = p.y + 10; yy < p.y + p.h - 4; yy += 12) {
        for (let xx = p.x + 8 + ((yy / 12) % 2) * 6; xx < p.x + p.w - 4; xx += 12) s.fillRect(xx, yy, 1.5, 1.5);
      }
      // körvonal: oldalt is jól látszik a háttér előtt
      s.lineStyle(1.5, COLORS.platformEdge, 0.55);
      s.strokeRect(p.x + 0.75, p.y + 0.75, p.w - 1.5, p.h - 1.5);
      gl.lineStyle(4, COLORS.platformEdge, 0.08);
      gl.strokeRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
      neonLine(s, gl, p.x, p.y + 1, p.x + p.w, p.y + 1, 0x9fb4ff, 1, 2.5);
      // tető alatti halvány fénysáv
      s.fillGradientStyle(COLORS.platformEdge, COLORS.platformEdge, COLORS.platformEdge, COLORS.platformEdge, 0.22, 0.22, 0, 0);
      s.fillRect(p.x, p.y + 2, p.w, Math.min(10, p.h - 2));
      // sarokjelek
      s.lineStyle(2, 0xbfd0ff, 0.9);
      const c = Math.min(6, p.w / 3);
      s.lineBetween(p.x, p.y + 1, p.x + c, p.y + 1);
      s.lineBetween(p.x + p.w - c, p.y + 1, p.x + p.w, p.y + 1);
      // fény a platform fölött (a talaj "világít")
      gl.fillGradientStyle(COLORS.platformEdge, COLORS.platformEdge, COLORS.platformEdge, COLORS.platformEdge, 0, 0, 0.07, 0.07);
      gl.fillRect(p.x, p.y - 18, p.w, 18);
    }

    // álló tüskék: színátmenetes fogak, fehér hegyek, vörös derengés
    for (const h of level.hazards) {
      if (h.to) continue;
      gl.fillGradientStyle(COLORS.hazard, COLORS.hazard, COLORS.hazard, COLORS.hazard, 0, 0, 0.22, 0.22);
      gl.fillRect(h.x - 4, h.y - 14, h.w + 8, h.h + 14);
      this._spikes(s, h.x, h.y, h.w, h.h);
    }

    // mozgó platformok sínje
    for (const m of level.movers) {
      const col = m.buttons ? this.linkColor.get(m.buttons[0]) : 0x9fb4ff;
      const cx0 = m.from.x + m.w / 2;
      const cx1 = m.to.x + m.w / 2;
      const len = Math.hypot(cx1 - cx0, m.to.y - m.from.y);
      const steps = Math.max(1, Math.floor(len / 8));
      s.fillStyle(col, 0.35);
      for (let i = 0; i <= steps; i++) {
        const a = i / steps;
        s.fillCircle(lerp(cx0, cx1, a), lerp(m.from.y, m.to.y, a) + m.h / 2, 1.3);
      }
      // végpont-jelölők
      s.lineStyle(1, col, 0.4);
      s.strokeRect(m.to.x + 0.5, m.to.y + 0.5, m.w - 1, m.h - 1);
    }

    // gombok talapzata
    for (const b of level.buttons) {
      const col = this.linkColor.get(b.id);
      s.fillStyle(0x0a0b1c, 1);
      s.fillRect(b.x - 2, b.surface - 2, b.w + 4, 2);
      s.lineStyle(1, col, 0.4);
      s.lineBetween(b.x - 3, b.surface, b.x + b.w + 3, b.surface);
    }
  }

  _spikes(g, x, y, w, h) {
    const n = Math.max(1, Math.round(w / 10));
    const sw = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = x + i * sw;
      g.fillStyle(0x7a0a24, 1);
      g.fillTriangle(x0, y + h, x0 + sw / 2, y, x0 + sw, y + h);
      g.fillStyle(COLORS.hazard, 1);
      g.fillTriangle(x0 + sw * 0.18, y + h, x0 + sw / 2, y + h * 0.12, x0 + sw * 0.5, y + h);
      g.fillStyle(0xffd0da, 1);
      g.fillTriangle(x0 + sw * 0.4, y + h * 0.3, x0 + sw / 2, y, x0 + sw * 0.6, y + h * 0.3);
    }
  }

  /** Új kör: nyomvonalak és animációs állapotok törlése */
  resetRound(world, { rewind = false } = {}) {
    this.trails = world.ghosts.map(() => []);
    this.afterimages.length = 0;
    this.squash.clear();
    for (const d of world.doors) this.doorOpen.set(d.def.id, d.solid ? 0 : 1);
    if (rewind) this.rewind = 1;
  }

  _ring(x, y, color, maxR = 60, life = 0.45, width = 3) {
    this.rings.push({ x, y, color, maxR, life, t: 0, width });
  }

  /** Szimulációs események vizuális lekövetése */
  onEvent(ev, world) {
    const e = ev.who !== undefined ? world.entities[ev.who] : null;
    if (ev.type === 'jump' && e) {
      this.squash.set(ev.who, { sx: 0.74, sy: 1.28 });
      if (!e.ghost) this.emitters.dust.explode(6, e.x + e.w / 2, e.y + e.h);
    } else if (ev.type === 'land' && e) {
      this.squash.set(ev.who, { sx: 1.3, sy: 0.74 });
      if (!e.ghost) this.emitters.dust.explode(7, e.x + e.w / 2, e.y + e.h);
    } else if (ev.type === 'death') {
      if (ev.ghost) {
        this.emitters.ghost.explode(26, ev.x, ev.y);
        this._ring(ev.x, ev.y, COLORS.ghost, 50);
      } else {
        this.emitters.live.explode(40, ev.x, ev.y);
        this.emitters.hazard.explode(24, ev.x, ev.y);
        this._ring(ev.x, ev.y, COLORS.hazard, 90, 0.5, 4);
        this._ring(ev.x, ev.y, COLORS.live, 55, 0.35, 2);
      }
    } else if (ev.type === 'win') {
      const p = world.player;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      this.emitters.goal.explode(80, cx, cy);
      this.emitters.live.explode(24, cx, cy);
      this._ring(cx, cy, COLORS.goal, 140, 0.8, 4);
      this._ring(cx, cy, 0xffffff, 70, 0.5, 2);
    } else if (ev.type === 'button') {
      const b = world.buttons.find((x) => x.def.id === ev.id);
      if (b && ev.pressed) {
        const d = b.def;
        this.emitters.spark.explode(8, d.x + d.w / 2, d.surface - 3);
        this._ring(d.x + d.w / 2, d.surface - 2, this.linkColor.get(d.id), 30, 0.3, 2);
      }
    } else if (ev.type === 'door') {
      const d = world.doors.find((x) => x.def.id === ev.id);
      if (d) {
        const col = this.linkColor.get(d.def.buttons[0]);
        this.emitters.spark.setParticleTint(col);
        for (let i = 0; i < 4; i++) this.emitters.spark.explode(3, d.x + d.w / 2, d.y + (d.h * (i + 0.5)) / 4);
        this.emitters.spark.setParticleTint(0xffffff);
      }
    }
  }

  /** Szellem rögzítésekor a játékos helyén lila robbanás */
  ghostBurst(x, y) {
    this.emitters.ghost.explode(36, x, y);
    this._ring(x, y, COLORS.ghost, 80, 0.5, 3);
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
    const p = world.player;
    if (p.alive && world.frame % 3 === 0 && (Math.abs(p.vx) > 2.2 || Math.abs(p.vy) > 5)) {
      this.afterimages.push({ x: p.x, y: p.y, a: 0.45 });
    }
  }

  draw(world, alpha, dtMs, ready) {
    const dt = dtMs / 1000;
    this.time += dt;
    const g = this.dyn;
    const gl = this.glow;
    const fx = this.fx;
    g.clear();
    gl.clear();
    fx.clear();
    const t = this.time;

    this._drawGoal(g, gl, t);
    this._drawButtons(g, gl, world, t);
    this._drawDoors(g, gl, world, dtMs, t);
    this._drawMovers(g, gl, world, alpha, t);
    this._drawHazards(g, gl, world, alpha, t);

    // szellemek nyomvonala
    const count = world.ghosts.length;
    world.ghosts.forEach((gh, i) => {
      const tr = this.trails[i];
      if (!tr || !gh.alive) return;
      const a = ghostAlpha(i, count);
      const n = tr.length / 2;
      for (let k = 0; k < n; k++) {
        const f = (k + 1) / n;
        const size = 3 + f * 9;
        fx.fillStyle(COLORS.ghost, a * 0.3 * f);
        fx.fillRoundedRect(tr[k * 2] + gh.w / 2 - size / 2, tr[k * 2 + 1] + gh.h / 2 - size / 2, size, size, size / 3);
      }
    });

    // élő figura szellemképei
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const im = this.afterimages[i];
      im.a -= dt * 2.2;
      if (im.a <= 0) {
        this.afterimages.splice(i, 1);
        continue;
      }
      fx.lineStyle(1.5, COLORS.live, im.a);
      fx.strokeRoundedRect(im.x, im.y, 22, 28, 5);
    }

    // entitások
    this.labels.forEach((l) => l.setVisible(false));
    for (const e of world.entities) {
      if (!e.alive) continue;
      const x = lerp(e.prevX, e.x, alpha);
      const y = lerp(e.prevY, e.y, alpha);
      const sq = this.squash.get(e.index);
      let sx = 1;
      let sy = 1;
      if (sq) {
        const k = Math.min(1, dtMs / 85);
        sq.sx += (1 - sq.sx) * k;
        sq.sy += (1 - sq.sy) * k;
        sx = sq.sx;
        sy = sq.sy;
      }
      const w = e.w * sx;
      const h = e.h * sy;
      const bx = x + e.w / 2 - w / 2;
      const by = y + e.h - h;
      if (e.ghost) {
        const a = ghostAlpha(e.index, count);
        drawGhost(g, gl, bx, by, w, h, { facing: e.facing, t, alpha: a + 0.1, phase: e.index * 1.7 });
        const label = this.labels[e.index];
        if (label) {
          label.setVisible(true).setPosition(x + e.w / 2, by - 3).setAlpha(Math.min(1, a + 0.35));
        }
      } else {
        const pulse = ready ? 0.8 + 0.2 * Math.sin(t * 7) : 1;
        // árnyék-fény a talajon
        gl.fillStyle(COLORS.live, 0.12);
        gl.fillEllipse(x + e.w / 2, y + e.h + 1, w + 14, 6);
        drawPlayer(g, gl, bx, by, w, h, { facing: e.facing, vx: e.vx, t, alpha: pulse });
      }
    }

    // lökéshullámok
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      const ease = 1 - (1 - k) * (1 - k);
      fx.lineStyle(r.width * (1 - k) + 0.5, r.color, 0.9 * (1 - k));
      fx.strokeCircle(r.x, r.y, 6 + r.maxR * ease);
    }

    // "visszatekerés": új körnél lila pásztázó sávok
    if (this.rewind > 0) {
      this.rewind = Math.max(0, this.rewind - dt * 2.4);
      const k = this.rewind;
      const H = this.level.height;
      const W = this.level.width;
      for (let i = 0; i < 7; i++) {
        const yy = ((1 - k) * H * 1.4 + i * 70) % (H + 40) - 20;
        fx.fillStyle(COLORS.ghost, 0.12 * k);
        fx.fillRect(0, yy, W, 3 + i % 3);
      }
      fx.fillStyle(COLORS.ghost, 0.08 * k);
      fx.fillRect(0, 0, W, H);
    }
  }

  _drawGoal(g, gl, t) {
    const goal = this.level.goal;
    const cx = goal.x + goal.w / 2;
    const cy = goal.y + goal.h / 2;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    // fénysugár az ég felé
    gl.fillGradientStyle(COLORS.goal, COLORS.goal, COLORS.goal, COLORS.goal, 0, 0, 0.16, 0.16);
    gl.fillRect(goal.x + 4, 0, goal.w - 8, goal.y + goal.h);
    gl.fillGradientStyle(COLORS.goal, COLORS.goal, COLORS.goal, COLORS.goal, 0, 0, 0.1, 0.1);
    gl.fillRect(goal.x - 6, goal.y - 60, goal.w + 12, goal.h + 60);
    softGlow(gl, cx, cy, 34 + pulse * 6, COLORS.goal, 0.2);
    // keret és kapu
    g.fillStyle(COLORS.goal, 0.14 + 0.12 * pulse);
    g.fillRoundedRect(goal.x, goal.y, goal.w, goal.h, 4);
    g.lineStyle(2, COLORS.goal, 0.75 + 0.25 * pulse);
    g.strokeRoundedRect(goal.x + 1, goal.y + 1, goal.w - 2, goal.h - 2, 4);
    // forgó gyémánt
    const r = 9 + pulse * 2;
    const a = t * 2.2;
    const pts = [0, 1, 2, 3].map((i) => ({ x: cx + Math.cos(a + (i * Math.PI) / 2) * r, y: cy + Math.sin(a + (i * Math.PI) / 2) * r * 1.2 }));
    g.fillStyle(0xeafff2, 0.9);
    g.fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    g.fillTriangle(pts[0].x, pts[0].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
    g.lineStyle(1.5, COLORS.goal, 1);
    g.strokePoints([...pts, pts[0]], false);
    // felfelé futó csíkok
    for (let i = 0; i < 3; i++) {
      const yy = goal.y + goal.h - ((t * 30 + i * (goal.h / 3)) % goal.h);
      g.lineStyle(1, COLORS.goal, 0.5);
      g.lineBetween(goal.x + 4, yy, goal.x + goal.w - 4, yy);
    }
  }

  _drawButtons(g, gl, world, t) {
    for (const b of world.buttons) {
      const d = b.def;
      const col = this.linkColor.get(d.id);
      const hgt = b.pressed ? 2.5 : 6;
      if (b.pressed) {
        gl.fillGradientStyle(col, col, col, col, 0, 0, 0.35, 0.35);
        gl.fillRect(d.x + 2, d.surface - 34, d.w - 4, 32);
        softGlow(gl, d.x + d.w / 2, d.surface - 2, 22, col, 0.25);
      } else {
        gl.fillStyle(col, 0.12 + 0.08 * Math.sin(t * 4));
        gl.fillRoundedRect(d.x - 3, d.surface - hgt - 4, d.w + 6, hgt + 6, 4);
      }
      g.fillStyle(col, b.pressed ? 1 : 0.85);
      g.fillRoundedRect(d.x + 2, d.surface - hgt, d.w - 4, hgt, { tl: 3, tr: 3, bl: 0, br: 0 });
      g.fillStyle(0xffffff, b.pressed ? 0.8 : 0.45);
      g.fillRect(d.x + 5, d.surface - hgt + 1, d.w - 10, 1);
    }
  }

  _drawDoors(g, gl, world, dtMs, t) {
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
        // keret-sín mindig látszik
        g.lineStyle(1, col, 0.25);
        g.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
        if (h > 0.5) {
          gl.fillStyle(col, 0.12);
          gl.fillRect(d.x - 6, d.y, d.w + 12, h);
          g.fillGradientStyle(col, col, col, col, 0.18, 0.18, 0.42, 0.42);
          g.fillRect(d.x, d.y, d.w, h);
          // mozgó energia-csíkok
          g.lineStyle(1, col, 0.7);
          const off = (t * 40) % 10;
          for (let yy = d.y + off; yy < d.y + h - 1; yy += 10) g.lineBetween(d.x + 3, yy, d.x + d.w - 3, yy);
          neonLine(g, gl, d.x + 1, d.y, d.x + 1, d.y + h, col, 1, 2);
          neonLine(g, gl, d.x + d.w - 1, d.y, d.x + d.w - 1, d.y + h, col, 1, 2);
          g.fillStyle(0xffffff, 0.9);
          g.fillRect(d.x + 2, d.y + h - 2, d.w - 4, 2);
        }
      } else {
        const a = 1 - v;
        g.lineStyle(1, col, 0.3);
        g.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
        if (a > 0.02) {
          g.fillGradientStyle(col, col, col, col, 0.55 * a, 0.55 * a, 0.2 * a, 0.2 * a);
          g.fillRect(d.x, d.y, d.w, d.h);
          neonLine(g, gl, d.x, d.y + 1, d.x + d.w, d.y + 1, col, a, 2);
          g.lineStyle(1, col, 0.6 * a);
          const off = (t * 40) % 12;
          for (let xx = d.x + off; xx < d.x + d.w; xx += 12) g.lineBetween(xx, d.y + 3, xx + 6, d.y + d.h);
        }
      }
      // jelzőfények: melyik gombok kellenek, és melyik aktív
      const n = d.def.buttons.length;
      d.def.buttons.forEach((bid, i) => {
        const on = world.buttonMap.get(bid);
        const bc = this.linkColor.get(bid);
        const px = vertical ? d.x + d.w / 2 : d.x + d.w / 2 - (n - 1) * 6 + i * 12;
        const py = vertical ? d.y - 7 - i * 11 : d.y - 7;
        g.fillStyle(0x05060f, 1);
        g.fillCircle(px, py, 4.5);
        g.fillStyle(bc, on ? 1 : 0.25);
        g.fillCircle(px, py, 3.2);
        if (on) softGlow(gl, px, py, 12, bc, 0.4);
      });
    }
  }

  _drawMovers(g, gl, world, alpha, t) {
    for (const m of world.movers) {
      const col = m.def.buttons ? this.linkColor.get(m.def.buttons[0]) : 0x9fb4ff;
      const x = m.x - m.dx * (1 - alpha);
      const y = m.y - m.dy * (1 - alpha);
      gl.fillStyle(col, 0.1);
      gl.fillRect(x - 4, y - 6, m.w + 8, m.h + 12);
      g.fillGradientStyle(col, col, 0x0b0d22, 0x0b0d22, 0.55, 0.55, 0.9, 0.9);
      g.fillRect(x, y, m.w, m.h);
      neonLine(g, gl, x, y + 1.5, x + m.w, y + 1.5, col, 1, 3);
      // irányjelző nyilak (felfelé mutató chevronok)
      const up = m.def.to.y < m.def.from.y;
      g.lineStyle(1.5, col, 0.55 + 0.3 * Math.sin(t * 6));
      for (let i = 1; i <= 3; i++) {
        const cx = x + (m.w * i) / 4;
        const cy = y + m.h / 2 + 1;
        const d = up ? -2.5 : 2.5;
        g.lineBetween(cx - 3.5, cy - d, cx, cy + d);
        g.lineBetween(cx, cy + d, cx + 3.5, cy - d);
      }
    }
  }

  _drawHazards(g, gl, world, alpha, t) {
    for (const h of world.hazards) {
      if (!h.def.to) continue;
      const x = lerp(h.prevX ?? h.x, h.x, alpha);
      const y = lerp(h.prevY ?? h.y, h.y, alpha);
      const pulse = 0.6 + 0.4 * Math.sin(t * 8);
      gl.fillStyle(COLORS.hazard, 0.14 * pulse);
      gl.fillRoundedRect(x - 8, y - 8, h.w + 16, h.h + 16, 8);
      g.fillGradientStyle(0x5a0718, 0x5a0718, 0x2a020b, 0x2a020b, 1);
      g.fillRect(x, y, h.w, h.h);
      // mozgó átlós figyelmeztető csíkok
      g.lineStyle(3, COLORS.hazard, 0.55);
      const off = (t * 30) % 14;
      for (let k = off; k < h.w + h.h; k += 14) {
        const x0 = x + Math.min(k, h.w);
        const y0 = y + Math.max(0, k - h.w);
        const x1 = x + Math.max(0, k - h.h);
        const y1 = y + Math.min(k, h.h);
        g.lineBetween(x0, y0, x1, y1);
      }
      g.lineStyle(2, COLORS.hazard, 1);
      g.strokeRect(x + 1, y + 1, h.w - 2, h.h - 2);
      g.fillStyle(0xffd0da, 0.9);
      g.fillRect(x + 3, y + 3, 4, 4);
      g.fillRect(x + h.w - 7, y + 3, 4, 4);
      g.fillRect(x + 3, y + h.h - 7, 4, 4);
      g.fillRect(x + h.w - 7, y + h.h - 7, 4, 4);
    }
  }
}
