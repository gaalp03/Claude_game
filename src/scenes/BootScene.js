// Indító jelenet: SDK betöltés-jelzés, kódból generált textúrák, majd a főmenü.
import Phaser from 'phaser';
import * as sdk from '../sdk.js';
import { sfx } from '../audio/sfx.js';
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
    Promise.all([fonts, sdk.init({ onAdMute: () => sfx.setAdMuted(true), onAdUnmute: () => sfx.setAdMuted(false) })])
      .finally(() => {
        sdk.loadingStop();
        this.scene.start('Menu');
      });
  }
}
