// Pályaválasztó: fejezetenként 12 pálya kártyákon, csillagokkal, éremmel, par-szellemekkel és zárolással.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, setupCamera, glowPad } from '../ui/theme.js';
import { makeButton, MenuNav } from '../ui/Button.js';
import { fadeIn, go } from '../ui/transition.js';
import { LEVELS, CHAPTERS, MAX_STARS, chapterOf } from '../levels/index.js';
import { app } from '../state.js';
import { music } from '../audio/music.js';
import { Backdrop } from '../render/Backdrop.js';
import { drawGhost } from '../render/draw.js';
import { drawStar } from '../ui/ResultPanel.js';
import { formatTime } from '../core/share.js';
import { totalStars, MEDAL_INFO } from '../core/progress.js';
import { sfx } from '../audio/sfx.js';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  init(data) {
    this.chapter = data?.chapter ?? null;
  }

  create() {
    setupCamera(this);
    fadeIn(this);
    music.setIntensity(0);
    new Backdrop(this, { seed: 11, skyline: true, dust: 18 });
    this._leaving = false;
    const s = app.save;
    const isDone = (i) => !!s.levels[LEVELS[i].id]?.done;
    const unlockedAt = (i) => i === 0 || isDone(i - 1) || isDone(i);
    if (this.chapter === null) {
      const firstOpen = LEVELS.findIndex((l, i) => !isDone(i));
      this.chapter = Math.max(0, chapterOf(firstOpen < 0 ? 0 : firstOpen));
    }
    const ch = CHAPTERS[this.chapter];

    this.add.text(VIEW_W / 2, 36, 'LEVELS', textStyle(28, 0xe9fdff, { fontStyle: 'bold', glow: COLORS.live })).setOrigin(0.5);
    // összes csillag jobb fent
    const tg = this.add.graphics();
    drawStar(tg, VIEW_W - 118, 36, 9, COLORS.links[0], true);
    this.add.text(VIEW_W - 104, 36, `${totalStars(s)} / ${MAX_STARS}`, textStyle(15, COLORS.text, { fontStyle: 'bold' })).setOrigin(0, 0.5);

    // fejezet-fülek
    CHAPTERS.forEach((c, i) => {
      const active = i === this.chapter;
      const locked = !unlockedAt(c.from);
      const x = VIEW_W / 2 + (i - 0.5) * 230;
      const tab = this.add.container(x, 84);
      const g = this.add.graphics();
      g.fillStyle(active ? 0x151a44 : 0x0a0b1f, active ? 0.95 : 0.7);
      g.fillRoundedRect(-108, -17, 216, 34, 17);
      g.lineStyle(active ? 2 : 1, active ? COLORS.live : COLORS.dim, active ? 1 : 0.4);
      g.strokeRoundedRect(-108, -17, 216, 34, 17);
      const done = c.ids.filter((id) => s.levels[id]?.done).length;
      const t = this.add.text(0, 0, `${c.title.toUpperCase()}  ${locked ? '· LOCKED' : `${done}/${c.ids.length}`}`, textStyle(12, active ? COLORS.text : COLORS.dim, { fontStyle: 'bold' })).setOrigin(0.5);
      tab.add([g, t]);
      const z = this.add.zone(0, 0, 216, 34).setInteractive({ useHandCursor: !active });
      tab.add(z);
      z.on('pointerup', () => this._switch(i));
    });

    const cols = 4;
    const bw = 204;
    const bh = 96;
    const gapX = 14;
    const gapY = 12;
    const x0 = VIEW_W / 2 - ((cols - 1) * (bw + gapX)) / 2;
    const y0 = 170;
    const buttons = [];
    for (let i = ch.from; i < ch.to; i++) {
      const l = LEVELS[i];
      const k = i - ch.from;
      const unlocked = unlockedAt(i);
      const rec = s.levels[l.id];
      const color = l.ghosts === 0 ? COLORS.live : l.ghosts === 1 ? 0x8f7bff : COLORS.ghost;
      const b = makeButton(this, {
        x: x0 + (k % cols) * (bw + gapX),
        y: y0 + Math.floor(k / cols) * (bh + gapY),
        w: bw,
        h: bh,
        label: '',
        color,
        disabled: !unlocked,
        markers: false,
        onClick: () => go(this, 'Game', { mode: 'level', index: i })
      });
      const np = unlocked ? glowPad(26) : 0;
      const num = this.add.text(-bw / 2 + 14 - np, -bh / 2 + 8 - np, String(i + 1).padStart(2, '0'), textStyle(26, unlocked ? color : COLORS.dim, { fontStyle: 'bold', glow: unlocked ? color : undefined }));
      const name = this.add.text(-bw / 2 + 14, -bh / 2 + 44, l.name, textStyle(14, unlocked ? COLORS.text : COLORS.dim, { fontStyle: 'bold' }));
      const info = !unlocked ? 'LOCKED' : rec?.done ? `best ${formatTime(rec.bestFrames)}s` : `${l.timeLimit}s per loop`;
      const infoT = this.add.text(-bw / 2 + 14, -bh / 2 + 68, info, textStyle(11, rec?.done ? COLORS.text : COLORS.dim));
      const icons = this.add.graphics();
      const iconsGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      // par szellemek a jobb felső sarokban
      for (let q = 0; q < l.ghosts; q++) {
        drawGhost(icons, unlocked ? iconsGlow : null, bw / 2 - 26 - q * 17, -bh / 2 + 12, 12, 15, { alpha: unlocked ? 0.75 : 0.25, phase: q });
      }
      if (!unlocked) {
        icons.fillStyle(COLORS.dim, 0.8);
        icons.fillRoundedRect(bw / 2 - 30, bh / 2 - 28, 16, 12, 2);
        icons.lineStyle(2, COLORS.dim, 0.8);
        icons.strokeCircle(bw / 2 - 22, bh / 2 - 29, 5);
      } else {
        // csillagok a jobb alsó sarokban, érem-pötty mellettük
        const mask = rec?.stars || 0;
        for (let q = 0; q < 3; q++) {
          const on = (mask >> q) & 1;
          drawStar(icons, bw / 2 - 72 + q * 16, bh / 2 - 20, 7, on ? COLORS.links[0] : 0x4a5290, !!on);
        }
        if (rec?.medal && MEDAL_INFO[rec.medal]) {
          icons.fillStyle(MEDAL_INFO[rec.medal].color, 1);
          icons.fillCircle(bw / 2 - 14, bh / 2 - 20, 5);
          if (rec.medal === 'dev') {
            iconsGlow.fillStyle(MEDAL_INFO.dev.color, 0.3);
            iconsGlow.fillCircle(bw / 2 - 14, bh / 2 - 20, 10);
          }
        }
      }
      b.add([iconsGlow, icons, num, name, infoT]);
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, delay: 30 * k, duration: 240 });
      buttons.push(b);
    }
    const back = makeButton(this, { x: VIEW_W / 2, y: VIEW_H - 34, w: 200, h: 40, label: 'BACK', color: COLORS.dim, size: 15, onClick: () => go(this, 'Menu') });
    const nav = new MenuNav(this, [...buttons, back], { columns: cols, back: () => go(this, 'Menu') });
    const firstOpen = buttons.findIndex((b, k) => !b.disabled && !isDone(ch.from + k));
    nav.focus(buttons[firstOpen >= 0 ? firstOpen : 0]);
    this.add.text(VIEW_W - 16, VIEW_H - 16, 'Q / E  chapter', textStyle(10, COLORS.dim)).setOrigin(1, 1);

    this.input.keyboard?.on('keydown', (ev) => {
      if (ev.code === 'KeyQ' || ev.code === 'PageUp') this._switch(this.chapter - 1);
      if (ev.code === 'KeyE' || ev.code === 'PageDown' || ev.code === 'Tab') {
        ev.preventDefault?.();
        this._switch(this.chapter + 1);
      }
    });
  }

  _switch(i) {
    if (i < 0 || i >= CHAPTERS.length || i === this.chapter) return;
    sfx.click();
    this.scene.restart({ chapter: i });
  }
}
