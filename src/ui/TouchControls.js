// Mobil vezérlés: bal oldalt két érintőzóna (balra / jobbra), jobb oldalt külön
// ugrás-, rögzítés- és visszavonás-gomb. Több ujjas érintést is kezel: minden
// képkockán végignézzük az aktív pointereket, melyik zónában vannak.

import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle } from './theme.js';
import { IN_LEFT, IN_RIGHT, IN_JUMP } from '../core/physics.js';
import { sfx } from '../audio/sfx.js';

// Érintős módban a pálya kicsinyítve felül-középen van; a vezérlők a szabad sávokba kerülnek
export const TOUCH_LAYOUT = { scale: 0.72, x: (VIEW_W - VIEW_W * 0.72) / 2, y: 26 };
const ZONE_Y = TOUCH_LAYOUT.y + VIEW_H * TOUCH_LAYOUT.scale + 4;

export class TouchControls {
  constructor(scene, { onRecord, onUndo, onRestart, onVisible }) {
    this.scene = scene;
    this.onVisible = onVisible;
    this.visible = false;
    this.glow = scene.add.graphics().setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
    this.g = scene.add.graphics().setDepth(50);
    this.labels = [];
    this.buttons = [
      { id: 'jump', x: VIEW_W - 72, y: VIEW_H - 66, r: 56, label: 'JUMP', color: COLORS.live },
      { id: 'rec', x: VIEW_W - 196, y: VIEW_H - 52, r: 36, label: 'REC', color: COLORS.ghost, action: onRecord },
      { id: 'undo', x: VIEW_W - 60, y: 300, r: 30, label: 'UNDO', color: COLORS.dim, action: onUndo },
      { id: 'retry', x: VIEW_W - 60, y: 220, r: 30, label: '↺', color: COLORS.dim, action: onRestart }
    ];
    for (const b of this.buttons) {
      const t = scene.add.text(b.x, b.y, b.label, textStyle(b.id === 'retry' ? 22 : 13, COLORS.text, { fontStyle: 'bold' }));
      t.setOrigin(0.5).setDepth(51).setAlpha(0.8);
      this.labels.push(t);
    }
    this.zones = [
      { id: 'left', x: 0, y: ZONE_Y, w: 130, h: VIEW_H - ZONE_Y },
      { id: 'right', x: 130, y: ZONE_Y, w: 130, h: VIEW_H - ZONE_Y }
    ];
    this.pressed = new Set();

    // gyors koppintás se vesszen el: pointerdown-nál azonnal rögzítjük az ugrást
    this.jumpLatch = false;
    this.onDown = (p) => {
      if (!p.wasTouch) return;
      sfx.unlock();
      if (!this.visible) this.setVisible(true);
      const wp = scene.cameras.main.getWorldPoint(p.x, p.y);
      const hit = this._buttonAt(wp.x, wp.y);
      if (hit && hit.id === 'jump') this.jumpLatch = true;
      if (hit) hit.flash = 1;
      if (hit && hit.action) hit.action();
    };
    scene.input.on('pointerdown', this.onDown);
    scene.input.addPointer(3);
    this.setVisible(!scene.sys.game.device.os.desktop);
  }

  setVisible(v) {
    this.visible = v;
    this.onVisible && this.onVisible(v);
    this.g.setVisible(v);
    this.glow.setVisible(v);
    this.labels.forEach((l) => l.setVisible(v));
  }

  _buttonAt(x, y) {
    for (const b of this.buttons) {
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= (b.r + 12) * (b.r + 12)) return b;
    }
    return null;
  }

  /** Az aktuális érintések → input bitek */
  read() {
    this.pressed.clear();
    let bits = 0;
    if (!this.visible) return 0;
    const cam = this.scene.cameras.main;
    for (const p of this.scene.input.manager.pointers) {
      if (!p || !p.isDown || !p.wasTouch) continue;
      const wp = cam.getWorldPoint(p.x, p.y);
      for (const z of this.zones) {
        // a zónák kicsit túlnyúlnak a rajzolt területen (pontatlan hüvelykujj)
        if (wp.x >= z.x && wp.x < z.x + z.w + (z.id === 'right' ? 40 : 0) && wp.y >= z.y - 90) {
          if (z.id === 'left') bits |= IN_LEFT;
          else bits |= IN_RIGHT;
          this.pressed.add(z.id);
        }
      }
      const b = this._buttonAt(wp.x, wp.y);
      if (b && b.id === 'jump') {
        bits |= IN_JUMP;
        this.pressed.add('jump');
      }
    }
    if (this.jumpLatch) {
      bits |= IN_JUMP;
      this.jumpLatch = false;
    }
    return bits;
  }

  draw() {
    if (!this.visible) return;
    const g = this.g;
    const gl = this.glow;
    g.clear();
    gl.clear();
    // mozgás-zónák: üveg-panel, neon keret, chevron nyíl
    for (const z of this.zones) {
      const on = this.pressed.has(z.id);
      const x = z.x + 8;
      const w = z.w - 16;
      const h = z.h - 10;
      g.fillStyle(0x0b0d22, on ? 0.75 : 0.55);
      g.fillRoundedRect(x, z.y, w, h, 16);
      g.fillStyle(COLORS.live, on ? 0.22 : 0.05);
      g.fillRoundedRect(x, z.y, w, h, 16);
      g.lineStyle(on ? 2.5 : 1.5, COLORS.live, on ? 1 : 0.4);
      g.strokeRoundedRect(x, z.y, w, h, 16);
      if (on) {
        gl.lineStyle(10, COLORS.live, 0.12);
        gl.strokeRoundedRect(x, z.y, w, h, 16);
      }
      const cx = z.x + z.w / 2;
      const cy = z.y + h / 2;
      const d = z.id === 'left' ? -1 : 1;
      g.lineStyle(5, COLORS.live, on ? 1 : 0.6);
      g.lineBetween(cx - d * 8, cy - 16, cx + d * 8, cy);
      g.lineBetween(cx + d * 8, cy, cx - d * 8, cy + 16);
    }
    // körgombok
    for (const b of this.buttons) {
      b.flash = Math.max(0, (b.flash || 0) - 0.08);
      const on = this.pressed.has(b.id) || b.flash > 0;
      const k = this.pressed.has(b.id) ? 1 : b.flash;
      g.fillStyle(0x0b0d22, 0.6);
      g.fillCircle(b.x, b.y, b.r);
      g.fillStyle(b.color, 0.1 + 0.25 * k);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(on ? 2.5 : 1.5, b.color, on ? 1 : 0.55);
      g.strokeCircle(b.x, b.y, b.r);
      gl.lineStyle(8, b.color, 0.06 + 0.14 * k);
      gl.strokeCircle(b.x, b.y, b.r + 2);
    }
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown);
    this.g.destroy();
    this.glow.destroy();
    this.labels.forEach((l) => l.destroy());
  }
}
