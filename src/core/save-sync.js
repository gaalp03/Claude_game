// Mentés-szinkron: a játék mindig azonnal, a helyi (localStorage) mentésből indul. Ha később
// megjön a CrazyGames Data Module (felhő), a kettőt egyesítjük (mindenből a jobb eredmény
// marad), és onnantól minden írás mindkét helyre megy. Phaser-független, tesztelhető.

import { loadSave, writeSave, mergeSaves, mergePB, readPBMap, writePBMap } from './save.js';

/** Kulcssorrendtől független JSON (a változás-összevetéshez) */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** A változás-összevetésből kihagyjuk az írás idejét */
const fingerprint = (save) => stable({ ...save, savedAt: 0 });

/**
 * @param {{ local?: Storage|null, onUpdate?: (changed: boolean) => void }} opts
 *   local: a helyi tároló (alapból localStorage; privát módban lehet null)
 *   onUpdate: a felhő-adat beolvasztása után hívódik
 */
export function createSaveSync({ local = null, onUpdate = null } = {}) {
  const sync = {
    local,
    cloud: null,

    /** getItem/setItem felület a meglévő mentésfüggvényeknek (loadSave, writeSave, loadPB, savePB) */
    storage: {
      getItem(key) {
        // a helyi tükör az egyesítés után mindig naprakész; ha nincs, a felhőből olvasunk
        if (sync.local) {
          try {
            return sync.local.getItem(key);
          } catch {
            // tovább a felhőre
          }
        }
        if (sync.cloud) {
          try {
            return sync.cloud.getItem(key);
          } catch {
            return null;
          }
        }
        return null;
      },
      setItem(key, value) {
        let ok = false;
        if (sync.local) {
          try {
            sync.local.setItem(key, value);
            ok = true;
          } catch {
            // megtelt vagy tiltott tároló: a felhő még menthet
          }
        }
        if (sync.cloud) {
          try {
            sync.cloud.setItem(key, value);
            ok = true;
          } catch {
            // a felhő hibája nem akaszthatja meg a játékot
          }
        }
        if (!ok) throw new Error('no storage available');
      }
    },

    get hasCloud() {
      return !!sync.cloud;
    },

    /** Mentés betöltése (induláskor: csak a helyi tükör) */
    load() {
      return loadSave(sync.storage);
    },

    /**
     * A Data Module megérkezett: egyesítés, visszaírás mindkét helyre, és a memóriabeli
     * mentés helyben frissül (a meglévő hivatkozások érvényesek maradnak).
     * @param {Storage} cloud a Data Module (getItem/setItem)
     * @param {object} save a játék futó mentés-objektuma
     * @returns {boolean} változott-e a mentés tartalma
     */
    attach(cloud, save) {
      if (!cloud) return false;
      let cloudSave;
      let cloudPB;
      try {
        cloudSave = loadSave(cloud);
        cloudPB = readPBMap(cloud);
      } catch {
        return false;
      }
      const before = fingerprint(save);
      const localPB = sync.local ? readPBMap(sync.local) : {};
      const merged = mergeSaves(save, cloudSave);
      const pb = mergePB(localPB, cloudPB, save, cloudSave);
      for (const k of Object.keys(merged)) save[k] = merged[k];
      sync.cloud = cloud;
      writeSave(save, sync.storage);
      writePBMap(pb, sync.storage);
      const changed = fingerprint(save) !== before || stable(pb) !== stable(localPB);
      onUpdate?.(changed);
      return changed;
    }
  };
  return sync;
}
