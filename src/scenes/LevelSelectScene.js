// Pályaválasztó: 12 pálya kártyákon, rekordokkal, par-szellemekkel és zárolással.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, setupCamera, glowPad } from '../ui/theme.js';
import { makeButton, MenuNav } from '../ui/Button.js';
import { fadeIn, go } from '../ui/transition.js';
import { LEVELS } from '../levels/index.js';
import { app } from '../state.js';
import { Backdrop } from '../render/Backdrop.js';
import { drawGhost } from '../render/draw.js';
import { formatTime } from '../core/share.js';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create() {
    setupCamera(this);
    fadeIn(this);
    new Backdrop(this, { seed: 11, skyline: true, dust: 18 });
    this._leaving = false;
    this.add.text(VIEW_W / 2, 42, 'LEVELS', textStyle(32, 0xe9fdff, { fontStyle: 'bold', glow: COLORS.live })).setOrigin(0.5);
    const s = app.save;
    const done = LEVELS.filter((l) => s.levels[l.id]?.done).length;
    // haladás-csík
    const pg = this.add.graphics();
    pg.fillStyle(0x0a0b1f, 0.9);
    pg.fillRoundedRect(VIEW_W / 2 - 120, 72, 240, 6, 3);
    pg.fillStyle(COLORS.goal, 1);
    if (done) pg.fillRoundedRect(VIEW_W / 2 - 120, 72, (240 * done) / LEVELS.length, 6, 3);
    this.add.text(VIEW_W / 2, 92, `${done} / ${LEVELS.length} LOOPS CLOSED`, textStyle(11, COLORS.dim, { fontStyle: 'bold', letterSpacing: 2 })).setOrigin(0.5);

    const cols = 4;
    const bw = 204;
    const bh = 100;
    const gapX = 14;
    const gapY = 14;
    const x0 = VIEW_W / 2 - ((cols - 1) * (bw + gapX)) / 2;
    const y0 = 172;
    const buttons = LEVELS.map((l, i) => {
      const unlocked = i === 0 || s.levels[LEVELS[i - 1].id]?.done || s.levels[l.id]?.done;
      const rec = s.levels[l.id];
      const color = l.ghosts === 0 ? COLORS.live : l.ghosts === 1 ? 0x8f7bff : COLORS.ghost;
      const b = makeButton(this, {
        x: x0 + (i % cols) * (bw + gapX),
        y: y0 + Math.floor(i / cols) * (bh + gapY),
        w: bw,
        h: bh,
        label: '',
        color,
        disabled: !unlocked,
        onClick: () => go(this, 'Game', { mode: 'level', index: i })
      });
      const np = unlocked ? glowPad(28) : 0;
      const num = this.add.text(-bw / 2 + 14 - np, -bh / 2 + 8 - np, String(i + 1).padStart(2, '0'), textStyle(28, unlocked ? color : COLORS.dim, { fontStyle: 'bold', glow: unlocked ? color : undefined }));
      const name = this.add.text(-bw / 2 + 14, -bh / 2 + 48, l.name, textStyle(15, unlocked ? COLORS.text : COLORS.dim, { fontStyle: 'bold' }));
      const info = !unlocked
        ? 'LOCKED'
        : rec?.done
          ? `best ${formatTime(rec.bestFrames)}s · ${rec.fewestGhosts} ghost${rec.fewestGhosts === 1 ? '' : 's'}`
          : `${l.timeLimit}s per loop`;
      const infoT = this.add.text(-bw / 2 + 14, -bh / 2 + 72, info, textStyle(12, rec?.done ? COLORS.goal : COLORS.dim));
      const icons = this.add.graphics();
      const iconsGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      // par szellemek a jobb felső sarokban
      for (let k = 0; k < l.ghosts; k++) {
        drawGhost(icons, unlocked ? iconsGlow : null, bw / 2 - 26 - k * 18, -bh / 2 + 14, 13, 16, { alpha: unlocked ? 0.75 : 0.25, phase: k });
      }
      if (l.ghosts === 0) {
        icons.lineStyle(1, COLORS.dim, 0.5);
        icons.strokeRoundedRect(bw / 2 - 26, -bh / 2 + 14, 13, 16, { tl: 6, tr: 6, bl: 1, br: 1 });
        icons.lineBetween(bw / 2 - 28, -bh / 2 + 32, bw / 2 - 11, -bh / 2 + 12);
      }
      // állapot: lakat vagy pipa (+ csillag, ha par-on belül)
      if (!unlocked) {
        icons.fillStyle(COLORS.dim, 0.8);
        icons.fillRoundedRect(bw / 2 - 30, bh / 2 - 30, 16, 12, 2);
        icons.lineStyle(2, COLORS.dim, 0.8);
        icons.strokeCircle(bw / 2 - 22, bh / 2 - 31, 5);
      } else if (rec?.done) {
        icons.lineStyle(3, COLORS.goal, 1);
        icons.lineBetween(bw / 2 - 32, bh / 2 - 22, bw / 2 - 26, bh / 2 - 16);
        icons.lineBetween(bw / 2 - 26, bh / 2 - 16, bw / 2 - 15, bh / 2 - 29);
        iconsGlow.fillStyle(COLORS.goal, 0.2);
        iconsGlow.fillCircle(bw / 2 - 24, bh / 2 - 22, 12);
      }
      b.add([iconsGlow, icons, num, name, infoT]);
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, delay: 40 * i, duration: 260 });
      return b;
    });
    const back = makeButton(this, { x: VIEW_W / 2, y: VIEW_H - 40, w: 200, h: 42, label: 'BACK', color: COLORS.dim, size: 16, onClick: () => go(this, 'Menu') });
    const nav = new MenuNav(this, [...buttons, back], { columns: cols, back: () => go(this, 'Menu') });
    const firstOpen = buttons.findIndex((b, i) => !b.disabled && !s.levels[LEVELS[i].id]?.done);
    nav.focus(buttons[firstOpen >= 0 ? firstOpen : 0]);
  }
}
