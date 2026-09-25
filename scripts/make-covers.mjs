// CrazyGames borítóképek generálása kódból (canvas), a játék saját vizuális stílusában.
// Kimenet: covers/cover-landscape-1920x1080.png, cover-portrait-800x1200.png, cover-square-800x800.png
// Használat: npm run covers   (fej nélküli Chromium rajzol és ment pontos pixelméretben)
// Windows-on első futtatás előtt: npx playwright install chromium

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'covers');
const font = (pkg, file) => readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64');

// a játékkal azonos betűk, beágyazva (nincs hálózati letöltés)
const FONTS = {
  orbitron900: font('orbitron', 'orbitron-latin-900-normal.woff2'),
  exo700: font('exo-2', 'exo-2-latin-700-normal.woff2')
};

const FORMATS = [
  { name: 'landscape', w: 1920, h: 1080 },
  { name: 'portrait', w: 800, h: 1200 },
  { name: 'square', w: 800, h: 800 }
];

// ------------------------------------------------------------------ böngészőben futó rajzoló kód
const PAGE = /* html */ `<!doctype html><html><head><style>
html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}
</style></head><body><canvas id="c"></canvas><script>
const C = { bgTop: '#150a33', bgBottom: '#03050e', live: '#00f0ff', ghost: '180,76,255', goal: '#39ff88',
  hazard: '#ff2d55', platform: '#262e70', platformDark: '#0f1236', edge: '#9fb4ff', amber: '#ffc233', text: '#e9fdff', dim: '#8a93c4' };

async function loadFonts(f) {
  const faces = [new FontFace('Orbitron', 'url(data:font/woff2;base64,' + f.orbitron900 + ')', { weight: '900' }),
    new FontFace('Exo 2', 'url(data:font/woff2;base64,' + f.exo700 + ')', { weight: '700' })];
  for (const face of faces) { await face.load(); document.fonts.add(face); }
}

// determinisztikus véletlen, hogy a képek újragenerálva is ugyanazok legyenek
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function glow(ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function radial(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function background(ctx, W, H, horizon, seed) {
  const r = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bgTop); g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  radial(ctx, W * 0.2, H * 0.22, Math.max(W, H) * 0.45, '180,76,255', 0.16);
  radial(ctx, W * 0.82, H * 0.35, Math.max(W, H) * 0.4, '0,240,255', 0.09);
  radial(ctx, W * 0.5, H * 1.05, Math.max(W, H) * 0.6, '59,43,255', 0.16);
  ctx.globalCompositeOperation = 'source-over';
  // rács, lefelé erősödik
  const step = Math.round(Math.min(W, H) / 18);
  for (let y = 0; y < H; y += step) { ctx.strokeStyle = 'rgba(42,47,110,' + (0.08 + 0.25 * y / H) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  for (let x = 0; x < W; x += step) { ctx.strokeStyle = 'rgba(42,47,110,0.14)'; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  // távoli neon városkép
  for (const layer of [0, 1]) {
    let x = -20;
    while (x < W + 20) {
      const w = (0.03 + r() * 0.05) * Math.max(W, H * 0.9);
      const h = (layer ? 0.08 : 0.14) * H + r() * (layer ? 0.12 : 0.2) * H;
      ctx.fillStyle = layer ? '#0b0820' : '#0f0a2a';
      ctx.fillRect(x, horizon - h, w, h + 4);
      ctx.fillStyle = layer ? 'rgba(0,240,255,0.10)' : 'rgba(180,76,255,0.14)';
      const cell = Math.max(6, w / 7);
      for (let wy = horizon - h + cell; wy < horizon - cell; wy += cell * 1.3) for (let wx = x + cell * 0.6; wx < x + w - cell; wx += cell) if (r() < 0.14) ctx.fillRect(wx, wy, cell * 0.35, cell * 0.45);
      ctx.strokeStyle = layer ? 'rgba(0,240,255,0.12)' : 'rgba(180,76,255,0.2)'; ctx.beginPath(); ctx.moveTo(x, horizon - h + 0.5); ctx.lineTo(x + w, horizon - h + 0.5); ctx.stroke();
      x += w + r() * 0.012 * W;
    }
  }
  const fog = ctx.createLinearGradient(0, horizon - H * 0.2, 0, horizon);
  fog.addColorStop(0, 'rgba(3,5,14,0)'); fog.addColorStop(1, 'rgba(3,5,14,0.85)');
  ctx.fillStyle = fog; ctx.fillRect(0, horizon - H * 0.2, W, H * 0.2);
  // lebegő por
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) { const c = r() < 0.5 ? '0,240,255' : '180,76,255'; ctx.fillStyle = 'rgba(' + c + ',' + (0.15 + r() * 0.35) + ')'; const s = 1 + r() * 2.5; ctx.fillRect(r() * W, r() * H * 0.85, s, s); }
  ctx.globalCompositeOperation = 'source-over';
}

function platform(ctx, x, y, w, h, s) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, C.platform); g.addColorStop(1, C.platformDark);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(111,140,255,0.12)';
  for (let yy = y + 8 * s; yy < y + h - 4; yy += 10 * s) for (let xx = x + 6 * s; xx < x + w - 4; xx += 10 * s) ctx.fillRect(xx, yy, 1.4 * s, 1.4 * s);
  ctx.strokeStyle = 'rgba(111,140,255,0.55)'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(x + 0.75 * s, y + 0.75 * s, w - 1.5 * s, h - 1.5 * s);
  glow(ctx, 'rgba(111,140,255,0.9)', 14 * s);
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(x, y + 1.2 * s); ctx.lineTo(x + w, y + 1.2 * s); ctx.stroke();
  noGlow(ctx);
}

function spikes(ctx, x, y, w, h, s) {
  ctx.globalCompositeOperation = 'lighter'; radial(ctx, x + w / 2, y + h, w * 0.7, '255,45,85', 0.25); ctx.globalCompositeOperation = 'source-over';
  const n = Math.max(2, Math.round(w / (10 * s))); const sw = w / n;
  glow(ctx, 'rgba(255,45,85,0.9)', 10 * s);
  for (let i = 0; i < n; i++) {
    const x0 = x + i * sw;
    ctx.fillStyle = '#7a0a24'; ctx.beginPath(); ctx.moveTo(x0, y + h); ctx.lineTo(x0 + sw / 2, y); ctx.lineTo(x0 + sw, y + h); ctx.fill();
    ctx.fillStyle = C.hazard; ctx.beginPath(); ctx.moveTo(x0 + sw * 0.2, y + h); ctx.lineTo(x0 + sw / 2, y + h * 0.1); ctx.lineTo(x0 + sw * 0.5, y + h); ctx.fill();
  }
  noGlow(ctx);
}

function button(ctx, x, y, w, s) {
  ctx.globalCompositeOperation = 'lighter';
  radial(ctx, x + w / 2, y - 3 * s, w * 0.7, '255,194,51', 0.22);
  ctx.globalCompositeOperation = 'source-over';
  glow(ctx, 'rgba(255,194,51,0.9)', 10 * s);
  ctx.fillStyle = C.amber; rr(ctx, x + 2 * s, y - 6 * s, w - 4 * s, 6 * s, [3 * s, 3 * s, 0, 0]); ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + 5 * s, y - 5 * s, w - 10 * s, 1 * s);
  noGlow(ctx);
}

function goal(ctx, cx, bottom, s, beamTop = 0) {
  const w = 30 * s, h = 36 * s, x = cx - w / 2, y = bottom - h;
  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(0, beamTop, 0, bottom);
  beam.addColorStop(0, 'rgba(57,255,136,0)'); beam.addColorStop(1, 'rgba(57,255,136,0.28)');
  ctx.fillStyle = beam; ctx.fillRect(x + 4 * s, beamTop, w - 8 * s, bottom - beamTop);
  radial(ctx, cx, y + h / 2, 52 * s, '57,255,136', 0.35);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(57,255,136,0.22)'; rr(ctx, x, y, w, h, 4 * s); ctx.fill();
  glow(ctx, C.goal, 16 * s);
  ctx.strokeStyle = C.goal; ctx.lineWidth = 2.5 * s; rr(ctx, x + s, y + s, w - 2 * s, h - 2 * s, 4 * s); ctx.stroke();
  // forgó gyémánt (álló pillanatkép)
  const r = 10 * s, cy = y + h / 2;
  ctx.fillStyle = '#eafff2'; ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.2); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r * 1.2); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
  noGlow(ctx);
}

// szellem-sziluett: kerek tető, hullámzó alj, üres szemek (mint a játékban)
function ghost(ctx, cx, bottom, s, a, facing = 1) {
  const w = 22 * s, h = 28 * s, x = cx - w / 2, y = bottom - h, skirt = 6 * s;
  glow(ctx, 'rgba(' + C.ghost + ',' + Math.min(1, a + 0.3) + ')', 18 * s);
  ctx.fillStyle = 'rgba(' + C.ghost + ',' + a + ')';
  ctx.beginPath();
  ctx.moveTo(x, y + h - skirt);
  ctx.lineTo(x, y + 11 * s); ctx.arcTo(x, y, x + 11 * s, y, 11 * s); ctx.arcTo(x + w, y, x + w, y + 11 * s, 11 * s);
  ctx.lineTo(x + w, y + h - skirt);
  const sw = w / 3;
  for (let i = 2; i >= 0; i--) { ctx.lineTo(x + i * sw + sw / 2, y + h - (i % 2 ? 2 * s : 0)); ctx.lineTo(x + i * sw, y + h - skirt); }
  ctx.closePath(); ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.2 * a + 0.05) + ')'; rr(ctx, x + 3 * s, y + 3 * s, w - 6 * s, (h - skirt) * 0.33, [8 * s, 8 * s, 2 * s, 2 * s]); ctx.fill();
  ctx.fillStyle = 'rgba(18,2,31,' + Math.min(1, a + 0.35) + ')';
  const ex = cx + facing * 2 * s, ey = y + h * 0.3 + 3 * s;
  ctx.beginPath(); ctx.ellipse(ex - 4 * s, ey, 2.3 * s, 3.6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ex + 4 * s, ey, 2.3 * s, 3.6 * s, 0, 0, Math.PI * 2); ctx.fill();
}

// élő figura: cián test, üveg-csillanás, a mozgás irányába néző szemek
function player(ctx, cx, bottom, s) {
  const w = 22 * s * 0.9, h = 28 * s * 1.08, x = cx - w / 2, y = bottom - h; // ugrás közbeni nyújtás
  ctx.globalCompositeOperation = 'lighter'; radial(ctx, cx, y + h / 2, 40 * s, '0,240,255', 0.42); ctx.globalCompositeOperation = 'source-over';
  glow(ctx, C.live, 26 * s);
  ctx.fillStyle = C.live; rr(ctx, x, y, w, h, 5 * s); ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.38)'; rr(ctx, x + 3 * s, y + 3 * s, w - 6 * s, h * 0.33, 3 * s); ctx.fill();
  ctx.fillStyle = '#02121a';
  const ex = cx + 3 * s, ey = y + h * 0.3;
  rr(ctx, ex - 6 * s, ey, 4 * s, 8 * s, 2 * s); ctx.fill(); rr(ctx, ex + 2 * s, ey, 4 * s, 8 * s, 2 * s); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(ex - 5 * s, ey + s, 1.5 * s, 2 * s); ctx.fillRect(ex + 3 * s, ey + s, 1.5 * s, 2 * s);
}

// ugrás-ív két pont között (a figura talppontjára), h = az ív magassága
function arcPoint(a, b, h, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 4 * h * t * (1 - t) }; }

function trail(ctx, a, b, h, t1, s) {
  // pöttyözött útvonal: lilából ciánba – "a szellem ugyanazt az utat járja"
  const n = 34;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * t1, p = arcPoint(a, b, h, t);
    const k = i / n;
    const col = k < 0.8 ? '180,76,255' : '0,240,255';
    ctx.fillStyle = 'rgba(' + col + ',' + (0.15 + 0.55 * k) + ')';
    const r = (2 + 2 * k) * s * 0.55;
    ctx.beginPath(); ctx.arc(p.x, p.y - 14 * s, r, 0, Math.PI * 2); ctx.fill();
  }
}

function title(ctx, lines, cx, y0, maxW, maxSize, lineGap) {
  let size = maxSize;
  ctx.font = '900 ' + size + 'px Orbitron';
  const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
  while (widest() > maxW && size > 20) { size -= 2; ctx.font = '900 ' + size + 'px Orbitron'; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    const y = y0 + i * size * lineGap;
    // lila "szellem-visszhangok" a cím mögött
    [[0.34, 0.05], [0.18, 0.1]].forEach(([a, off]) => { glow(ctx, 'rgba(180,76,255,0.9)', size * 0.25); ctx.fillStyle = 'rgba(180,76,255,' + a + ')'; ctx.fillText(line, cx - size * off, y + size * off * 0.2); });
    glow(ctx, 'rgba(0,240,255,0.95)', size * 0.32); ctx.fillStyle = C.text; ctx.fillText(line, cx, y);
    glow(ctx, 'rgba(0,240,255,0.6)', size * 0.12); ctx.fillText(line, cx, y);
    noGlow(ctx);
  });
  return { size, bottom: y0 + (lines.length - 1) * size * lineGap };
}

function tagline(ctx, text, cx, y, size, spacing) {
  ctx.font = '700 ' + size + 'px "Exo 2"'; ctx.letterSpacing = spacing + 'px'; ctx.textAlign = 'center';
  glow(ctx, 'rgba(0,0,0,0.9)', 8); ctx.fillStyle = C.dim; ctx.fillText(text, cx + spacing / 2, y); noGlow(ctx);
  ctx.letterSpacing = '0px';
}

function vignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// egy jelenet: bal platform + tüskés szakadék + jobb platform (akár magasabban) célkapuval,
// a cián figura ugrik, mögötte ugyanazon az íven két lila szellem – a korábbi köreid
function scene(ctx, L) {
  const s = L.s;
  platform(ctx, L.left.x, L.left.y, L.left.w, L.left.h, s);
  platform(ctx, L.right.x, L.right.y, L.right.w, L.right.h, s);
  if (L.pit) spikes(ctx, L.pit.x, L.pit.y, L.pit.w, L.pit.h, s);
  button(ctx, L.button.x, L.left.y, L.button.w, s);
  goal(ctx, L.goal.x, L.right.y, s, L.beamTop ?? 0);
  const a = L.from, b = L.to;
  trail(ctx, a, b, L.arcH, L.tPlayer, s);
  // szellem-nyomvonal kis négyzetekkel (mint a játékban)
  [[L.tGhosts[0], 0.32], [L.tGhosts[1], 0.55]].forEach(([t, al]) => {
    for (let k = 1; k <= 6; k++) { const p = arcPoint(a, b, L.arcH, Math.max(0, t - k * 0.018)); ctx.fillStyle = 'rgba(180,76,255,' + (al * 0.35 * (1 - k / 7)) + ')'; const q = (10 - k) * s * 0.8; ctx.fillRect(p.x - q / 2, p.y - 14 * s - q / 2, q, q); }
  });
  L.tGhosts.forEach((t, i) => { const p = arcPoint(a, b, L.arcH, t); ghost(ctx, p.x, p.y, s, i === 0 ? 0.36 : 0.62); });
  if (L.buttonGhost) ghost(ctx, L.button.x + L.button.w / 2, L.left.y, s, 0.5);
  const p = arcPoint(a, b, L.arcH, L.tPlayer);
  // gyors mozgás: halvány szellemképek a figura mögött
  ctx.lineCap = 'round';
  for (const dy of [-19, -9]) {
    const q0 = arcPoint(a, b, L.arcH, L.tPlayer - 0.09), q1 = arcPoint(a, b, L.arcH, L.tPlayer - 0.03);
    const g = ctx.createLinearGradient(q0.x, q0.y, q1.x, q1.y);
    g.addColorStop(0, 'rgba(0,240,255,0)'); g.addColorStop(1, 'rgba(0,240,255,0.55)');
    ctx.strokeStyle = g; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(q0.x - 14 * s, q0.y + dy * s); ctx.lineTo(q1.x - 14 * s, q1.y + dy * s); ctx.stroke();
  }
  player(ctx, p.x, p.y, s);
}

const LAYOUTS = {
  // tág, középre húzott kompozíció: a szélek üresek, ha a portál vág vagy takar
  landscape(W, H) {
    const floor = 860;
    return {
      title: { lines: ['GHOST LOOP'], cx: W / 2, y: 300, maxW: 1240, maxSize: 170, gap: 1 },
      tag: { text: 'EVERY ATTEMPT COMES BACK TO HELP', y: 385, size: 30, spacing: 9 },
      horizon: floor + 10,
      scene: { s: 4.6, left: { x: 330, y: floor, w: 560, h: 300 }, right: { x: 1080, y: floor, w: 520, h: 300 },
        pit: { x: 890, y: floor + 40, w: 190, h: 40 }, button: { x: 430, w: 72 }, goal: { x: 1450 },
        from: { x: 700, y: floor }, to: { x: 1330, y: floor }, arcH: 300, tGhosts: [0.1, 0.4], tPlayer: 0.72 },
      beamTop: 420
    };
  },
  // álló: egymás alatti címsorok, a jelenet felfelé, egy magasabb platform felé ugrik
  portrait(W, H) {
    const floor = 1040;
    return {
      title: { lines: ['GHOST', 'LOOP'], cx: W / 2, y: 225, maxW: 620, maxSize: 150, gap: 1.02 },
      tag: { text: 'EVERY ATTEMPT COMES BACK TO HELP', y: 450, size: 22, spacing: 5 },
      horizon: floor + 10,
      scene: { s: 3.3, left: { x: 40, y: floor, w: 380, h: 200 }, right: { x: 500, y: 840, w: 270, h: 400 },
        pit: { x: 420, y: floor + 30, w: 80, h: 30 }, button: { x: 95, w: 52 }, goal: { x: 675 },
        from: { x: 250, y: floor }, to: { x: 610, y: 840 }, arcH: 200, tGhosts: [0.08, 0.42], tPlayer: 0.78 },
      beamTop: 520
    };
  },
  // négyzet: kétsoros cím fent, a jelenet alul teljes szélességben
  square(W, H) {
    const floor = 700;
    return {
      title: { lines: ['GHOST', 'LOOP'], cx: W / 2, y: 150, maxW: 560, maxSize: 118, gap: 1.02 },
      tag: { text: 'EVERY ATTEMPT COMES BACK TO HELP', y: 322, size: 18, spacing: 4 },
      horizon: floor + 8,
      scene: { s: 2.9, left: { x: 50, y: floor, w: 320, h: 120 }, right: { x: 460, y: floor, w: 290, h: 120 },
        pit: { x: 370, y: floor + 28, w: 90, h: 28 }, button: { x: 100, w: 46 }, goal: { x: 665 },
        from: { x: 250, y: floor }, to: { x: 600, y: floor }, arcH: 210, tGhosts: [0.08, 0.42], tPlayer: 0.76 },
      beamTop: 360
    };
  }
};

window.render = async (name, W, H, fonts) => {
  await loadFonts(fonts);
  const cv = document.getElementById('c'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const L = LAYOUTS[name](W, H);
  background(ctx, W, H, L.horizon, name.length * 7919);
  scene(ctx, { ...L.scene, beamTop: L.beamTop });
  vignette(ctx, W, H);
  const t = title(ctx, L.title.lines, L.title.cx, L.title.y, L.title.maxW, L.title.maxSize, L.title.gap);
  tagline(ctx, L.tag.text, W / 2, L.tag.y, L.tag.size, L.tag.spacing);
  return t.size;
};
</script></body></html>`;

// ------------------------------------------------------------------ futtatás
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const f of FORMATS) {
    const page = await browser.newPage({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: 1 });
    await page.setContent(PAGE);
    const size = await page.evaluate(([n, w, h, fonts]) => window.render(n, w, h, fonts), [f.name, f.w, f.h, FONTS]);
    const file = join(outDir, `cover-${f.name}-${f.w}x${f.h}.png`);
    await page.locator('#c').screenshot({ path: file });
    console.log(`${file.replace(root + '/', '')}  (title ${size}px)`);
    await page.close();
  }
} finally {
  await browser.close();
}
