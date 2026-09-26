// Indító jelenet: SDK betöltés-jelzés, kódból generált textúrák, majd a főmenü.
import Phaser from 'phaser';
import * as sdk from '../sdk.js';
import { sfx } from '../audio/sfx.js';
import { app } from '../state.js';
import { setupCamera } from '../ui/theme.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    setupCamera(this);
    sdk.loadingStart();
    // részecske-textúra: kis fehér négyzet, színezés futásidőben
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 6, 6);
    g.generateTexture('spark', 6, 6);
    g.destroy();
    // puha radiális fény-textúra (a dinamikus fényfoltokhoz, színezve használjuk)
    if (!this.textures.exists('glow')) {
      const ct = this.textures.createCanvas('glow', 64, 64);
      const ctx = ct.getContext();
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      ct.refresh();
    }

    // a böngésző csak felhasználói gesztus után engedi a hangot
    const unlock = () => sfx.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard?.on('keydown', unlock);
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    // a betűk betöltésére várunk (max. 2 s), különben a szövegek tartalék betűvel rajzolódnának
    const fonts = typeof document !== 'undefined' && document.fonts
      ? Promise.race([
          Promise.all(['700 20px Orbitron', '900 20px Orbitron', '500 16px "Exo 2"', '700 16px "Exo 2"'].map((f) => document.fonts.load(f))),
          new Promise((r) => setTimeout(r, 2000))
        ]).catch(() => {})
      : Promise.resolve();
    // SDK: a Data Module (felhőmentés) az init után érhető el. Legfeljebb ~1.2 s-ot várunk rá,
    // utána a játék mindenképp a helyi mentéssel indul, és a felhő-adat később olvad be.
    const sdkReady = sdk
      .init({ onAdMute: () => sfx.setAdMuted(true), onAdUnmute: () => sfx.setAdMuted(false) })
      .then(() => {
        const cloud = sdk.dataStorage();
        if (cloud) app.attachCloud(cloud);
      })
      .catch(() => {});
    const sdkWait = Promise.race([sdkReady, new Promise((r) => setTimeout(r, 1200))]);
    Promise.all([fonts, sdkWait]).finally(() => {
      sdk.loadingStop();
      this.scene.start('Menu');
    });
  }
}
