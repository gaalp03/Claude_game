// Közös háttér minden jelenethez: függőleges színátmenet, távoli neon városkép,
// puha fényfoltok, perspektivikusan halványuló rács, lebegő por és vignetta.
// A statikus rész egyszer rajzolódik ki; csak a por (részecskék) mozog.

import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H } from '../ui/theme.js';
import { mulberry32 } from '../core/rng.js';
import { softGlow } from './draw.js';

export class Backdrop {
  /**
   * @param scene Phaser jelenet
   * @param opts {seed, horizon: a rács "talajvonala", dust: részecskék száma}
   */
  constructor(scene, { seed = 7, horizon = VIEW_H - 60, dust = 26, skyline = true } = {}) {
    this.scene = scene;
    const rng = mulberry32(seed);
    const PAD = 60;

    const g = scene.add.graphics().setDepth(-100);
    // színátmenet: mély lila fent, majdnem fekete lent
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(-PAD, -PAD, VIEW_W + PAD * 2, VIEW_H + PAD * 2);

    const glow = scene.add.graphics().setDepth(-99).setBlendMode(Phaser.BlendModes.ADD);
    // nagy, puha fényfoltok
    softGlow(glow, VIEW_W * (0.15 + rng.next() * 0.2), VIEW_H * 0.25, 260, COLORS.ghost, 0.05);
    softGlow(glow, VIEW_W * (0.65 + rng.next() * 0.25), VIEW_H * 0.35, 300, COLORS.live, 0.035);
    softGlow(glow, VIEW_W * 0.5, VIEW_H * 1.05, 420, 0x3b2bff, 0.05);

    // távoli városkép: két rétegben, a hátsó halványabb
    if (skyline) {
      for (const layer of [0, 1]) {
        let x = -20;
        const base = horizon + 10;
        while (x < VIEW_W + 20) {
          const w = 24 + Math.floor(rng.next() * 50);
          const h = (layer === 0 ? 70 : 40) + Math.floor(rng.next() * (layer === 0 ? 150 : 90));
          const col = layer === 0 ? 0x0f0a2a : 0x0b0820;
          g.fillStyle(col, 1);
          g.fillRect(x, base - h, w, h);
          // ablakfények
          const lit = layer === 0 ? COLORS.ghost : COLORS.live;
          for (let wy = base - h + 8; wy < base - 10; wy += 12) {
            for (let wx = x + 5; wx < x + w - 6; wx += 9) {
              if (rng.next() < 0.14) {
                g.fillStyle(lit, layer === 0 ? 0.13 : 0.09);
                g.fillRect(wx, wy, 3, 4);
              }
            }
          }
          glow.lineStyle(1, layer === 0 ? COLORS.ghost : COLORS.live, layer === 0 ? 0.12 : 0.07);
          glow.lineBetween(x, base - h, x + w, base - h);
          x += w + Math.floor(rng.next() * 18);
        }
      }
      // köd a városkép alján
      g.fillGradientStyle(COLORS.bgBottom, COLORS.bgBottom, COLORS.bgBottom, COLORS.bgBottom, 0, 0, 0.9, 0.9);
      g.fillRect(-PAD, horizon - 120, VIEW_W + PAD * 2, 140);
    }

    // rács: lefelé erősödik (mélységérzet), minden 4. vonal fényesebb
    const grid = scene.add.graphics().setDepth(-98);
    for (let y = 0; y <= VIEW_H; y += 30) {
      const a = 0.04 + 0.12 * (y / VIEW_H);
      grid.lineStyle(1, COLORS.grid, (y / 30) % 4 === 0 ? a * 1.8 : a);
      grid.lineBetween(0, y, VIEW_W, y);
    }
    for (let x = 0; x <= VIEW_W; x += 30) {
      grid.lineStyle(1, COLORS.grid, (x / 30) % 4 === 0 ? 0.12 : 0.06);
      grid.lineBetween(x, 0, x, VIEW_H);
    }

    // lebegő por
    this.dust = scene.add.particles(0, 0, 'spark', {
      x: { min: 0, max: VIEW_W },
      y: { min: 0, max: VIEW_H },
      speedY: { min: -14, max: -4 },
      speedX: { min: -6, max: 6 },
      lifespan: { min: 5000, max: 9000 },
      scale: { min: 0.15, max: 0.45 },
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.55 },
      tint: [COLORS.live, COLORS.ghost, 0x8f7bff],
      blendMode: 'ADD',
      frequency: Math.max(60, 7000 / dust),
      maxParticles: dust
    });
    this.dust.setDepth(-97);
    this.dust.fastForward(6000);

    // vignetta: sötét peremek színátmenettel
    const v = scene.add.graphics().setDepth(30);
    const edge = 0x000000;
    v.fillGradientStyle(edge, edge, edge, edge, 0.55, 0.55, 0, 0);
    v.fillRect(-PAD, -PAD, VIEW_W + PAD * 2, 70 + PAD);
    v.fillGradientStyle(edge, edge, edge, edge, 0, 0, 0.6, 0.6);
    v.fillRect(-PAD, VIEW_H - 60, VIEW_W + PAD * 2, 60 + PAD);
    v.fillGradientStyle(edge, edge, edge, edge, 0.5, 0, 0.5, 0);
    v.fillRect(-PAD, -PAD, 90 + PAD, VIEW_H + PAD * 2);
    v.fillGradientStyle(edge, edge, edge, edge, 0, 0.5, 0, 0.5);
    v.fillRect(VIEW_W - 90, -PAD, 90 + PAD, VIEW_H + PAD * 2);
    this.objects = [g, glow, grid, v];
    this.vignette = v;
  }

  destroy() {
    this.objects.forEach((o) => o.destroy());
    this.dust.destroy();
  }
}
