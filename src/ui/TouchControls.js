// Mobil vezérlés: bal oldalt két érintőzóna (balra / jobbra), jobb oldalt külön
// ugrás-, rögzítés- és visszavonás-gomb. Több ujjas érintést is kezel: minden
// képkockán végignézzük az aktív pointereket, melyik zónában vannak.

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
    g.clear();
    for (const z of this.zones) {
      const on = this.pressed.has(z.id);
      g.fillStyle(COLORS.live, on ? 0.18 : 0.06);
      g.fillRoundedRect(z.x + 8, z.y, z.w - 16, z.h - 10, 14);
      g.lineStyle(2, COLORS.live, on ? 0.7 : 0.25);
      g.strokeRoundedRect(z.x + 8, z.y, z.w - 16, z.h - 10, 14);
      // nyíl
      const cx = z.x + z.w / 2;
      const cy = z.y + (z.h - 10) / 2;
      const d = z.id === 'left' ? -1 : 1;
      g.fillStyle(COLORS.live, on ? 0.9 : 0.45);
      g.fillTriangle(cx + d * 18, cy, cx - d * 12, cy - 20, cx - d * 12, cy + 20);
    }
    for (const b of this.buttons) {
      const on = this.pressed.has(b.id);
      g.fillStyle(b.color, on ? 0.3 : 0.1);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(2, b.color, on ? 0.9 : 0.45);
      g.strokeCircle(b.x, b.y, b.r);
    }
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown);
    this.g.destroy();
    this.labels.forEach((l) => l.destroy());
  }
}
