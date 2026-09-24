// Játék közbeni kijelző: pálya neve, visszaszámláló, szellemek, próbálkozások, üzenetek.
import { COLORS, VIEW_W, VIEW_H, textStyle, ghostAlpha, hex } from './theme.js';

export class HUD {
  constructor(scene, { title, par, maxGhosts, hint, showKeys, onPause }) {
    this.scene = scene;
    this.par = par;
    this.maxGhosts = maxGhosts;
    const D = 40;
    this.g = scene.add.graphics().setDepth(D);
    this.title = scene.add.text(14, 10, title, textStyle(15, COLORS.text, { fontStyle: 'bold' })).setDepth(D);
    this.loop = scene.add.text(14, 30, '', textStyle(12, COLORS.dim)).setDepth(D);
    this.timer = scene.add.text(VIEW_W / 2, 8, '', textStyle(24, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5, 0).setDepth(D);
    this.ghostLabel = scene.add.text(VIEW_W - 60, 10, '', textStyle(12, COLORS.dim)).setOrigin(1, 0).setDepth(D);

    this.hint = scene.add.text(VIEW_W / 2, VIEW_H - 18, hint || '', textStyle(14, COLORS.text, { align: 'center' }))
      .setOrigin(0.5, 1).setDepth(D).setAlpha(hint ? 0.9 : 0);
    this.keys = scene.add
      .text(VIEW_W / 2, 44, showKeys ? 'R record ghost  ·  Backspace retry  ·  Z undo ghost  ·  Esc pause' : '', textStyle(11, COLORS.dim))
      .setOrigin(0.5, 0).setDepth(D).setAlpha(0.8);

    this.banner = scene.add.text(VIEW_W / 2, VIEW_H / 2 - 60, '', textStyle(30, COLORS.text, { fontStyle: 'bold' }))
      .setOrigin(0.5).setDepth(D + 1).setAlpha(0);
    this.sub = scene.add.text(VIEW_W / 2, VIEW_H / 2 - 28, '', textStyle(14, COLORS.dim)).setOrigin(0.5).setDepth(D + 1).setAlpha(0);

    // szünet gomb (egérrel / ujjal is)
    this.pauseZone = scene.add.zone(VIEW_W - 26, 24, 44, 40).setInteractive({ useHandCursor: true }).setDepth(D);
    this.pauseZone.on('pointerup', () => onPause && onPause());
  }

  /** Érintős módban a tipp a vezérlők közötti sávba kerül, tördelve */
  setTouchLayout(v) {
    this.keys.setVisible(!v);
    this.hint.setWordWrapWidth(v ? 400 : 900).setFontSize(v ? 13 : 14).setY(v ? VIEW_H - 8 : VIEW_H - 18);
  }

  setHintVisible(v) {
    this.scene.tweens.add({ targets: this.hint, alpha: v ? 0.9 : 0, duration: 300 });
  }

  flash(text, color = COLORS.text, sub = '') {
    const s = this.scene;
    s.tweens.killTweensOf([this.banner, this.sub]);
    this.banner.setText(text).setColor(hex(color)).setAlpha(1).setScale(1.25);
    this.sub.setText(sub).setAlpha(sub ? 1 : 0);
    s.tweens.add({ targets: this.banner, scale: 1, duration: 180, ease: 'Back.Out' });
    s.tweens.add({ targets: [this.banner, this.sub], alpha: 0, delay: 700, duration: 350 });
  }

  /** Tartós felirat (pl. "move to start") */
  hold(text, sub = '') {
    this.scene.tweens.killTweensOf([this.banner, this.sub]);
    this.banner.setText(text).setColor(hex(COLORS.text)).setAlpha(0.95).setScale(1);
    this.sub.setText(sub).setAlpha(sub ? 1 : 0);
  }

  clearHold() {
    this.scene.tweens.add({ targets: [this.banner, this.sub], alpha: 0, duration: 200 });
  }

  update({ remaining, limit, ghosts, loop, ready }) {
    const g = this.g;
    g.clear();
    const frac = Math.max(0, remaining / limit);
    const low = remaining < 2.5;
    const col = low ? COLORS.hazard : COLORS.live;
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, VIEW_W, 4);
    g.fillStyle(col, ready ? 0.5 : 0.9);
    g.fillRect(0, 0, VIEW_W * frac, 4);
    this.timer.setText(remaining.toFixed(2)).setColor(hex(low && !ready ? COLORS.hazard : COLORS.text));
    this.loop.setText(`LOOP ${loop}`);

    // szellem ikonok: rögzítettek lilán (halványodva), a "par" körvonallal.
    // Szellem nélküli (tanító) pályán csak akkor jelenik meg, ha a játékos mégis rögzít.
    const showGhosts = this.par > 0 || ghosts > 0;
    this.ghostLabel.setVisible(showGhosts);
    const slots = showGhosts ? Math.max(this.maxGhosts, ghosts) : 0;
    const x0 = VIEW_W - 60 - slots * 16;
    for (let i = 0; i < slots; i++) {
      const x = x0 + i * 16;
      if (i < ghosts) {
        g.fillStyle(COLORS.ghost, ghostAlpha(i, ghosts) + 0.2);
        g.fillRect(x, 28, 11, 14);
      } else {
        g.lineStyle(1, i < this.par ? COLORS.ghost : COLORS.dim, i < this.par ? 0.8 : 0.3);
        g.strokeRect(x + 0.5, 28.5, 10, 13);
      }
    }
    this.ghostLabel.setText(`GHOSTS ${ghosts} · PAR ${this.par}`);
    this.ghostLabel.setX(VIEW_W - 60);

    // szünet ikon
    g.fillStyle(COLORS.text, 0.75);
    g.fillRect(VIEW_W - 33, 14, 5, 18);
    g.fillRect(VIEW_W - 23, 14, 5, 18);
  }
}
