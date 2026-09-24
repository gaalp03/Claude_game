// Pályaválasztó: 12 pálya rácsban, rekordokkal és zárolással.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, setupCamera } from '../ui/theme.js';
import { makeButton, MenuNav } from '../ui/Button.js';
import { fadeIn, go } from '../ui/transition.js';
import { LEVELS } from '../levels/index.js';
import { app } from '../state.js';
import { formatTime } from '../core/share.js';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create() {
    setupCamera(this);
    fadeIn(this);
    this._leaving = false;
    this.add.text(VIEW_W / 2, 44, 'LEVELS', textStyle(34, COLORS.live, { fontStyle: 'bold' })).setOrigin(0.5);
    const s = app.save;
    const done = LEVELS.filter((l) => s.levels[l.id]?.done).length;
    this.add.text(VIEW_W / 2, 78, `${done} / ${LEVELS.length} loops closed`, textStyle(14, COLORS.dim)).setOrigin(0.5);

    const cols = 4;
    const bw = 200;
    const bh = 96;
    const gapX = 16;
    const gapY = 14;
    const x0 = VIEW_W / 2 - ((cols - 1) * (bw + gapX)) / 2;
    const y0 = 160;
    const buttons = LEVELS.map((l, i) => {
      const unlocked = i === 0 || s.levels[LEVELS[i - 1].id]?.done || s.levels[l.id]?.done;
      const rec = s.levels[l.id];
      const color = l.ghosts === 0 ? COLORS.live : l.ghosts === 1 ? 0x8f7bff : COLORS.ghost;
      const b = makeButton(this, {
        x: x0 + (i % cols) * (bw + gapX),
        y: y0 + Math.floor(i / cols) * (bh + gapY),
        w: bw,
        h: bh,
        label: `${String(i + 1).padStart(2, '0')}  ${l.name}`,
        size: 16,
        color,
        disabled: !unlocked,
        sub: !unlocked
          ? 'locked'
          : rec?.done
            ? `${formatTime(rec.bestFrames)}s · ${rec.fewestGhosts} ghost${rec.fewestGhosts === 1 ? '' : 's'}${rec.fewestGhosts <= l.ghosts ? ' ★' : ''}`
            : `par ${l.ghosts} ghost${l.ghosts === 1 ? '' : 's'} · ${l.timeLimit}s`,
        onClick: () => go(this, 'Game', { mode: 'level', index: i })
      });
      if (rec?.done) {
        const g = this.add.graphics();
        g.fillStyle(COLORS.goal, 1);
        g.fillCircle(bw / 2 - 12, -bh / 2 + 12, 4);
        b.add(g);
      }
      return b;
    });
    const back = makeButton(this, { x: VIEW_W / 2, y: VIEW_H - 40, w: 200, h: 42, label: 'BACK', color: COLORS.dim, onClick: () => go(this, 'Menu') });
    const nav = new MenuNav(this, [...buttons, back], { columns: cols, back: () => go(this, 'Menu') });
    const firstOpen = buttons.findIndex((b, i) => !b.disabled && !s.levels[LEVELS[i].id]?.done);
    nav.focus(buttons[firstOpen >= 0 ? firstOpen : 0]);
  }
}
