// Alkalmazás-szintű állapot: a mentés egyetlen példánya és a hangbeállítás.
import { loadSave, writeSave } from './core/save.js';
import { sfx } from './audio/sfx.js';
import { music } from './audio/music.js';
import { QUALITY } from './ui/theme.js';

export const app = {
  save: loadSave(),
  persist() {
    writeSave(this.save);
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
