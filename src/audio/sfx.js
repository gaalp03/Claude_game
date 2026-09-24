// Szintetizált hangeffektek WebAudio API-val – külső hangfájl nélkül.
// Az AudioContext az első felhasználói interakciónál jön létre (böngésző-szabály).

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.echo = null;
    this.noiseBuf = null;
    this.muted = false;
    this.adMuted = false;
    this.lastStep = 0;
  }

  /** Első gesztusnál hívandó; többszöri hívás biztonságos. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this._targetGain();
      this.master.connect(this.ctx.destination);

      // visszhang-lánc a szellem-rögzítés hangjához (késleltetés + visszacsatolás)
      const delay = this.ctx.createDelay(1);
      delay.delayTime.value = 0.14;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.45;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.6;
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
      this.echo = delay;

      // fehérzaj puffer (lépés, halál)
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 2147483647) * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _targetGain() {
    return this.muted || this.adMuted ? 0 : 0.5;
  }

  _applyGain() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this._targetGain(), t, 0.02);
  }

  setMuted(m) {
    this.muted = !!m;
    this._applyGain();
  }

  /** Reklám közben némítunk (SDK callback) */
  setAdMuted(m) {
    this.adMuted = !!m;
    this._applyGain();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  // Egy oszcillátoros hang burkolóval és opcionális frekvencia-csúszással
  _tone({ type = 'square', f0, f1 = f0, dur = 0.12, vol = 0.2, at = 0, dest = null, attack = 0.005 }) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.1, vol = 0.2, freq = 2000, q = 1, type = 'bandpass', at = 0, f1 = null }) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    if (f1) filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    filt.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  step() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStep < 0.09) return;
    this.lastStep = now;
    this._noise({ dur: 0.035, vol: 0.12, freq: 1800 + Math.random() * 600, q: 2 });
  }

  jump() {
    if (!this.ready) return;
    this._tone({ type: 'square', f0: 260, f1: 620, dur: 0.12, vol: 0.09 });
  }

  land() {
    if (!this.ready) return;
    this._noise({ dur: 0.06, vol: 0.14, freq: 600, q: 1, type: 'lowpass' });
  }

  death() {
    if (!this.ready) return;
    this._noise({ dur: 0.35, vol: 0.35, freq: 3000, f1: 200, q: 0.8, type: 'lowpass' });
    this._tone({ type: 'sawtooth', f0: 420, f1: 60, dur: 0.4, vol: 0.14 });
  }

  ghostDeath() {
    if (!this.ready) return;
    this._tone({ type: 'triangle', f0: 500, f1: 150, dur: 0.25, vol: 0.08 });
  }

  /** Célba érés: kellemes dúr akkord (arpeggio + kitartott hang) */
  win() {
    if (!this.ready) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      this._tone({ type: 'triangle', f0: f, dur: 0.9 - i * 0.1, vol: 0.12, at: i * 0.06, attack: 0.01 });
      this._tone({ type: 'sine', f0: f / 2, dur: 1.0, vol: 0.05, at: i * 0.06, attack: 0.02 });
    });
  }

  /** Szellem rögzítése: visszhangos csippanás */
  record() {
    if (!this.ready) return;
    this._tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.1, vol: 0.18, dest: this.echo });
    this._tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.1, vol: 0.14 });
  }

  undo() {
    if (!this.ready) return;
    this._tone({ type: 'sine', f0: 900, f1: 420, dur: 0.14, vol: 0.12 });
  }

  restart() {
    if (!this.ready) return;
    this._tone({ type: 'triangle', f0: 330, f1: 220, dur: 0.1, vol: 0.08 });
  }

  timeout() {
    if (!this.ready) return;
    this._tone({ type: 'square', f0: 220, dur: 0.12, vol: 0.08 });
    this._tone({ type: 'square', f0: 165, dur: 0.2, vol: 0.08, at: 0.13 });
  }

  button(pressed) {
    if (!this.ready) return;
    this._tone({ type: 'square', f0: pressed ? 700 : 500, dur: 0.05, vol: 0.06 });
  }

  door(open) {
    if (!this.ready) return;
    this._tone({ type: 'sawtooth', f0: open ? 140 : 220, f1: open ? 220 : 140, dur: 0.16, vol: 0.05 });
  }

  click() {
    if (!this.ready) return;
    this._tone({ type: 'square', f0: 1000, f1: 1400, dur: 0.04, vol: 0.06 });
  }

  hover() {
    if (!this.ready) return;
    this._tone({ type: 'sine', f0: 1200, dur: 0.03, vol: 0.03 });
  }
}

export const sfx = new Sfx();
