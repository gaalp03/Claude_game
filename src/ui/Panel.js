// Felugró panel (szünet, eredmény): áttetsző háttér, cím, sorok, gombok.
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
  const g = scene.add.graphics().setDepth(D);
  g.fillStyle(COLORS.panel, 0.97);
  g.fillRoundedRect(VIEW_W / 2 - width / 2, top, width, h, 14);
  g.lineStyle(2, color, 0.8);
  g.strokeRoundedRect(VIEW_W / 2 - width / 2, top, width, h, 14);
  objs.push(g);

  const t = scene.add.text(VIEW_W / 2, top + 36, title, textStyle(30, color, { fontStyle: 'bold' })).setOrigin(0.5).setDepth(D);
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
