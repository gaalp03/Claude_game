// Főmenü: neon cím szellem-visszhangokkal, élő "hurok" demó a háttérben, menüpontok.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, setupCamera } from '../ui/theme.js';
import { makeButton, MenuNav } from '../ui/Button.js';
import { fadeIn, go } from '../ui/transition.js';
import { LEVELS } from '../levels/index.js';
import { app } from '../state.js';
import { dateKey, dailyNumber } from '../core/daily.js';
import { currentStreak } from '../core/save.js';
import { Backdrop } from '../render/Backdrop.js';
import { drawPlayer, drawGhost, neonLine } from '../render/draw.js';
import * as sdk from '../sdk.js';

const FLOOR = VIEW_H - 64;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    setupCamera(this);
    fadeIn(this, 350);
    this._leaving = false;
    sdk.gameplayStop();
    this.t = 0;
    this.backdrop = new Backdrop(this, { seed: 2026, horizon: FLOOR });

    // talaj a demóhoz
    const floor = this.add.graphics();
    const floorGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    floor.fillGradientStyle(COLORS.platform, COLORS.platform, COLORS.platformDark, COLORS.platformDark, 1);
    floor.fillRect(-40, FLOOR, VIEW_W + 80, 120);
    neonLine(floor, floorGlow, -40, FLOOR + 1, VIEW_W + 40, FLOOR + 1, 0x9fb4ff, 1, 2.5);
    // egy akadály, amin a demó-figura átugrik
    this.demo = this.add.graphics();
    this.demoGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

    // cím: élő cián felirat, mögötte lila "szellem-visszhangok"
    this.echoes = [0.42, 0.24, 0.12].map((a, i) =>
      this.add.text(VIEW_W / 2, 104, 'GHOST LOOP', textStyle(76, COLORS.ghost, { fontStyle: 'bold', glow: COLORS.ghost })).setOrigin(0.5).setAlpha(a).setData('k', i + 1)
    );
    this.titleText = this.add.text(VIEW_W / 2, 104, 'GHOST LOOP', textStyle(76, 0xe9fdff, { fontStyle: 'bold', glow: COLORS.live })).setOrigin(0.5);
    this.add.text(VIEW_W / 2, 158, 'EVERY ATTEMPT COMES BACK TO HELP', textStyle(13, COLORS.dim, { fontStyle: 'bold', letterSpacing: 4 })).setOrigin(0.5);

    const s = app.save;
    const firstOpen = LEVELS.findIndex((l) => !s.levels[l.id]?.done);
    const nextIdx = firstOpen < 0 ? LEVELS.length - 1 : firstOpen;
    const today = dateKey();
    const streak = currentStreak(s, today);
    const doneToday = !!s.daily.history[today];

    const buttons = [
      makeButton(this, {
        x: VIEW_W / 2, y: 226, w: 300, h: 58, label: firstOpen === 0 ? 'PLAY' : 'CONTINUE',
        sub: `Level ${nextIdx + 1} · ${LEVELS[nextIdx].name}`, color: COLORS.live, size: 22,
        onClick: () => go(this, 'Game', { mode: 'level', index: nextIdx })
      }),
      makeButton(this, { x: VIEW_W / 2, y: 292, w: 300, h: 46, label: 'LEVELS', color: COLORS.live, size: 18, onClick: () => go(this, 'LevelSelect') }),
      makeButton(this, {
        x: VIEW_W / 2, y: 356, w: 300, h: 56, label: 'DAILY LOOP',
        sub: `#${dailyNumber(today)}${doneToday ? ' · done ✓' : ' · new puzzle today'}${streak ? ` · streak ${streak}` : ''}`,
        color: COLORS.ghost, size: 20, onClick: () => go(this, 'Daily')
      }),
      makeButton(this, {
        x: VIEW_W / 2, y: 416, w: 300, h: 38, label: s.settings.muted ? 'SOUND: OFF' : 'SOUND: ON', color: COLORS.dim, size: 14,
        onClick: () => buttons[3].setLabel(app.toggleMute() ? 'SOUND: OFF' : 'SOUND: ON')
      })
    ];
    // gombok beúsznak
    buttons.forEach((b, i) => {
      const y = b.y;
      b.setAlpha(0).setY(y + 16);
      this.tweens.add({ targets: b, alpha: 1, y, delay: 120 + i * 70, duration: 320, ease: 'Cubic.Out' });
    });
    const nav = new MenuNav(this, buttons);
    nav.focus(buttons[0]);

    const desktop = this.sys.game.device.os.desktop;
    this.add
      .text(VIEW_W / 2, VIEW_H - 24, desktop
        ? 'ARROWS / WASD move   ·   SPACE jump   ·   R record ghost   ·   Z undo   ·   BACKSPACE retry   ·   M mute'
        : 'Left/right zones move  ·  JUMP  ·  REC records a ghost  ·  UNDO removes one', textStyle(11, COLORS.dim))
      .setOrigin(0.5).setDepth(35);
  }

  // Demó: a figura fut, ugrik; mögötte a korábbi "körei" szellemként ugyanazt az utat járják
  _pos(tt) {
    const span = VIEW_W + 160;
    const x = (((tt * 150) % span) + span) % span - 80;
    const ph = (tt * 1.1) % 1;
    const air = Math.max(0, Math.sin(ph * Math.PI * 2));
    return { x, y: FLOOR - 28 - air * 78, air };
  }

  update(time, delta) {
    this.t += delta / 1000;
    const t = this.t;
    this.echoes.forEach((e) => {
      const k = e.getData('k');
      e.x = VIEW_W / 2 - k * 7 + Math.sin(t * 1.6 - k * 0.6) * 4 * k;
      e.y = 104 + Math.cos(t * 1.3 - k * 0.6) * 2 * k;
    });
    // ritka "glitch": a cím egy pillanatra elcsúszik
    const glitch = (t % 4.3) < 0.08;
    this.titleText.setX(VIEW_W / 2 + (glitch ? 4 : 0));

    const g = this.demo;
    const gl = this.demoGlow;
    g.clear();
    gl.clear();
    for (let k = 3; k >= 1; k--) {
      const p = this._pos(t - k * 0.42);
      drawGhost(g, gl, p.x - 11, p.y, 22, 28, { t, alpha: 0.62 - k * 0.13, phase: k });
      // nyomvonal
      for (let j = 1; j <= 6; j++) {
        const q = this._pos(t - k * 0.42 - j * 0.03);
        gl.fillStyle(COLORS.ghost, (0.14 * (7 - j)) / 7);
        gl.fillRoundedRect(q.x - 4, q.y + 10, 8, 8, 3);
      }
    }
    const p = this._pos(t);
    const pv = this._pos(t - 0.02);
    gl.fillStyle(COLORS.live, 0.12);
    gl.fillEllipse(p.x, FLOOR + 1, 34 - p.air * 14, 6);
    drawPlayer(g, gl, p.x - 11, p.y, 22, 28, { facing: 1, vx: (p.x - pv.x) * 2, t });
  }
}
