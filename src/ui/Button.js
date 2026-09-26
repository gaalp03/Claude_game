// Neon stílusú menügomb és billentyűzetes menü-navigáció.
import Phaser from 'phaser';
import { COLORS, textStyle } from './theme.js';
import { sfx } from '../audio/sfx.js';

/**
 * @param scene Phaser jelenet
 * @param opts {x, y, w, h, label, sub?, color?, onClick, disabled?, size?}
 */
export function makeButton(scene, opts) {
  const { x, y, w = 240, h = 48, label, sub = null, color = COLORS.live, onClick, disabled = false, size = 20, markers = true } = opts;
  const c = scene.add.container(x, y);
  const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const g = scene.add.graphics();
  const t = scene.add.text(0, sub ? -8 : 0, label, textStyle(size, disabled ? COLORS.dim : COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
  c.add([glow, g, t]);
  let st = null;
  if (sub) {
    st = scene.add.text(0, 13, sub, textStyle(12, COLORS.dim)).setOrigin(0.5);
    c.add(st);
  }
  c.setSize(w, h);
  c.focused = false;
  c.disabled = disabled;

  // üveg-panel: sötét színátmenet, neon keret, fókuszban ragyogás és jelölők
  const r = Math.min(10, h / 2);
  const draw = () => {
    g.clear();
    glow.clear();
    const col = disabled ? COLORS.dim : color;
    const hi = c.focused && !disabled;
    if (hi) {
      for (let i = 3; i >= 1; i--) {
        glow.lineStyle(2 + i * 4, col, 0.07);
        glow.strokeRoundedRect(-w / 2 - i, -h / 2 - i, w + i * 2, h + i * 2, r + i);
      }
      glow.fillStyle(col, 0.1);
      glow.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    }
    // (színátmenet csak téglalapon megy szépen WebGL-ben, ezért két réteg sima kitöltés)
    g.fillStyle(0x0b0d22, disabled ? 0.65 : 0.94);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(0x1a2154, disabled ? 0.2 : 0.38);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.5, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
    g.fillStyle(0xffffff, hi ? 0.09 : 0.04);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, Math.min(8, h * 0.18), { tl: r - 3, tr: r - 3, bl: 2, br: 2 });
    g.lineStyle(hi ? 2 : 1.5, col, hi ? 1 : disabled ? 0.3 : 0.6);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    if (hi && markers) {
      // oldalsó jelölő nyilak
      g.fillStyle(col, 1);
      g.fillTriangle(-w / 2 + 10, -5, -w / 2 + 10, 5, -w / 2 + 16, 0);
      g.fillTriangle(w / 2 - 10, -5, w / 2 - 10, 5, w / 2 - 16, 0);
    }
  };
  draw();

  c.setFocus = (f) => {
    if (c.focused === f) return;
    c.focused = f;
    draw();
    scene.tweens.add({ targets: c, scale: f ? 1.04 : 1, duration: 90 });
  };
  c.activate = () => {
    if (disabled) return;
    sfx.click();
    scene.tweens.add({ targets: c, scale: 0.95, yoyo: true, duration: 60 });
    onClick && onClick();
  };
  c.setLabel = (s) => t.setText(s);

  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: !disabled });
  c.add(zone);
  zone.on('pointerover', () => {
    if (disabled) return;
    if (c.nav) c.nav.focus(c);
    else c.setFocus(true);
    sfx.hover();
  });
  zone.on('pointerout', () => {
    if (!c.nav) c.setFocus(false);
  });
  zone.on('pointerup', (p) => {
    sfx.unlock();
    if (p.getDistance && p.getDistance() > 20) return;
    c.activate();
  });
  return c;
}

/**
 * Billentyűzetes navigáció gombok között (nyilak / WASD + Enter / Space).
 * columns > 1 esetén rácsban mozog.
 */
export class MenuNav {
  constructor(scene, buttons, { columns = 1, back = null } = {}) {
    this.scene = scene;
    this.buttons = buttons;
    this.columns = columns;
    this.index = -1;
    buttons.forEach((b) => (b.nav = this));
    const kb = scene.input.keyboard;
    if (!kb) return;
    this.handler = (ev) => {
      const k = ev.code;
      if (k === 'ArrowDown' || k === 'KeyS') this.move(this.columns);
      else if (k === 'ArrowUp' || k === 'KeyW') this.move(-this.columns);
      else if (k === 'ArrowRight' || k === 'KeyD') this.move(1);
      else if (k === 'ArrowLeft' || k === 'KeyA') this.move(-1);
      else if (k === 'Enter' || k === 'Space') {
        sfx.unlock();
        if (this.index < 0) this.move(0);
        else this.buttons[this.index]?.activate();
      } else if ((k === 'Escape' || k === 'Backspace') && back) {
        sfx.unlock();
        back();
      }
    };
    kb.on('keydown', this.handler);
    scene.events.once('shutdown', () => kb.off('keydown', this.handler));
  }

  focus(btn) {
    const i = this.buttons.indexOf(btn);
    if (i < 0) return;
    this.buttons.forEach((b, j) => b.setFocus(j === i));
    this.index = i;
  }

  move(delta) {
    const n = this.buttons.length;
    if (!n) return;
    let i = this.index < 0 ? 0 : this.index + delta;
    if (this.index >= 0) {
      if (Math.abs(delta) === 1 && this.columns > 1) i = Math.max(0, Math.min(n - 1, i));
      else i = ((i % n) + n) % n;
    }
    // letiltott gombok átugrása
    for (let tries = 0; tries < n && this.buttons[i].disabled; tries++) i = (i + (delta >= 0 ? 1 : n - 1)) % n;
    this.focus(this.buttons[i]);
    sfx.hover();
  }
}
