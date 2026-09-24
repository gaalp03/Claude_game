// Felugró értesítés (achievement, új kinézet) a jobb felső sarokban.
import Phaser from 'phaser';
import { COLORS, VIEW_W, textStyle } from './theme.js';
import { sfx } from '../audio/sfx.js';

const queue = new WeakMap();

/**
 * @param opts {title, text, color, icon: 'trophy'|'skin'|'medal'}
 */
export function toast(scene, { title, text, color = COLORS.links[0], icon = 'trophy' }) {
  // több értesítés egymás alá kerül
  const list = queue.get(scene) || [];
  queue.set(scene, list);
  const slot = list.length;
  const W = 250;
  const H = 54;
  const x = VIEW_W - W / 2 - 14;
  const y = 74 + slot * (H + 8);
  const c = scene.add.container(x + W, y).setDepth(200);
  const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  glow.lineStyle(10, color, 0.12);
  glow.strokeRoundedRect(-W / 2, -H / 2, W, H, 12);
  const g = scene.add.graphics();
  g.fillStyle(0x080a1c, 0.96);
  g.fillRoundedRect(-W / 2, -H / 2, W, H, 12);
  g.lineStyle(1.5, color, 0.9);
  g.strokeRoundedRect(-W / 2, -H / 2, W, H, 12);
  // ikon
  const ix = -W / 2 + 27;
  g.fillStyle(color, 0.15);
  g.fillCircle(ix, 0, 17);
  g.fillStyle(color, 1);
  if (icon === 'trophy') {
    g.fillRoundedRect(ix - 8, -9, 16, 10, { tl: 1, tr: 1, bl: 7, br: 7 });
    g.fillRect(ix - 2, 1, 4, 5);
    g.fillRect(ix - 6, 6, 12, 3);
  } else if (icon === 'skin') {
    g.fillRoundedRect(ix - 7, -9, 14, 18, 4);
    g.fillStyle(0x02121a, 1);
    g.fillRect(ix - 4, -4, 2, 4);
    g.fillRect(ix + 2, -4, 2, 4);
  } else {
    g.fillCircle(ix, 1, 8);
    g.fillTriangle(ix - 6, -12, ix - 1, -12, ix - 3, -5);
    g.fillTriangle(ix + 6, -12, ix + 1, -12, ix + 3, -5);
  }
  const t1 = scene.add.text(-W / 2 + 52, -17, title, textStyle(10, color, { fontStyle: 'bold', letterSpacing: 1 }));
  const t2 = scene.add.text(-W / 2 + 52, -3, text, textStyle(14, COLORS.text, { fontStyle: 'bold' }));
  c.add([glow, g, t1, t2]);
  list.push(c);
  sfx.fanfare();
  scene.tweens.add({ targets: c, x, duration: 380, ease: 'Back.Out' });
  scene.tweens.add({
    targets: c, x: x + W + 40, alpha: 0, delay: 3200 + slot * 250, duration: 350, ease: 'Cubic.In',
    onComplete: () => {
      c.destroy();
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
  });
}
