// Pálya végi eredménykártya: csillagok egyenként "pattannak be", az idő felpörög,
// érem-jelvény, következő cél, és egy gombnyomással jön a következő pálya.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle } from './theme.js';
import { makeButton, MenuNav } from './Button.js';
import { sfx } from '../audio/sfx.js';
import { formatTime } from '../core/share.js';
import { MEDAL_INFO, medalTimes, countStars } from '../core/progress.js';

/** Csillag kirajzolása (kitöltve vagy körvonallal) */
export function drawStar(g, x, y, r, color, filled, alpha = 1) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  if (filled) {
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  } else {
    g.lineStyle(2, color, alpha);
    g.strokePoints(pts, true);
  }
}

/**
 * @param opts {title, frames, ghosts, par, devFrames, mask (ebben a futásban), medal, newBest, bestFrames,
 *              onNext?, onRetry, onLevels, nextLabel}
 */
export function showResult(scene, opts) {
  const D = 80;
  const objs = [];
  const { frames, ghosts, par, devFrames, mask, medal, newBest, bestFrames } = opts;
  const shade = scene.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W + 40, VIEW_H + 40, 0x02030a, 0.7).setDepth(D).setInteractive();
  objs.push(shade);
  const W = 440;
  const H = 400;
  const top = VIEW_H / 2 - H / 2;
  const left = VIEW_W / 2 - W / 2;
  const col = COLORS.goal;

  const glow = scene.add.graphics().setDepth(D).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 4; i >= 1; i--) {
    glow.lineStyle(2 + i * 5, col, 0.05);
    glow.strokeRoundedRect(left - i, top - i, W + i * 2, H + i * 2, 18 + i);
  }
  const g = scene.add.graphics().setDepth(D);
  g.fillStyle(0x080a1c, 0.97);
  g.fillRoundedRect(left, top, W, H, 18);
  g.lineStyle(2, col, 0.9);
  g.strokeRoundedRect(left, top, W, H, 18);
  objs.push(glow, g);

  const title = scene.add.text(VIEW_W / 2, top + 38, opts.title, textStyle(26, 0xffffff, { fontStyle: 'bold', glow: col })).setOrigin(0.5).setDepth(D);
  objs.push(title);

  // csillagok
  const starG = scene.add.graphics().setDepth(D + 1);
  const starGlow = scene.add.graphics().setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD);
  objs.push(starGlow, starG);
  const starY = top + 98;
  const labels = ['CLEAR', `≤ ${par} GHOST${par === 1 ? '' : 'S'}`, `≤ ${formatTime(medalTimes(devFrames).gold)}s`];
  const earned = [mask & 1, mask & 2, mask & 4].map(Boolean);
  const shown = [0, 0, 0]; // animációs skála
  for (let i = 0; i < 3; i++) {
    const lx = VIEW_W / 2 + (i - 1) * 96;
    const t = scene.add.text(lx, starY + 44, labels[i], textStyle(10, earned[i] ? COLORS.links[0] : COLORS.dim, { fontStyle: 'bold' })).setOrigin(0.5).setDepth(D + 1);
    objs.push(t);
  }
  const drawStars = () => {
    starG.clear();
    starGlow.clear();
    for (let i = 0; i < 3; i++) {
      const lx = VIEW_W / 2 + (i - 1) * 96;
      drawStar(starG, lx, starY, 26, 0x2a2f55, true, 1);
      drawStar(starG, lx, starY, 26, 0x4a5290, false, 1);
      const s = shown[i];
      if (s > 0) {
        drawStar(starGlow, lx, starY, 26 * s * 1.5, COLORS.links[0], true, 0.12);
        drawStar(starG, lx, starY, 26 * s, COLORS.links[0], true, 1);
        drawStar(starG, lx - 3 * s, starY - 4 * s, 8 * s, 0xffffff, true, 0.6);
      }
    }
  };
  drawStars();
  let k = 0;
  earned.forEach((e, i) => {
    if (!e) return;
    const obj = { v: 0 };
    scene.tweens.add({
      targets: obj, v: 1, delay: 350 + k * 260, duration: 380, ease: 'Back.Out',
      onStart: () => sfx.star(i),
      onUpdate: () => {
        shown[i] = obj.v;
        drawStars();
      }
    });
    k++;
  });

  // idő felpörgetése
  const timeText = scene.add.text(VIEW_W / 2 - 16, top + 186, '0.00s', textStyle(34, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5).setDepth(D + 1);
  objs.push(timeText);
  const counter = { f: 0 };
  scene.tweens.add({
    targets: counter, f: frames, duration: 650, ease: 'Cubic.Out',
    onUpdate: () => {
      timeText.setText(`${formatTime(Math.round(counter.f))}s`);
      if (Math.random() < 0.3) sfx.tick();
    }
  });

  // érem-jelvény
  const info = MEDAL_INFO[medal];
  const mx = VIEW_W / 2 + 118;
  const my = top + 186;
  const mg = scene.add.graphics().setDepth(D + 1);
  mg.fillStyle(info.color, 0.2);
  mg.fillCircle(0, 0, 24);
  mg.fillStyle(info.color, 1);
  mg.fillCircle(0, 0, 17);
  mg.fillStyle(0xffffff, 0.45);
  mg.fillCircle(-5, -6, 5);
  mg.lineStyle(2, 0x080a1c, 0.6);
  mg.strokeCircle(0, 0, 12);
  if (medal === 'dev') {
    // gyémánt a fejlesztői éremben
    mg.fillStyle(0x080a1c, 0.8);
    mg.fillTriangle(-6, -1, 6, -1, 0, 8);
    mg.fillTriangle(-6, -1, 6, -1, 0, -7);
  }
  mg.setPosition(mx, my).setScale(0);
  scene.tweens.add({ targets: mg, scale: 1, delay: 450 + k * 260, duration: 420, ease: 'Back.Out', onStart: () => medal !== 'bronze' && sfx.fanfare() });
  const mt = scene.add.text(mx, my + 32, info.name.toUpperCase(), textStyle(9, info.color, { fontStyle: 'bold' })).setOrigin(0.5).setDepth(D + 1);
  objs.push(mg, mt);

  const sub = [];
  if (newBest) sub.push('NEW BEST');
  else if (bestFrames) sub.push(`best ${formatTime(bestFrames)}s`);
  sub.push(`${ghosts} ghost${ghosts === 1 ? '' : 's'} · par ${par}`);
  const subT = scene.add.text(VIEW_W / 2 - 16, top + 222, sub.join('   ·   '), textStyle(13, newBest ? COLORS.goal : COLORS.dim, { fontStyle: newBest ? 'bold' : undefined })).setOrigin(0.5).setDepth(D + 1);
  objs.push(subT);

  // következő cél: ami még hiányzik
  let goal = '';
  const t = medalTimes(devFrames);
  if (medal !== 'dev') {
    if (frames > t.gold) goal = `Next: finish in ${formatTime(t.gold)}s for gold`;
    else goal = `Next: beat the dev time ${formatTime(t.dev)}s`;
  } else goal = 'You beat the developer. Legendary.';
  if (ghosts > par) goal = `Next: solve it with only ${par} ghost${par === 1 ? '' : 's'}`;
  const goalT = scene.add.text(VIEW_W / 2, top + 250, goal, textStyle(12, COLORS.ghost)).setOrigin(0.5).setDepth(D + 1);
  objs.push(goalT);

  const buttons = [];
  let y = top + 300;
  if (opts.onNext) {
    buttons.push(makeButton(scene, { x: VIEW_W / 2, y, w: 300, h: 48, label: opts.nextLabel || 'NEXT LEVEL', sub: 'SPACE', color: col, size: 18, onClick: opts.onNext }));
    y += 56;
    buttons.push(makeButton(scene, { x: VIEW_W / 2 - 76, y, w: 146, h: 38, label: 'RETRY', color: COLORS.live, size: 14, onClick: opts.onRetry }));
    buttons.push(makeButton(scene, { x: VIEW_W / 2 + 76, y, w: 146, h: 38, label: 'LEVELS', color: COLORS.dim, size: 14, onClick: opts.onLevels }));
  } else {
    buttons.push(makeButton(scene, { x: VIEW_W / 2, y, w: 300, h: 48, label: 'RETRY', color: COLORS.live, size: 18, onClick: opts.onRetry }));
    buttons.push(makeButton(scene, { x: VIEW_W / 2, y: y + 56, w: 300, h: 38, label: 'LEVELS', color: COLORS.dim, size: 14, onClick: opts.onLevels }));
  }
  buttons.forEach((b) => b.setDepth(D + 2));
  objs.push(...buttons);
  const nav = new MenuNav(scene, buttons, { back: opts.onLevels, columns: 1 });
  nav.focus(buttons[0]);
  // R = újra (gyors próbálkozás a jobb eredményért)
  const onKey = (ev) => {
    if (ev.code === 'KeyR') opts.onRetry();
  };
  scene.input.keyboard?.on('keydown', onKey);

  // belépő animáció
  objs.slice(1).forEach((o) => {
    const a = o.alpha;
    o.setAlpha(0);
    scene.tweens.add({ targets: o, alpha: a || 1, duration: 200 });
  });

  return {
    nav,
    destroy() {
      scene.input.keyboard?.off('keydown', onKey);
      if (nav.handler) scene.input.keyboard.off('keydown', nav.handler);
      objs.forEach((o) => o.destroy());
    },
    starsEarned: countStars(mask)
  };
}
