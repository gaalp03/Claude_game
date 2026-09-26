// CrazyGames SDK v3 hívási pontok, funkciónként külön kapcsolóval.
// Az SDK-t az index.html tölti be (hivatalos script tag). Ha nincs meg (helyi teszt, Tailscale,
// offline), vagy nem a CrazyGames környezetében fut, minden hívás helyi placeholder:
// a mentés localStorage-ba megy, a reklám-callback azonnal lefut.

/** Mentés a Data Module-lal (CrazyGames-en a játékos fiókjába) */
export const SDK_DATA_ENABLED = true;
/** Reklámok (midgame, rewarded) – még kikapcsolva */
export const SDK_ADS_ENABLED = false;
/** Játékmenet-események (loading/gameplay/happytime) – még kikapcsolva */
export const SDK_EVENTS_ENABLED = false;

const INIT_TIMEOUT_MS = 8000;

const DEBUG = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
const state = { gameplay: false, ready: false, ok: false, sdk: null, onAdMute: null, onAdUnmute: null };

function log(...args) {
  if (DEBUG) console.debug('[sdk]', ...args);
}

function globalSdk() {
  return (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK) || null;
}

/** Az SDK objektum, ha sikeresen inicializáltuk (egyébként null) */
function sdk() {
  return state.ok ? state.sdk : null;
}

const events = () => (SDK_EVENTS_ENABLED ? sdk() : null);
const ads = () => (SDK_ADS_ENABLED ? sdk() : null);

/**
 * Inicializálás a betöltés elején. Soha nem dob; a visszaadott ígéret legkésőbb
 * INIT_TIMEOUT_MS után teljesül. A hang némításához/visszaadásához callbackeket kér.
 * @param {{ onAdMute?: Function, onAdUnmute?: Function, sdkObject?: object, timeoutMs?: number }} [opts]
 *   sdkObject: tesztekhez injektálható SDK (alapból window.CrazyGames.SDK)
 */
export async function init({ onAdMute, onAdUnmute, sdkObject, timeoutMs = INIT_TIMEOUT_MS } = {}) {
  state.onAdMute = onAdMute || null;
  state.onAdUnmute = onAdUnmute || null;
  state.ok = false;
  state.sdk = null;
  const s = sdkObject !== undefined ? sdkObject : globalSdk();
  const wanted = SDK_DATA_ENABLED || SDK_ADS_ENABLED || SDK_EVENTS_ENABLED;
  if (wanted && s && typeof s.init === 'function') {
    let timer = null;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('sdk init timeout')), timeoutMs);
      });
      await Promise.race([Promise.resolve().then(() => s.init()), timeout]);
      state.sdk = s;
      state.ok = true;
    } catch (err) {
      log('init failed', err);
    } finally {
      clearTimeout(timer);
    }
  }
  state.ready = true;
  log('init', state.ok ? `ok (${state.sdk.environment})` : 'not available (placeholder)');
  return state.ok;
}

/** 'crazygames' | 'local' | 'disabled' | 'none' (nincs SDK) */
export function environment() {
  return sdk()?.environment || 'none';
}

/**
 * A Data Module localStorage-szerű tárolója, ha használható, különben null.
 * Csak a CrazyGames környezetében aktív; helyben (environment 'local') a ?cgdata=1
 * URL-paraméterrel próbálható ki a valódi SDK-val.
 * @param {{ allowLocal?: boolean }} [opts]
 */
export function dataStorage({ allowLocal = localDataParam() } = {}) {
  if (!SDK_DATA_ENABLED) return null;
  const s = sdk();
  const env = s?.environment;
  if (!s || !s.data || !(env === 'crazygames' || (allowLocal && env === 'local'))) return null;
  const d = s.data;
  if (typeof d.getItem !== 'function' || typeof d.setItem !== 'function') return null;
  try {
    // ha a portálon nincs bekapcsolva a Data Module, itt "dataModuleDisabled" hibát dob
    d.getItem('ghostloop.probe');
  } catch (err) {
    log('data module unavailable', err);
    return null;
  }
  return d;
}

function localDataParam() {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get('cgdata') === '1';
  } catch {
    return false;
  }
}

export function loadingStart() {
  log('loadingStart');
  events()?.game?.loadingStart?.();
}

export function loadingStop() {
  log('loadingStop');
  events()?.game?.loadingStop?.();
}

/** Aktív játékmenet kezdete (pálya indul / folytatódik) */
export function gameplayStart() {
  if (state.gameplay) return;
  state.gameplay = true;
  log('gameplayStart');
  events()?.game?.gameplayStart?.();
}

/** Aktív játékmenet vége (szünet, menü, eredményképernyő) */
export function gameplayStop() {
  if (!state.gameplay) return;
  state.gameplay = false;
  log('gameplayStop');
  events()?.game?.gameplayStop?.();
}

/** Örömpillanat: pálya első teljesítése, napi kihívás megoldása */
export function happytime() {
  log('happytime');
  events()?.game?.happytime?.();
}

/**
 * Pályák közti reklám helye. Kikapcsolt SDK-nál azonnal továbbenged.
 * @param {() => void} done a reklám után (vagy helyette) hívódik
 */
export function midgameAd(done) {
  const s = ads();
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
  const s = ads();
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
