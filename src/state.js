// Alkalmazás-szintű állapot: a mentés egyetlen példánya és a hangbeállítás.
import { loadSave, writeSave } from './core/save.js';
import { sfx } from './audio/sfx.js';

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
  levelsCompletedThisSession: 0
};

sfx.setMuted(app.save.settings.muted);
