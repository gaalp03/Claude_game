// Daily Loop: a mai, dátumból generált (igazoltan megoldható) pálya indítása,
// az eredmény rögzítése, a sorozat és a megosztható emoji-sor.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, setupCamera } from '../ui/theme.js';
import { makeButton, MenuNav } from '../ui/Button.js';
import { fadeIn, go } from '../ui/transition.js';
import { RAW_LEVELS } from '../levels/index.js';
import { app } from '../state.js';
import { Backdrop } from '../render/Backdrop.js';
import { dateKey, generateDaily } from '../core/daily.js';
import { recordDaily, currentStreak } from '../core/save.js';
import { shareText, formatTime } from '../core/share.js';
import * as sdk from '../sdk.js';

const cache = new Map();
/** A napi pálya generálása naponta egyszer (memóriában tárolva) */
export function todaysDaily(key = dateKey()) {
  if (!cache.has(key)) cache.set(key, generateDaily(key, RAW_LEVELS.filter((r) => r.ghosts > 0)));
  return cache.get(key);
}

/** Vágólapra másolás, régi böngészőkre is */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // tovább a tartalék megoldásra
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export class DailyScene extends Phaser.Scene {
  constructor() {
    super('Daily');
  }

  init(data) {
    this.result = data?.result || null;
    this.practice = !!data?.practice;
    this._leaving = false;
  }

  create() {
    setupCamera(this);
    fadeIn(this);
    new Backdrop(this, { seed: 99, skyline: true, dust: 18 });
    sdk.gameplayStop();
    const key = dateKey();
    this.key = key;
    const daily = todaysDaily(key);
    const s = app.save;

    // friss (nem gyakorló) eredmény rögzítése
    if (this.result && !this.practice) {
      const r = recordDaily(s, key, this.result);
      app.persist();
      if (r.first) sdk.happytime();
    }
    const today = s.daily.history[key];
    const streak = currentStreak(s, key);

    this.add.text(VIEW_W / 2, 50, 'DAILY LOOP', textStyle(38, 0xf3e3ff, { fontStyle: 'bold', glow: COLORS.ghost })).setOrigin(0.5);
    this.add.text(VIEW_W / 2, 88, `#${daily.number} · ${key}`, textStyle(15, COLORS.dim)).setOrigin(0.5);
    this.add
      .text(VIEW_W / 2, 114, `Streak ${streak}  ·  Best ${s.daily.best}`, textStyle(15, streak > 0 ? COLORS.goal : COLORS.dim, { fontStyle: 'bold' }))
      .setOrigin(0.5);

    const buttons = [];
    const lvl = daily.raw;
    if (today) {
      const text = shareText({ number: daily.number, ...today, streak });
      this.shareString = text;
      const g = this.add.graphics();
      g.fillStyle(COLORS.panel, 0.95);
      g.fillRoundedRect(VIEW_W / 2 - 230, 142, 460, 150, 12);
      g.lineStyle(2, COLORS.ghost, 0.6);
      g.strokeRoundedRect(VIEW_W / 2 - 230, 142, 460, 150, 12);
      this.add.text(VIEW_W / 2, 217, text, textStyle(17, COLORS.text, { align: 'center', lineSpacing: 8 })).setOrigin(0.5);
      if (this.result && this.practice) {
        this.add
          .text(VIEW_W / 2, 306, `Practice run: ${formatTime(this.result.frames)}s · ${this.result.ghosts} ghosts · ${this.result.attempts} loops (not counted)`, textStyle(13, COLORS.dim))
          .setOrigin(0.5);
      }
      this.copyBtn = makeButton(this, {
        x: VIEW_W / 2, y: 350, w: 260, h: 50, label: 'COPY RESULT', color: COLORS.goal, size: 20,
        onClick: () => this.copy()
      });
      buttons.push(this.copyBtn);
      buttons.push(makeButton(this, {
        x: VIEW_W / 2, y: 410, w: 260, h: 44, label: 'PLAY AGAIN', sub: 'practice · not counted', color: COLORS.ghost,
        onClick: () => go(this, 'Game', { mode: 'daily', daily, practice: true })
      }));
    } else {
      this.add
        .text(VIEW_W / 2, 200, `Everyone gets the same loop today.\nPar ${lvl.ghosts} ghost${lvl.ghosts === 1 ? '' : 's'} · ${lvl.timeLimit}s per loop`, textStyle(17, COLORS.text, { align: 'center', lineSpacing: 8 }))
        .setOrigin(0.5);
      this.add
        .text(VIEW_W / 2, 262, 'Your result counts once: loops, ghosts and time go into the share card.', textStyle(13, COLORS.dim))
        .setOrigin(0.5);
      buttons.push(makeButton(this, {
        x: VIEW_W / 2, y: 330, w: 280, h: 58, label: 'PLAY TODAY', color: COLORS.ghost, size: 24,
        onClick: () => go(this, 'Game', { mode: 'daily', daily, practice: false })
      }));
    }
    buttons.push(makeButton(this, { x: VIEW_W / 2, y: today ? 470 : 404, w: 200, h: 40, label: 'MENU', color: COLORS.dim, onClick: () => go(this, 'Menu') }));
    const nav = new MenuNav(this, buttons, { back: () => go(this, 'Menu') });
    nav.focus(buttons[0]);

    this.countdown = this.add.text(VIEW_W / 2, VIEW_H - 22, '', textStyle(13, COLORS.dim)).setOrigin(0.5);
    this.toast = this.add.text(VIEW_W / 2, 318, '', textStyle(14, COLORS.goal)).setOrigin(0.5).setAlpha(0);
  }

  async copy() {
    const ok = await copyText(this.shareString || '');
    this.toast.setText(ok ? 'Copied to clipboard!' : 'Copy failed - select the text manually').setAlpha(1).setY(this.copyBtn.y - 36);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1200, duration: 400 });
  }

  update() {
    const now = new Date();
    if (dateKey(now) !== this.key && !this._leaving) {
      this.scene.restart({});
      return;
    }
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const sec = Math.max(0, Math.floor((next - now) / 1000));
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    this.countdown.setText(`Next loop in ${hh}:${mm}:${ss}`);
  }
}
