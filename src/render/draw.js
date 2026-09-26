// Közös alakzat-rajzolók: élő figura, szellem-sziluett, neon keret.
// A játék, a menü-demó és a HUD ikonjai is ezeket használják, hogy egységes legyen a stílus.

import { COLORS } from '../ui/theme.js';

/** Neon keret: több, egyre halványabb vonal ADD rétegen + éles belső vonal */
export function neonRect(g, glow, x, y, w, h, color, { alpha = 1, radius = 0, width = 2 } = {}) {
  if (glow) {
    for (let i = 3; i >= 1; i--) {
      glow.lineStyle(width + i * 3, color, 0.07 * alpha);
      if (radius) glow.strokeRoundedRect(x - i, y - i, w + i * 2, h + i * 2, radius + i);
      else glow.strokeRect(x - i, y - i, w + i * 2, h + i * 2);
    }
  }
  g.lineStyle(width, color, alpha);
  if (radius) g.strokeRoundedRect(x, y, w, h, radius);
  else g.strokeRect(x, y, w, h);
}

/** Neon vonal ragyogással */
export function neonLine(g, glow, x0, y0, x1, y1, color, alpha = 1, width = 2) {
  if (glow) {
    glow.lineStyle(width + 8, color, 0.06 * alpha);
    glow.lineBetween(x0, y0, x1, y1);
    glow.lineStyle(width + 4, color, 0.14 * alpha);
    glow.lineBetween(x0, y0, x1, y1);
  }
  g.lineStyle(width, color, alpha);
  g.lineBetween(x0, y0, x1, y1);
}

/** Puha fényfolt koncentrikus körökből (ADD réteghez) */
export function softGlow(glow, x, y, r, color, alpha) {
  for (let i = 4; i >= 1; i--) {
    glow.fillStyle(color, alpha * 0.25);
    glow.fillCircle(x, y, (r * i) / 4);
  }
}

/**
 * Élő figura: lekerekített test, belső fény, pislogó szemek, amik a mozgás irányába néznek.
 * (bx,by) a bal felső sarok, w,h az (összenyomott/nyújtott) méret.
 */
export function drawPlayer(g, glow, bx, by, w, h, { facing = 1, vx = 0, t = 0, alpha = 1, color = COLORS.live } = {}) {
  if (glow) {
    glow.fillStyle(color, 0.1 * alpha);
    glow.fillRoundedRect(bx - 10, by - 10, w + 20, h + 20, 12);
    glow.fillStyle(color, 0.18 * alpha);
    glow.fillRoundedRect(bx - 4, by - 4, w + 8, h + 8, 8);
  }
  g.fillStyle(color, alpha);
  g.fillRoundedRect(bx, by, w, h, 5);
  // belső fényes rész (üveg-hatás)
  g.fillStyle(0xffffff, 0.35 * alpha);
  g.fillRoundedRect(bx + 3, by + 3, w - 6, h * 0.35, 3);
  g.fillStyle(0x001a22, 0.25 * alpha);
  g.fillRect(bx + 2, by + h - 5, w - 4, 3);
  // szemek: pislogás ~3 másodpercenként
  const blink = (t % 3.1) < 0.12;
  const look = Math.max(-2.5, Math.min(2.5, vx * 0.9)) + facing * 1.5;
  const cx = bx + w / 2 + look;
  const ey = by + h * 0.32;
  g.fillStyle(0x02121a, alpha);
  if (blink) {
    g.fillRect(cx - 6, ey + 3, 4, 2);
    g.fillRect(cx + 2, ey + 3, 4, 2);
  } else {
    g.fillRoundedRect(cx - 6, ey, 4, 8, 2);
    g.fillRoundedRect(cx + 2, ey, 4, 8, 2);
    g.fillStyle(0xffffff, 0.9 * alpha);
    g.fillRect(cx - 5, ey + 1, 1.5, 2);
    g.fillRect(cx + 3, ey + 1, 1.5, 2);
  }
}

/**
 * Szellem-sziluett: kerek tető, hullámzó "szoknya" alul, üres szemek.
 */
export function drawGhost(g, glow, bx, by, w, h, { facing = 1, t = 0, alpha = 0.6, phase = 0, color = COLORS.ghost } = {}) {
  const skirt = 6;
  if (glow) {
    glow.fillStyle(color, 0.16 * alpha);
    glow.fillRoundedRect(bx - 6, by - 6, w + 12, h + 10, { tl: 14, tr: 14, bl: 6, br: 6 });
  }
  g.fillStyle(color, alpha);
  g.fillRoundedRect(bx, by, w, h - skirt, { tl: Math.min(11, w / 2), tr: Math.min(11, w / 2), bl: 0, br: 0 });
  // hullámzó alj: 3 lefelé mutató fog, időben mozog
  const n = 3;
  const sw = w / n;
  const wob = Math.sin(t * 9 + phase) * 1.5;
  for (let i = 0; i < n; i++) {
    const x0 = bx + i * sw;
    const tip = by + h - (i % 2 === 0 ? 0 : 2) + (i % 2 === 0 ? wob : -wob);
    g.fillTriangle(x0, by + h - skirt - 0.5, x0 + sw, by + h - skirt - 0.5, x0 + sw / 2, tip);
  }
  // halvány belső fény
  g.fillStyle(0xffffff, 0.18 * alpha);
  g.fillRoundedRect(bx + 3, by + 3, w - 6, (h - skirt) * 0.35, { tl: 8, tr: 8, bl: 2, br: 2 });
  // szemek
  const cx = bx + w / 2 + facing * 2;
  const ey = by + h * 0.3;
  g.fillStyle(0x12021f, Math.min(1, alpha + 0.3));
  g.fillEllipse(cx - 4, ey + 3, 4.5, 7);
  g.fillEllipse(cx + 4, ey + 3, 4.5, 7);
}
