// Belépési pont: Phaser játék konfigurálása és a jelenetek regisztrálása.
import Phaser from 'phaser';
// betűk a buildbe csomagolva (csak latin karakterkészlet, kis méret)
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/exo-2/latin-500.css';
import '@fontsource/exo-2/latin-700.css';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { DailyScene } from './scenes/DailyScene.js';
import { ProfileScene } from './scenes/ProfileScene.js';
import { VIEW_W, VIEW_H, RENDER_SCALE, COLORS, IS_TOUCH_DEVICE } from './ui/theme.js';
import { sfx } from './audio/sfx.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W * RENDER_SCALE,
  height: VIEW_H * RENDER_SCALE,
  backgroundColor: COLORS.bg,
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT, // 16:9, a képernyőhöz igazítva
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance'
  },
  input: { activePointers: 4 },
  // a hangot a saját WebAudio szintetizátor adja: a Phaser ne nyisson második AudioContextet
  audio: { noAudio: true },
  // telefonon 120 Hz-es kijelzőn se rajzoljunk feleslegesen dupla képkockát
  fps: IS_TOUCH_DEVICE ? { limit: 60 } : {},
  disableContextMenu: true,
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, DailyScene, ProfileScene]
});

// háttérbe tett lapon a hang is álljon meg (a Phaser a ciklust magától szünetelteti)
document.addEventListener('visibilitychange', () => {
  if (!sfx.ctx) return;
  if (document.hidden) sfx.ctx.suspend().catch(() => {});
  else sfx.ctx.resume().catch(() => {});
});

// hibakereséshez a böngésző konzolból elérhető
// (VITE_EXPOSE_GAME=1 csak az automata ellenőrző buildhez; a feltöltött buildben nincs benne)
if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_GAME) window.__game = game;
