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
  bg: 0x07080f,
  grid: 0x10132a,
  platform: 0x151a36,
  platformEdge: 0x3d56b8,
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

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Szövegstílus a renderelési szorzóhoz igazított felbontással */
export function textStyle(size, color = COLORS.text, extra = {}) {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: hex(color),
    resolution: RENDER_SCALE,
    ...extra
  };
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
