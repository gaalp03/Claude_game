// Felugró panel (szünet, eredmény): áttetsző háttér, cím, sorok, gombok.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, hex } from './theme.js';
import { makeButton, MenuNav } from './Button.js';

/**
 * @param opts {title, color, lines: [{text, color?, size?}], buttons: [{label, onClick, color?}], back}
 * @returns {{container, nav, destroy}}
 */
export function showPanel(scene, opts) {
  const D = 80;
  const { title, color = COLORS.live, lines = [], buttons = [], back = null, width = 420 } = opts;
  const objs = [];
  const shade = scene.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W + 20, VIEW_H + 20, 0x02030a, 0.72).setDepth(D).setInteractive();
  objs.push(shade);

  const lineH = lines.reduce((s, l) => s + (l.size || 16) + 10, 0);
  const h = 90 + lineH + buttons.length * 58;
  const top = VIEW_H / 2 - h / 2;
  const left = VIEW_W / 2 - width / 2;
  const glow = scene.add.graphics().setDepth(D).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 4; i >= 1; i--) {
    glow.lineStyle(2 + i * 5, color, 0.05);
    glow.strokeRoundedRect(left - i, top - i, width + i * 2, h + i * 2, 16 + i);
  }
  const g = scene.add.graphics().setDepth(D);
  g.fillStyle(0x080a1c, 0.97);
  g.fillRoundedRect(left, top, width, h, 16);
  g.fillStyle(color, 0.07);
  g.fillRoundedRect(left + 2, top + 2, width - 4, 64, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.lineStyle(2, color, 0.9);
  g.strokeRoundedRect(left, top, width, h, 16);
  g.fillStyle(color, 1);
  g.fillRect(VIEW_W / 2 - 40, top + 62, 80, 2);
  objs.push(glow, g);

  const t = scene.add.text(VIEW_W / 2, top + 36, title, textStyle(28, 0xffffff, { fontStyle: 'bold', glow: color })).setOrigin(0.5).setDepth(D);
  objs.push(t);
  let y = top + 76;
  for (const l of lines) {
    const size = l.size || 16;
    const tx = scene.add.text(VIEW_W / 2, y + size / 2, l.text, textStyle(size, l.color ?? COLORS.text, { align: 'center' })).setOrigin(0.5).setDepth(D);
    objs.push(tx);
    y += size + 10;
  }
  y += 14;
  const btns = buttons.map((b, i) => {
    const btn = makeButton(scene, { x: VIEW_W / 2, y: y + i * 58 + 22, w: 260, h: 46, label: b.label, color: b.color ?? color, onClick: b.onClick });
    btn.setDepth(D + 1);
    objs.push(btn);
    return btn;
  });
  const nav = new MenuNav(scene, btns, { back });
  if (btns.length) nav.focus(btns[0]);

  // megjelenési animáció
  const all = objs.slice(1);
  all.forEach((o) => {
    o.setAlpha(0);
    scene.tweens.add({ targets: o, alpha: 1, duration: 160 });
  });

  let alive = true;
  const destroy = () => {
    if (!alive) return;
    alive = false;
    if (nav.handler) scene.input.keyboard.off('keydown', nav.handler);
    objs.forEach((o) => o.destroy());
  };
  return { nav, destroy, objs, hexColor: hex(color) };
}
