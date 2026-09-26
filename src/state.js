// Alkalmazás-szintű állapot: a mentés egyetlen példánya és a hangbeállítás.
// A mentés a helyi tárolóból indul; CrazyGames-en a Data Module megérkezése után
// (BootScene → app.attachCloud) egyesítve a felhőbe is ír.
import { writeSave, loadPB, savePB, safeStorage } from './core/save.js';
import { createSaveSync } from './core/save-sync.js';
import { sfx } from './audio/sfx.js';
import { music } from './audio/music.js';
import { QUALITY } from './ui/theme.js';

const sync = createSaveSync({ local: safeStorage() });

export const app = {
  sync,
  save: sync.load(),
  /** a felhő-adat beolvasztása után hívódik (a menük frissítéséhez) */
  onCloudUpdate: null,
  persist() {
    writeSave(this.save, sync.storage);
  },
  loadPB(id) {
    return loadPB(id, sync.storage);
  },
  savePB(id, encoded) {
    return savePB(id, encoded, sync.storage);
  },
  /** A Data Module megjött: egyesítés, a beállítások újra alkalmazása, értesítés */
  attachCloud(cloud) {
    const changed = sync.attach(cloud, this.save);
    if (changed) {
      sfx.setMuted(this.save.settings.muted);
      music.setEnabled(this.save.settings.music !== false);
    }
    this.onCloudUpdate?.(changed);
    return changed;
  },
  toggleMute() {
    this.save.settings.muted = !this.save.settings.muted;
    sfx.setMuted(this.save.settings.muted);
    this.persist();
    return this.save.settings.muted;
  },
  toggleMusic() {
    this.save.settings.music = !this.save.settings.music;
    music.setEnabled(this.save.settings.music);
    this.persist();
    return this.save.settings.music;
  },
  levelsCompletedThisSession: 0
};

sfx.setMuted(app.save.settings.muted);
// effekt-minőség: ?fx=lite / ?fx=full URL-paraméterrel kényszeríthető, egyébként a mentett (mért) érték
const fxParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('fx') : null;
QUALITY.forced = fxParam === 'lite' || fxParam === 'full';
QUALITY.low = fxParam ? fxParam === 'lite' : !!app.save.settings.lowFx;
music.enabled = app.save.settings.music !== false;
// a zene az első felhasználói gesztusnál indul (böngésző-szabály), és követi a némítást
sfx.onUnlock = () => music.start();
sfx.onGainChange = () => music.refresh();
