// Statikus Graphics "besütése" textúrába. A Phaser a Graphics rajzparancsait minden
// képkockán újra feldolgozza; a sosem változó rétegeket (háttér, platformok, tüskék)
// ezért egyszer egy textúrába rajzoljuk, és onnan egyetlen képként jelenítjük meg.

import { RENDER_SCALE } from '../ui/theme.js';

/**
 * @param scene Phaser jelenet
 * @param layers Graphics objektumok alulról felfelé (a saját keverési módjukkal rajzolódnak)
 * @param key textúra-kulcs (jelenetenként fix, újrahasznosítva)
 * @param rect a besütendő terület logikai koordinátákban {x, y, w, h}
 * @returns a textúrát megjelenítő Image (a Graphics objektumok megsemmisülnek)
 */
export function bakeLayers(scene, layers, key, rect) {
  const S = RENDER_SCALE;
  const tex = scene.textures;
  if (tex.exists(key)) tex.remove(key);
  const w = Math.ceil(rect.w * S);
  const h = Math.ceil(rect.h * S);
  const dt = tex.addDynamicTexture(key, w, h);
  for (const g of layers) {
    // a belső felbontáson rajzolunk, hogy nagyított kamerán is éles maradjon
    g.setScale(S);
    dt.draw(g, -rect.x * S, -rect.y * S);
    g.destroy();
  }
  return scene.add.image(rect.x, rect.y, key).setOrigin(0).setScale(1 / S);
}

