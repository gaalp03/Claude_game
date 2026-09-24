// Főmenü: cím, animált "szellem-hurok" háttér, menüpontok.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, setupCamera } from '../ui/theme.js';
import { makeButton, MenuNav } from '../ui/Button.js';
import { fadeIn, go } from '../ui/transition.js';
import { LEVELS } from '../levels/index.js';
import { app } from '../state.js';
import { dateKey, dailyNumber } from '../core/daily.js';
import { currentStreak } from '../core/save.js';
import * as sdk from '../sdk.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    setupCamera(this);
    fadeIn(this);
    this._leaving = false;
    sdk.gameplayStop();
    this.t = 0;
    this.bg = this.add.graphics();

    // cím: élő cián felirat, mögötte lila "visszhangok"
    this.echoes = [0.5, 0.3, 0.15].map((a, i) =>
      this.add.text(VIEW_W / 2, 110, 'GHOST LOOP', textStyle(72, COLORS.ghost, { fontStyle: 'bold' })).setOrigin(0.5).setAlpha(a).setData('k', i + 1)
    );
    this.add.text(VIEW_W / 2, 110, 'GHOST LOOP', textStyle(72, COLORS.live, { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(VIEW_W / 2, 160, 'every attempt comes back to help', textStyle(16, COLORS.dim)).setOrigin(0.5);

    const s = app.save;
    const firstOpen = LEVELS.findIndex((l) => !s.levels[l.id]?.done);
    const nextIdx = firstOpen < 0 ? LEVELS.length - 1 : firstOpen;
    const today = dateKey();
    const streak = currentStreak(s, today);
    const doneToday = !!s.daily.history[today];

    const buttons = [
      makeButton(this, {
        x: VIEW_W / 2, y: 232, w: 280, h: 54, label: firstOpen === 0 ? 'PLAY' : 'CONTINUE',
        sub: `Level ${nextIdx + 1} · ${LEVELS[nextIdx].name}`, color: COLORS.live, size: 22,
        onClick: () => go(this, 'Game', { mode: 'level', index: nextIdx })
      }),
      makeButton(this, { x: VIEW_W / 2, y: 296, w: 280, h: 46, label: 'LEVELS', color: COLORS.live, onClick: () => go(this, 'LevelSelect') }),
      makeButton(this, {
        x: VIEW_W / 2, y: 356, w: 280, h: 54, label: 'DAILY LOOP',
        sub: `#${dailyNumber(today)}${doneToday ? ' · done ✓' : ''}${streak ? ` · streak ${streak}` : ''}`,
        color: COLORS.ghost, size: 20, onClick: () => go(this, 'Daily')
      }),
      makeButton(this, {
        x: VIEW_W / 2, y: 418, w: 280, h: 40, label: s.settings.muted ? 'SOUND: OFF' : 'SOUND: ON', color: COLORS.dim, size: 16,
        onClick: () => buttons[3].setLabel(app.toggleMute() ? 'SOUND: OFF' : 'SOUND: ON')
      })
    ];
    const nav = new MenuNav(this, buttons);
    nav.focus(buttons[0]);

    const desktop = this.sys.game.device.os.desktop;
    this.add
      .text(VIEW_W / 2, VIEW_H - 22, desktop
        ? 'Arrows / WASD move · Space jump · R record ghost · Z undo ghost · Backspace retry · M mute'
        : 'Left/right zones move · JUMP · REC records a ghost · UNDO removes one', textStyle(12, COLORS.dim))
      .setOrigin(0.5);
  }

  update(time, delta) {
    this.t += delta / 1000;
    const t = this.t;
    this.echoes.forEach((e) => {
      const k = e.getData('k');
      e.x = VIEW_W / 2 + Math.sin(t * 1.3 - k * 0.5) * 6 * k;
      e.y = 110 + Math.cos(t * 1.1 - k * 0.5) * 3 * k;
    });

    // háttér-demó: egy futó figura és a késleltetett szellemei ugyanazt az utat járják
    const g = this.bg;
    g.clear();
    g.lineStyle(1, COLORS.grid, 0.6);
    for (let x = 0; x <= VIEW_W; x += 30) g.lineBetween(x, 0, x, VIEW_H);
    for (let y = 0; y <= VIEW_H; y += 30) g.lineBetween(0, y, VIEW_W, y);
    const floor = VIEW_H - 60;
    g.fillStyle(COLORS.platform, 1);
    g.fillRect(0, floor, VIEW_W, 60);
    g.lineStyle(2, COLORS.platformEdge, 0.9);
    g.lineBetween(0, floor + 1, VIEW_W, floor + 1);
    const pos = (tt) => {
      const span = VIEW_W + 120;
      const x = ((tt * 150) % span + span) % span - 60;
      const ph = (tt * 1.4) % 1;
      const y = floor - 28 - Math.max(0, Math.sin(ph * Math.PI * 2)) * 70;
      return { x, y };
    };
    for (let k = 3; k >= 1; k--) {
      const p = pos(t - k * 0.45);
      const a = 0.55 - k * 0.12;
      g.fillStyle(COLORS.ghost, a);
      g.fillRect(p.x - 11, p.y, 22, 28);
    }
    const p = pos(t);
    g.fillStyle(COLORS.live, 0.2);
    g.fillRect(p.x - 17, p.y - 6, 34, 40);
    g.fillStyle(COLORS.live, 1);
    g.fillRect(p.x - 11, p.y, 22, 28);
  }
}
