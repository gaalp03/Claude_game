import { describe, it, expect, afterEach } from 'vitest';
import { defaultSave, loadSave, writeSave, recordLevel, recordDaily, mergeSaves, mergePB, SAVE_KEY, PB_KEY } from '../src/core/save.js';
import { createSaveSync } from '../src/core/save-sync.js';
import { recordStars } from '../src/core/progress.js';
import * as sdk from '../src/sdk.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}

/** Szimulált CrazyGames SDK: késleltethető / hibázó init, Data Module memóriában */
function fakeSdk({ environment = 'crazygames', delay = 0, fail = false, dataDisabled = false, data = memStorage() } = {}) {
  const dataModule = dataDisabled
    ? {
        getItem() {
          throw new Error('dataModuleDisabled');
        },
        setItem() {
          throw new Error('dataModuleDisabled');
        }
      }
    : data;
  return {
    environment,
    data: dataModule,
    init: () =>
      new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error('init failed')) : resolve()), delay))
  };
}

const RESULT = { attempts: 3, ghosts: 1, frames: 400, outcomes: ['ghost', 'win'] };

function sampleSave() {
  const s = defaultSave();
  recordLevel(s, 'level01', 300, 0, 2);
  recordStars(s, 'level01', 0b011, 'silver');
  recordLevel(s, 'level02', 520, 1, 4);
  recordDaily(s, '2026-09-25', RESULT);
  recordDaily(s, '2026-09-26', RESULT);
  s.settings.skin = 'ember';
  s.stats.loops = 12;
  s.achievements.first_loop = 1000;
  return s;
}

afterEach(async () => {
  // a modul-szintű SDK-állapot alaphelyzetbe (nincs SDK)
  await sdk.init({ sdkObject: null });
});

describe('sdk data module detection', () => {
  it('keeps only the data module switched on', () => {
    expect(sdk.SDK_DATA_ENABLED).toBe(true);
    expect(sdk.SDK_ADS_ENABLED).toBe(false);
    expect(sdk.SDK_EVENTS_ENABLED).toBe(false);
  });

  it('returns the Data Module on CrazyGames', async () => {
    const fake = fakeSdk();
    expect(await sdk.init({ sdkObject: fake })).toBe(true);
    expect(sdk.environment()).toBe('crazygames');
    expect(sdk.dataStorage()).toBe(fake.data);
  });

  it('falls back (null) without SDK, on init error, outside CrazyGames and with a disabled module', async () => {
    expect(await sdk.init({ sdkObject: null })).toBe(false);
    expect(sdk.dataStorage()).toBeNull();

    expect(await sdk.init({ sdkObject: fakeSdk({ fail: true }) })).toBe(false);
    expect(sdk.dataStorage()).toBeNull();

    await sdk.init({ sdkObject: fakeSdk({ environment: 'disabled' }) });
    expect(sdk.dataStorage()).toBeNull();

    await sdk.init({ sdkObject: fakeSdk({ environment: 'local' }) });
    expect(sdk.dataStorage()).toBeNull();
    expect(sdk.dataStorage({ allowLocal: true })).not.toBeNull();

    await sdk.init({ sdkObject: fakeSdk({ dataDisabled: true }) });
    expect(sdk.dataStorage()).toBeNull();
  });

  it('does not hang when init never finishes', async () => {
    const stuck = { environment: 'crazygames', data: memStorage(), init: () => new Promise(() => {}) };
    expect(await sdk.init({ sdkObject: stuck, timeoutMs: 30 })).toBe(false);
    expect(sdk.dataStorage()).toBeNull();
  });

  it('ads resolve immediately while ads are disabled, even with a live SDK', async () => {
    let requested = false;
    const fake = fakeSdk();
    fake.ad = { requestAd: () => (requested = true) };
    fake.game = { gameplayStart: () => (requested = true) };
    await sdk.init({ sdkObject: fake });
    let done = false;
    sdk.midgameAd(() => (done = true));
    sdk.gameplayStart();
    sdk.gameplayStop();
    expect(done).toBe(true);
    expect(requested).toBe(false);
  });
});

describe('save sync', () => {
  it('round-trips through a simulated Data Module', async () => {
    const cloudData = memStorage();
    // 1. eszköz: helyi mentés + felhő
    const local1 = memStorage();
    const a = createSaveSync({ local: local1 });
    const save1 = a.load();
    await sdk.init({ sdkObject: fakeSdk({ data: cloudData, delay: 5 }) });
    a.attach(sdk.dataStorage(), save1);
    Object.assign(save1, sampleSave());
    writeSave(save1, a.storage);
    a.storage.setItem(PB_KEY, JSON.stringify({ level01: 'pbtrack' }));
    expect(cloudData.getItem(SAVE_KEY)).not.toBeNull();

    // 2. eszköz: üres localStorage, a felhőből kap mindent
    const local2 = memStorage();
    const b = createSaveSync({ local: local2 });
    const save2 = b.load();
    expect(save2).toEqual(defaultSave());
    expect(b.attach(cloudData, save2)).toBe(true);
    expect(save2.levels.level01).toMatchObject({ done: true, bestFrames: 300, fewestGhosts: 0, stars: 0b011, medal: 'silver' });
    expect(save2.levels.level02).toMatchObject({ bestFrames: 520, fewestGhosts: 1 });
    expect(save2.daily).toMatchObject({ streak: 2, best: 2, last: '2026-09-26' });
    expect(save2.settings.skin).toBe('ember');
    expect(save2.achievements.first_loop).toBe(1000);
    expect(JSON.parse(local2.getItem(PB_KEY)).level01).toBe('pbtrack');
    // a helyi tükör is megkapta
    expect(loadSave(local2).levels.level01.bestFrames).toBe(300);
  });

  it('uses localStorage alone when the Data Module is unavailable', async () => {
    const local = memStorage();
    await sdk.init({ sdkObject: fakeSdk({ dataDisabled: true }) });
    const cloud = sdk.dataStorage();
    expect(cloud).toBeNull();
    const s = createSaveSync({ local });
    const save = s.load();
    expect(s.attach(cloud, save)).toBe(false);
    expect(s.hasCloud).toBe(false);
    recordLevel(save, 'level03', 410, 2, 5);
    writeSave(save, s.storage);
    const again = createSaveSync({ local }).load();
    expect(again.levels.level03).toMatchObject({ done: true, bestFrames: 410, fewestGhosts: 2 });
  });

  it('keeps playing locally when the cloud fails to save', () => {
    const local = memStorage();
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const s = createSaveSync({ local });
    const save = s.load();
    s.attach(broken, save);
    recordLevel(save, 'level04', 333, 1, 1);
    expect(writeSave(save, s.storage)).toBe(true);
    expect(loadSave(local).levels.level04.bestFrames).toBe(333);
  });

  it('merges a slow cloud with local progress, keeping the better result from both', async () => {
    // felhő: régebbi eszközön elért eredmények
    const cloudData = memStorage();
    const cloudSave = defaultSave();
    recordLevel(cloudSave, 'level01', 280, 1, 3); // gyorsabb idő, több szellem
    recordStars(cloudSave, 'level01', 0b100, 'gold');
    recordLevel(cloudSave, 'level05', 700, 2, 6); // csak a felhőben
    recordDaily(cloudSave, '2026-09-20', RESULT);
    cloudSave.stats.loops = 50;
    cloudSave.stats.deaths = 2;
    cloudSave.achievements.first_loop = 500;
    cloudSave.achievements.ghost_master = 900;
    cloudSave.settings.skin = 'mint';
    writeSave(cloudSave, cloudData);
    cloudSave.savedAt = 1000;
    cloudData.setItem(SAVE_KEY, JSON.stringify(cloudSave));
    cloudData.setItem(PB_KEY, JSON.stringify({ level01: 'cloud-fast', level05: 'cloud-only' }));

    // helyi indulás, a felhő még nincs meg
    const local = memStorage();
    const s = createSaveSync({ local });
    const save = s.load();
    const ref = save;
    recordLevel(save, 'level01', 320, 0, 2); // lassabb, de kevesebb szellem
    recordStars(save, 'level01', 0b011, 'silver');
    recordLevel(save, 'level02', 450, 1, 1); // csak helyben
    save.stats.deaths = 9;
    save.achievements.first_loop = 800;
    save.settings.lowFx = true;
    writeSave(save, s.storage);
    local.setItem(PB_KEY, JSON.stringify({ level01: 'local-slow', level02: 'local-only' }));
    expect(cloudData.getItem(SAVE_KEY)).toContain('level05'); // a felhőt még nem írtuk felül

    // lassan megjön az SDK
    const fake = fakeSdk({ data: cloudData, delay: 20 });
    await sdk.init({ sdkObject: fake });
    let notified = null;
    const s2 = createSaveSync({ local, onUpdate: (c) => (notified = c) });
    s2.attach(sdk.dataStorage(), save);

    expect(save).toBe(ref); // ugyanaz az objektum frissült
    expect(notified).toBe(true);
    expect(save.levels.level01).toMatchObject({ done: true, bestFrames: 280, fewestGhosts: 0, attempts: 2, stars: 0b111, medal: 'gold' });
    expect(save.levels.level02.bestFrames).toBe(450);
    expect(save.levels.level05.bestFrames).toBe(700);
    expect(save.daily.history['2026-09-20']).toBeTruthy();
    expect(save.stats).toMatchObject({ loops: 50, deaths: 9 });
    expect(save.achievements).toMatchObject({ first_loop: 500, ghost_master: 900 });
    expect(save.settings.lowFx).toBe(true); // eszközfüggő, helyi marad

    // mindkét tárolóban ugyanaz az egyesített mentés
    expect(loadSave(local)).toEqual(loadSave(cloudData));
    const pb = JSON.parse(cloudData.getItem(PB_KEY));
    expect(pb).toEqual({ level01: 'cloud-fast', level02: 'local-only', level05: 'cloud-only' });
    expect(JSON.parse(local.getItem(PB_KEY))).toEqual(pb);

    // ezután minden írás mindkét helyre megy
    recordLevel(save, 'level06', 600, 1, 2);
    writeSave(save, s2.storage);
    expect(loadSave(cloudData).levels.level06.bestFrames).toBe(600);
    expect(loadSave(local).levels.level06.bestFrames).toBe(600);
  });

  it('reports no change when both sides already match', () => {
    const local = memStorage();
    const cloud = memStorage();
    const s = createSaveSync({ local });
    const save = s.load();
    Object.assign(save, sampleSave());
    writeSave(save, local);
    writeSave(save, cloud);
    expect(s.attach(cloud, save)).toBe(false);
  });
});

describe('mergeSaves', () => {
  it('is symmetric for progress and does not mutate its inputs', () => {
    const a = sampleSave();
    const b = defaultSave();
    recordLevel(b, 'level01', 250, 2, 9);
    recordStars(b, 'level01', 0b100, 'dev');
    const snapA = JSON.stringify(a);
    const snapB = JSON.stringify(b);
    const m1 = mergeSaves(a, b);
    const m2 = mergeSaves(b, a);
    expect(JSON.stringify(a)).toBe(snapA);
    expect(JSON.stringify(b)).toBe(snapB);
    for (const m of [m1, m2]) {
      expect(m.levels.level01).toMatchObject({ bestFrames: 250, fewestGhosts: 0, attempts: 2, stars: 0b111, medal: 'dev' });
      expect(m.levels.level02.bestFrames).toBe(520);
    }
  });

  it('merges daily streaks and history', () => {
    const a = defaultSave();
    recordDaily(a, '2026-09-01', RESULT);
    recordDaily(a, '2026-09-02', RESULT);
    recordDaily(a, '2026-09-03', RESULT); // 3 napos sorozat, régebbi
    const b = defaultSave();
    recordDaily(b, '2026-09-02', { ...RESULT, frames: 300 });
    recordDaily(b, '2026-09-10', { ...RESULT, frames: 500 });
    const m = mergeSaves(a, b);
    expect(m.daily.last).toBe('2026-09-10');
    expect(m.daily.streak).toBe(b.daily.streak);
    expect(m.daily.best).toBe(3);
    expect(Object.keys(m.daily.history).sort()).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10']);
    expect(m.daily.history['2026-09-02'].frames).toBe(300);
  });

  it('takes settings from the newer save', () => {
    const a = defaultSave();
    a.settings.skin = 'neon';
    a.settings.muted = true;
    a.savedAt = 100;
    const b = defaultSave();
    b.settings.skin = 'prism';
    b.settings.muted = false;
    b.settings.lowFx = true;
    b.savedAt = 200;
    const m = mergeSaves(a, b);
    expect(m.settings).toMatchObject({ skin: 'prism', muted: false, lowFx: false });
    expect(mergeSaves({ ...a, savedAt: 300 }, b).settings.skin).toBe('neon');
  });

  it('picks the PB track that belongs to the better time', () => {
    const la = { levels: { x: { bestFrames: 400 }, y: { bestFrames: 300 } } };
    const cb = { levels: { x: { bestFrames: 350 }, y: { bestFrames: 310 } } };
    expect(mergePB({ x: 'L', y: 'L' }, { x: 'C', y: 'C', z: 'C' }, la, cb)).toEqual({ x: 'C', y: 'L', z: 'C' });
  });
});
