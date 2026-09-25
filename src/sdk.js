// CrazyGames SDK hívási pontok – KIKAPCSOLT állapotban.
// Élesítéshez: 1) index.html-be a CrazyGames SDK v3 script tag, 2) SDK_ENABLED = true.
// Kikapcsolva minden hívás helyi placeholder: nincs hálózati forgalom, a reklám-callback
// azonnal lefut, így a játék menete változatlan.

export const SDK_ENABLED = false;

const DEBUG = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
const state = { gameplay: false, ready: false, onAdMute: null, onAdUnmute: null };

function log(...args) {
  if (DEBUG) console.debug('[sdk]', ...args);
}

function sdk() {
  if (!SDK_ENABLED) return null;
  return (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK) || null;
}

/** Inicializálás a betöltés elején. A hang némításához/visszaadásához callbackeket kér. */
export async function init({ onAdMute, onAdUnmute } = {}) {
  state.onAdMute = onAdMute || null;
  state.onAdUnmute = onAdUnmute || null;
  const s = sdk();
  if (s && s.init) {
    try {
      await s.init();
    } catch (err) {
      log('init failed', err);
    }
  }
  state.ready = true;
  log('init', SDK_ENABLED ? 'enabled' : 'disabled (placeholder)');
}

export function loadingStart() {
  log('loadingStart');
  sdk()?.game?.loadingStart?.();
}

export function loadingStop() {
  log('loadingStop');
  sdk()?.game?.loadingStop?.();
}

/** Aktív játékmenet kezdete (pálya indul / folytatódik) */
export function gameplayStart() {
  if (state.gameplay) return;
  state.gameplay = true;
  log('gameplayStart');
  sdk()?.game?.gameplayStart?.();
}

/** Aktív játékmenet vége (szünet, menü, eredményképernyő) */
export function gameplayStop() {
  if (!state.gameplay) return;
  state.gameplay = false;
  log('gameplayStop');
  sdk()?.game?.gameplayStop?.();
}

/** Örömpillanat: pálya első teljesítése, napi kihívás megoldása */
export function happytime() {
  log('happytime');
  sdk()?.game?.happytime?.();
}

/**
 * Pályák közti reklám helye. Kikapcsolt SDK-nál azonnal továbbenged.
 * @param {() => void} done a reklám után (vagy helyette) hívódik
 */
export function midgameAd(done) {
  const s = sdk();
  if (!s || !s.ad || !s.ad.requestAd) {
    log('midgameAd (skipped: placeholder)');
    done();
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    state.onAdUnmute?.();
    done();
  };
  try {
    s.ad.requestAd('midgame', {
      adStarted: () => state.onAdMute?.(),
      adFinished: finish,
      adError: finish
    });
  } catch {
    finish();
  }
}

/**
 * Jutalomvideó (pl. megoldás megmutatása előtt). Kikapcsolt SDK-nál azonnal jutalmaz.
 * @param {() => void} onReward ha a videó végigment (vagy placeholder)
 * @param {() => void} [onSkip] ha a videó nem ment végig / hiba
 */
export function rewardedAd(onReward, onSkip = () => {}) {
  const s = sdk();
  if (!s || !s.ad || !s.ad.requestAd) {
    log('rewardedAd (placeholder: reward granted)');
    onReward();
    return;
  }
  try {
    s.ad.requestAd('rewarded', {
      adStarted: () => state.onAdMute?.(),
      adFinished: () => {
        state.onAdUnmute?.();
        onReward();
      },
      adError: () => {
        state.onAdUnmute?.();
        onSkip();
      }
    });
  } catch {
    onSkip();
  }
}
