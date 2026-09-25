// Játék közbeni kijelző: pálya neve, visszaszámláló, szellemek, próbálkozások, üzenetek.
import Phaser from 'phaser';
import { COLORS, VIEW_W, VIEW_H, textStyle, ghostAlpha, hex } from './theme.js';
import { drawGhost } from '../render/draw.js';
import { drawStar } from './ResultPanel.js';
import { formatTime } from '../core/share.js';

const D = 40;

export class HUD {
  constructor(scene, { title, tag, par, maxGhosts, hint, hintTouch, showKeys, onPause, stars = null, goldFrames = null }) {
    this.stars = stars;
    this.goldFrames = goldFrames;
    this.hintText = hint || '';
    this.hintTouch = hintTouch || hint || '';
    this.scene = scene;
    this.par = par;
    this.maxGhosts = maxGhosts;
    this.t = 0;
    this.bgG = scene.add.graphics().setDepth(D);
    this.g = scene.add.graphics().setDepth(D);
    this.glow = scene.add.graphics().setDepth(D).setBlendMode(Phaser.BlendModes.ADD);

    this.tag = scene.add.text(16, 12, tag, textStyle(11, COLORS.bg, { fontStyle: 'bold' })).setDepth(D + 1);
    this.title = scene.add.text(16, 12, title, textStyle(15, COLORS.text, { fontStyle: 'bold' })).setDepth(D + 1);
    this.title.setX(this.tag.text ? 16 + this.tag.width + 16 : 16);
    this.loop = scene.add.text(16, 34, '', textStyle(12, COLORS.dim)).setDepth(D + 1);
    this.timer = scene.add.text(VIEW_W / 2, 24, '', textStyle(22, COLORS.text, { fontStyle: 'bold', glow: COLORS.live })).setOrigin(0.5).setDepth(D + 1);
    this.ghostLabel = scene.add.text(VIEW_W - 58, 10, '', textStyle(11, COLORS.dim, { fontStyle: 'bold' })).setOrigin(1, 0).setDepth(D + 1);

    this.hint = scene.add.text(VIEW_W / 2, VIEW_H - 18, hint || '', textStyle(15, COLORS.text, { align: 'center', stroke: '#05040f', strokeThickness: 4 }))
      .setOrigin(0.5, 1).setDepth(D).setAlpha(hint ? 0.95 : 0);
    this.keys = scene.add
      .text(VIEW_W / 2, 50, showKeys ? 'R  record ghost    ·    BACKSPACE  retry    ·    Z  undo ghost    ·    ESC  pause' : '', textStyle(11, COLORS.dim))
      .setOrigin(0.5, 0).setDepth(D).setAlpha(0.75);

    this.banner = scene.add.text(VIEW_W / 2, VIEW_H / 2 - 64, '', textStyle(34, COLORS.text, { fontStyle: 'bold', glow: COLORS.live }))
      .setOrigin(0.5).setDepth(D + 2).setAlpha(0);
    this.sub = scene.add.text(VIEW_W / 2, VIEW_H / 2 - 28, '', textStyle(15, COLORS.dim)).setOrigin(0.5).setDepth(D + 2).setAlpha(0);

    // szünet gomb (egérrel / ujjal is)
    this.pauseZone = scene.add.zone(VIEW_W - 26, 26, 48, 44).setInteractive({ useHandCursor: true }).setDepth(D);
    this.pauseZone.on('pointerup', () => onPause && onPause());
    this._drawStatic();
  }

  _drawStatic() {
    const g = this.bgG;
    // felső sáv: áttetsző, alul neon vonallal
    g.fillGradientStyle(0x05040f, 0x05040f, 0x05040f, 0x05040f, 0.85, 0.85, 0, 0);
    g.fillRect(0, 0, VIEW_W, 64);
    // pályatag címke
    if (this.tag.text) {
      g.fillStyle(COLORS.live, 1);
      g.fillRoundedRect(10, 10, this.tag.width + 12, 20, 5);
      this.tag.setX(16).setY(13);
    }
    // szünet ikon (statikus)
    g.fillStyle(COLORS.text, 0.85);
    g.fillRoundedRect(VIEW_W - 34, 15, 5, 20, 2);
    g.fillRoundedRect(VIEW_W - 24, 15, 5, 20, 2);
    // időzítő kapszula
    g.fillStyle(0x0a0b1f, 0.85);
    g.fillRoundedRect(VIEW_W / 2 - 62, 6, 124, 36, 18);
    // a pályán eddig megszerzett csillagok a név mellett
    if (this.stars !== null) {
      const sx = this.title.x + this.title.width + 4;
      for (let i = 0; i < 3; i++) {
        const on = (this.stars >> i) & 1;
        drawStar(g, sx + 14 + i * 15, 22, 6, on ? COLORS.links[0] : 0x4a5290, !!on, on ? 1 : 0.9);
      }
    }
    // arany célidő az időzítő alatt (ha még nincs meg az idő-csillag)
    if (this.goldFrames && !((this.stars || 0) & 4)) {
      this.scene.add.text(VIEW_W / 2, 46, `GOLD ${formatTime(this.goldFrames)}s`, textStyle(9, COLORS.links[0], { fontStyle: 'bold', letterSpacing: 1 }))
        .setOrigin(0.5, 0).setDepth(D + 1).setAlpha(0.8);
      this.keys.setY(60);
    }
  }

  /** Érintős módban a tipp a vezérlők közötti sávba kerül, tördelve */
  setTouchLayout(v) {
    this.keys.setVisible(!v);
    this.hint.setText(v ? this.hintTouch : this.hintText);
    this.hint.setWordWrapWidth(v ? 400 : 900).setFontSize(v ? 13 : 15).setY(v ? VIEW_H - 8 : VIEW_H - 18);
  }

  setHintVisible(v) {
    this.scene.tweens.add({ targets: this.hint, alpha: v ? 0.95 : 0, duration: 300 });
  }

  flash(text, color = COLORS.text, sub = '') {
    const s = this.scene;
    s.tweens.killTweensOf([this.banner, this.sub]);
    this.banner.setText(text).setColor(hex(color)).setShadow(0, 0, hex(color), 16, false, true).setAlpha(1).setScale(1.3);
    this.sub.setText(sub).setAlpha(sub ? 1 : 0);
    s.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.Out' });
    s.tweens.add({ targets: [this.banner, this.sub], alpha: 0, delay: 800, duration: 350 });
  }

  /** Tartós felirat (pl. "move to start") */
  hold(text, sub = '') {
    this.scene.tweens.killTweensOf([this.banner, this.sub]);
    this.banner.setText(text).setColor(hex(COLORS.text)).setShadow(0, 0, hex(COLORS.live), 16, false, true).setAlpha(0.95).setScale(1);
    this.sub.setText(sub).setAlpha(sub ? 1 : 0);
    this.scene.tweens.add({ targets: this.sub, alpha: { from: 1, to: 0.45 }, yoyo: true, repeat: -1, duration: 700 });
  }

  clearHold() {
    this.scene.tweens.killTweensOf([this.banner, this.sub]);
    this.scene.tweens.add({ targets: [this.banner, this.sub], alpha: 0, duration: 200 });
  }

  /** Pálya eleji kártya: nagy sorszám + név, becsúszik és elhalványul */
  intro(big, name, color) {
    const s = this.scene;
    const c = s.add.container(VIEW_W / 2, 96).setDepth(D + 3);
    const bar = s.add.graphics();
    bar.fillStyle(color, 1);
    bar.fillRect(-160, 26, 320, 2);
    bar.fillStyle(color, 0.25);
    bar.fillRect(-220, 26, 440, 2);
    const t1 = s.add.text(0, 0, big, textStyle(14, color, { fontStyle: 'bold', glow: color, letterSpacing: 6 })).setOrigin(0.5);
    const t2 = s.add.text(0, 50, name, textStyle(36, COLORS.text, { fontStyle: 'bold', glow: color })).setOrigin(0.5);
    c.add([bar, t1, t2]);
    c.setAlpha(0);
    t2.setX(-40);
    s.tweens.add({ targets: c, alpha: 1, duration: 250 });
    s.tweens.add({ targets: t2, x: 0, duration: 450, ease: 'Cubic.Out' });
    s.tweens.add({ targets: c, alpha: 0, y: c.y - 16, delay: 1500, duration: 450, onComplete: () => c.destroy() });
  }

  update({ remaining, limit, ghosts, loop, ready, recs = null, frame = 0, frameLimit = 1 }, dt = 16) {
    this.t += dt / 1000;
    const g = this.g;
    const gl = this.glow;
    g.clear();
    gl.clear();
    const frac = Math.max(0, remaining / limit);
    const low = remaining < 2.5 && !ready;
    const col = low ? COLORS.hazard : COLORS.live;

    // időcsík az egész képernyő tetején
    g.fillStyle(0x000000, 0.5);
    g.fillRect(0, 0, VIEW_W, 3);
    g.fillStyle(col, ready ? 0.55 : 1);
    g.fillRect(0, 0, VIEW_W * frac, 3);
    gl.fillStyle(col, 0.35);
    gl.fillRect(0, 0, VIEW_W * frac, 6);
    gl.fillStyle(0xffffff, 0.8);
    gl.fillRect(VIEW_W * frac - 3, 0, 3, 3);

    // időzítő kapszula kerete (csak kevés időnél villog)
    const blink = low ? 0.6 + 0.4 * Math.sin(this.t * 18) : 1;
    g.lineStyle(1.5, col, 0.8 * blink);
    g.strokeRoundedRect(VIEW_W / 2 - 62, 6, 124, 36, 18);
    // A szöveg újrarajzolása drága (canvas + textúra-feltöltés): a színt és a fényt csak
    // állapotváltáskor állítjuk, a szöveget csak ha tényleg változott.
    this.timer.setText(remaining.toFixed(2));
    if (low !== this._low) {
      this._low = low;
      this.timer.setColor(hex(low ? COLORS.hazard : COLORS.text));
      this.timer.setShadow(0, 0, hex(col), 12, false, true);
    }
    this.loop.setText(`LOOP ${loop}`);

    // szellem ikonok: rögzítettek lilán (halványodva), a "par" szaggatott helyekkel.
    // Szellem nélküli (tanító) pályán csak akkor jelenik meg, ha a játékos mégis rögzít.
    const showGhosts = this.par > 0 || ghosts > 0;
    if (this.ghostLabel.visible !== showGhosts) this.ghostLabel.setVisible(showGhosts);
    const slots = showGhosts ? Math.max(this.maxGhosts, ghosts) : 0;
    const x0 = VIEW_W - 58 - slots * 20;
    for (let i = 0; i < slots; i++) {
      const x = x0 + i * 20;
      if (i < ghosts) {
        drawGhost(g, gl, x, 28, 14, 17, { t: this.t, alpha: ghostAlpha(i, ghosts) + 0.3, phase: i });
      } else {
        g.lineStyle(1, i < this.par ? COLORS.ghost : COLORS.dim, i < this.par ? 0.7 : 0.3);
        g.strokeRoundedRect(x + 0.5, 28.5, 13, 16, { tl: 6, tr: 6, bl: 1, br: 1 });
      }
    }
    this.ghostLabel.setText(`GHOSTS ${ghosts} / PAR ${this.par}`);

    // szellem-idővonal: meddig tart az egyes szellemek felvétele, és hol tart most a kör
    if (recs && recs.length) {
      const w = 100;
      const x = VIEW_W - 58 - w;
      const y0 = 52;
      for (let i = 0; i < recs.length; i++) {
        const y = y0 + i * 6;
        g.fillStyle(0x1a1f4a, 0.9);
        g.fillRect(x, y, w, 3);
        g.fillStyle(COLORS.ghost, ghostAlpha(i, recs.length) + 0.25);
        g.fillRect(x, y, (w * Math.min(recs[i], frameLimit)) / frameLimit, 3);
      }
      const cx = x + (w * Math.min(frame, frameLimit)) / frameLimit;
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(cx - 0.75, y0 - 2, 1.5, recs.length * 6 + 1);
    }
  }
}
