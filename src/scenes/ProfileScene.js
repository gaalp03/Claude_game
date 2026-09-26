// Profil: kinézetek (csillagokkal nyithatók), achievementek és statisztikák.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, setupCamera, skinColor } from '../ui/theme.js';
import { makeButton, MenuNav } from '../ui/Button.js';
import { fadeIn, go } from '../ui/transition.js';
import { app } from '../state.js';
import { music } from '../audio/music.js';
import { Backdrop } from '../render/Backdrop.js';
import { drawPlayer } from '../render/draw.js';
import { drawStar } from '../ui/ResultPanel.js';
import { SKINS, ACHIEVEMENTS, totalStars, isSkinUnlocked } from '../core/progress.js';
import { MAX_STARS } from '../levels/index.js';

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('Profile');
  }

  create() {
    setupCamera(this);
    fadeIn(this);
    music.setIntensity(0);
    new Backdrop(this, { seed: 5, skyline: true, dust: 16 });
    this._leaving = false;
    this.t = 0;
    const s = app.save;
    const stars = totalStars(s);

    this.add.text(VIEW_W / 2, 36, 'PROFILE', textStyle(28, 0xe9fdff, { fontStyle: 'bold', glow: COLORS.live })).setOrigin(0.5);
    const tg = this.add.graphics();
    drawStar(tg, VIEW_W - 118, 36, 9, COLORS.links[0], true);
    this.add.text(VIEW_W - 104, 36, `${stars} / ${MAX_STARS}`, textStyle(15, COLORS.text, { fontStyle: 'bold' })).setOrigin(0, 0.5);

    // ---- kinézetek
    this.add.text(48, 78, 'SKINS', textStyle(13, COLORS.live, { fontStyle: 'bold', letterSpacing: 3 }));
    this.add.text(48, 96, 'Earn stars to unlock new colors', textStyle(11, COLORS.dim));
    this.skinFigures = [];
    const cols = 4;
    const cw = 86;
    const chh = 104;
    const buttons = SKINS.map((skin, i) => {
      const unlocked = isSkinUnlocked(skin, stars);
      const x = 48 + cw / 2 + (i % cols) * (cw + 8);
      const y = 120 + chh / 2 + Math.floor(i / cols) * (chh + 10);
      const selected = s.settings.skin === skin.id;
      const b = makeButton(this, {
        x, y, w: cw, h: chh, label: '', color: selected ? COLORS.goal : unlocked ? COLORS.live : COLORS.dim,
        disabled: !unlocked,
        markers: false,
        onClick: () => {
          s.settings.skin = skin.id;
          app.persist();
          this.scene.restart();
        }
      });
      const name = this.add.text(0, chh / 2 - 16, skin.name.toUpperCase(), textStyle(9, unlocked ? COLORS.text : COLORS.dim, { fontStyle: 'bold' })).setOrigin(0.5);
      b.add(name);
      if (!unlocked) {
        const lg = this.add.graphics();
        drawStar(lg, -12, -2, 6, COLORS.links[0], true, 0.8);
        b.add(lg);
        b.add(this.add.text(-4, -2, String(skin.stars), textStyle(13, COLORS.text, { fontStyle: 'bold' })).setOrigin(0, 0.5));
      } else {
        const fg = this.add.graphics();
        const gl = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        b.addAt(gl, 1);
        b.add(fg);
        this.skinFigures.push({ g: fg, gl, skin });
      }
      if (selected) {
        b.add(this.add.text(0, -chh / 2 + 12, 'EQUIPPED', textStyle(8, COLORS.goal, { fontStyle: 'bold' })).setOrigin(0.5));
      }
      return b;
    });

    // ---- achievementek
    const got = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
    const ax = 440;
    this.add.text(ax, 78, `ACHIEVEMENTS  ${got} / ${ACHIEVEMENTS.length}`, textStyle(13, COLORS.links[0], { fontStyle: 'bold', letterSpacing: 3 }));
    const ag = this.add.graphics();
    ACHIEVEMENTS.forEach((a, i) => {
      const on = !!s.achievements[a.id];
      const x = ax + (i % 2) * 244;
      const y = 102 + Math.floor(i / 2) * 41;
      ag.fillStyle(on ? 0x1a1a3a : 0x0a0b1f, on ? 0.95 : 0.7);
      ag.fillRoundedRect(x, y, 236, 36, 8);
      ag.lineStyle(1, on ? COLORS.links[0] : 0x2a2f55, on ? 0.7 : 1);
      ag.strokeRoundedRect(x, y, 236, 36, 8);
      // kupa ikon
      const ix = x + 19;
      const iy = y + 18;
      ag.fillStyle(on ? COLORS.links[0] : 0x2a2f55, 1);
      ag.fillRoundedRect(ix - 7, iy - 8, 14, 9, { tl: 1, tr: 1, bl: 6, br: 6 });
      ag.fillRect(ix - 1.5, iy + 1, 3, 4);
      ag.fillRect(ix - 5, iy + 5, 10, 3);
      this.add.text(x + 36, y + 4, a.name, textStyle(12, on ? COLORS.text : COLORS.dim, { fontStyle: 'bold' }));
      this.add.text(x + 36, y + 19, a.desc, textStyle(10, on ? 0xb8c0e6 : 0x5a6390));
    });

    // ---- statisztikák
    const st = s.stats;
    const done = Object.values(s.levels).filter((l) => l.done).length;
    this.add
      .text(48, VIEW_H - 86, `LOOPS ${st.loops}   ·   GHOSTS ${st.ghosts}   ·   FALLS ${st.deaths}   ·   LEVELS ${done}   ·   DAILY BEST STREAK ${s.daily.best}`, textStyle(11, COLORS.dim, { fontStyle: 'bold', letterSpacing: 1 }));

    const back = makeButton(this, { x: VIEW_W / 2, y: VIEW_H - 34, w: 200, h: 40, label: 'BACK', color: COLORS.dim, size: 15, onClick: () => go(this, 'Menu') });
    const nav = new MenuNav(this, [...buttons, back], { columns: cols, back: () => go(this, 'Menu') });
    const cur = SKINS.findIndex((k) => k.id === s.settings.skin);
    nav.focus(buttons[Math.max(0, cur)]);
  }

  update(time, delta) {
    this.t += delta / 1000;
    for (const f of this.skinFigures) {
      f.g.clear();
      f.gl.clear();
      const bob = Math.abs(Math.sin(this.t * 3 + f.skin.stars)) * 6;
      drawPlayer(f.g, f.gl, -11, -26 - bob, 22, 28, { t: this.t + f.skin.stars, color: skinColor(f.skin.color, this.t), facing: 1 });
    }
  }
}
