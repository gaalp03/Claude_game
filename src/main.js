// Belépési pont: Phaser játék konfigurálása és a jelenetek regisztrálása.
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { DailyScene } from './scenes/DailyScene.js';
import { VIEW_W, VIEW_H, RENDER_SCALE, COLORS } from './ui/theme.js';

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
  disableContextMenu: true,
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, DailyScene]
});

// hibakereséshez a böngésző konzolból elérhető
if (import.meta.env.DEV) window.__game = game;
