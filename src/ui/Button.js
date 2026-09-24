// Neon stílusú menügomb és billentyűzetes menü-navigáció.
import { COLORS, textStyle } from './theme.js';
import { sfx } from '../audio/sfx.js';

/**
 * @param scene Phaser jelenet
 * @param opts {x, y, w, h, label, sub?, color?, onClick, disabled?, size?}
 */
export function makeButton(scene, opts) {
  const { x, y, w = 240, h = 48, label, sub = null, color = COLORS.live, onClick, disabled = false, size = 20 } = opts;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const t = scene.add.text(0, sub ? -8 : 0, label, textStyle(size, disabled ? COLORS.dim : COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
  c.add([g, t]);
  let st = null;
  if (sub) {
    st = scene.add.text(0, 13, sub, textStyle(12, COLORS.dim)).setOrigin(0.5);
    c.add(st);
  }
  c.setSize(w, h);
  c.focused = false;
  c.disabled = disabled;

  const draw = () => {
    g.clear();
    const col = disabled ? COLORS.dim : color;
    const hi = c.focused && !disabled;
    if (hi) {
      g.fillStyle(col, 0.12);
      g.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 12);
    }
    g.fillStyle(COLORS.panel, 0.92);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.lineStyle(2, col, hi ? 1 : 0.55);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
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
