import Phaser from 'phaser';
// Közös vizuális beállítások: színek, betűk, felbontás.

export const VIEW_W = 960; // logikai (játék) koordináta-tér
export const VIEW_H = 540;

// Belső renderelési szorzó: nagy felbontású kijelzőn 2x, gyenge/kis kijelzőn 1x,
// így asztalon éles a kép, olcsó telefonon pedig nem pazaroljuk a kitöltési sebességet.
function pickScale() {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const longest = Math.max(window.screen?.width || 0, window.screen?.height || 0, window.innerWidth, window.innerHeight);
  return longest * dpr >= 1400 ? 2 : 1;
}
export const RENDER_SCALE = pickScale();

export const COLORS = {
  bg: 0x05040f,
  bgTop: 0x150a33,
  bgBottom: 0x03050e,
  grid: 0x2a2f6e,
  platform: 0x262e70,
  platformDark: 0x0f1236,
  platformEdge: 0x6f8cff,
  live: 0x00f0ff,
  ghost: 0xb44cff,
  hazard: 0xff2d55,
  goal: 0x39ff88,
  text: 0xe8ecff,
  dim: 0x7f89b8,
  panel: 0x0d1024,
  // gombok és az általuk vezérelt elemek színei (a gomb sorrendje szerint)
  links: [0xffc233, 0x4d9dff, 0xff8a3d, 0xf0f0f0]
};

export const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// Betűk: a build része (fontsource), futás közben nincs hálózati hívás
export const FONT = '"Exo 2", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export const FONT_DISPLAY = 'Orbitron, "Exo 2", system-ui, sans-serif';

/**
 * Szövegstílus a renderelési szorzóhoz igazított felbontással.
 * fontStyle: 'bold' → Orbitron kijelzőbetű; glow: szín → neon fény a betűk körül.
 */
export function textStyle(size, color = COLORS.text, extra = {}) {
  const { glow, ...rest } = extra;
  const display = rest.fontStyle === 'bold';
  const style = {
    fontFamily: display ? FONT_DISPLAY : FONT,
    fontSize: `${size}px`,
    color: hex(color),
    resolution: RENDER_SCALE,
    ...rest
  };
  if (display) style.fontStyle = '700';
  if (glow !== undefined) {
    const blur = Math.max(6, size * 0.45);
    style.shadow = { offsetX: 0, offsetY: 0, color: hex(glow), blur, fill: true, stroke: false };
    // a szöveg-textúra legyen elég nagy, hogy a fény ne vágódjon le szögletesen
    const pad = glowPad(size);
    style.padding = { left: pad, right: pad, top: pad, bottom: pad };
  }
  return style;
}

/** A fénylő szöveg textúrájának kitöltése (bal/felső igazításnál ennyivel kell visszatolni) */
export function glowPad(size) {
  return Math.ceil(Math.max(6, size * 0.45) * 1.6);
}

/**
 * Opcionális kamera-bloom (WebGL postFX). Alapból kikapcsolva: elmossa a szövegeket,
 * és gyenge telefonon drága; a neon-hatást a saját ADD fényréteg adja minden eszközön.
 */
export function addCameraFX(scene, { bloom = false } = {}) {
  const cam = scene.cameras.main;
  if (!bloom || !cam.postFX || scene.sys.game.config.renderType !== Phaser.WEBGL) return;
  if (!scene.sys.game.device.os.desktop) return;
  cam.postFX.addBloom(0xffffff, 1, 1, 0.8, 0.6, 2);
}

/** Kinézet színe; a "prism" folyamatosan körbejár a színkörön */
export function skinColor(skin, t) {
  if (skin !== 'prism') return skin;
  const c = Phaser.Display.Color.HSVToRGB((t * 0.15) % 1, 0.75, 1);
  return c.color;
}

/** Szellem színe/átlátszósága: a régebbiek halványabbak */
export function ghostAlpha(index, count) {
  const age = count - 1 - index; // 0 = legújabb
  return Math.max(0.2, 0.62 - age * 0.13);
}

/** Minden jelenet ugyanabban a 960x540-es logikai térben dolgozik */
export function setupCamera(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(VIEW_W / 2, VIEW_H / 2);
  cam.setBackgroundColor(COLORS.bg);
  return cam;
}
