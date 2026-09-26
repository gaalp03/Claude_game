// Generált synthwave háttérzene WebAudio-val (nincs hangfájl).
// Előretekintő ütemezés: 25 ms-onként a következő ~150 ms hangjait ütemezzük be,
// így a ritmus pontos marad akkor is, ha a fő szál épp dolgozik.

import { sfx } from './sfx.js';

const BPM = 104;
const STEP = 60 / BPM / 4; // tizenhatod
const LOOKAHEAD = 0.15;

// Am – F – C – G (két ütemenként), MIDI hangmagasságok
const CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62] // G
];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// arpeggio minta a hármashangzat fokaiból (0-2, +3 = oktávval feljebb)
const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3];

class Music {
  constructor() {
    this.enabled = true;
    this.playing = false;
    this.intensity = 0; // 0 = menü, 1 = játék
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.out = null;
  }

  _setup() {
    const ctx = sfx.ctx;
    if (!ctx || this.out) return !!this.out;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);
    // közös visszhang az arpeggiónak
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(wet);
    wet.connect(this.out);
    // az arpeggio szűrője lassan "nyílik és zárul"
    this.arpFilter = ctx.createBiquadFilter();
    this.arpFilter.type = 'lowpass';
    this.arpFilter.frequency.value = 1400;
    this.arpFilter.Q.value = 4;
    this.arpFilter.connect(this.out);
    this.arpFilter.connect(this.delay);
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padFilter.connect(this.out);
    return true;
  }

  _targetGain() {
    return this.enabled && !sfx.muted && !sfx.adMuted ? 0.2 : 0;
  }

  /** Hangerő frissítése (némítás, reklám, beállítás) */
  refresh() {
    if (!this.out) return;
    const t = sfx.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(this._targetGain(), t, 0.3);
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (this.enabled) this.start();
    this.refresh();
  }

  setIntensity(v) {
    this.intensity = v;
  }

  start() {
    if (this.playing || !this.enabled) return;
    if (!this._setup()) return;
    this.playing = true;
    this.nextTime = sfx.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this._schedule(), 25);
    this.refresh();
  }

  _schedule() {
    const ctx = sfx.ctx;
    if (!ctx || ctx.state !== 'running') return;
    // ha a lap sokáig háttérben volt, ne próbáljuk "bepótolni" a lemaradást
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this._playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % (16 * 8);
    }
  }

  _osc(type, freq, t, dur, vol, dest, { attack = 0.01, detune = 0 } = {}) {
    const ctx = sfx.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _playStep(step, t) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const game = this.intensity > 0;

    // pad: ütemenként egy hosszú, lebegtetett akkord
    if (s === 0) {
      for (const n of chord) {
        this._osc('sawtooth', midi(n), t, STEP * 16, 0.028, this.padFilter, { attack: 0.5, detune: -7 });
        this._osc('sawtooth', midi(n), t, STEP * 16, 0.028, this.padFilter, { attack: 0.5, detune: 7 });
      }
      // a szűrő lassan mozog a 8 ütemes ciklus alatt
      const f = 700 + 500 * Math.sin((bar / 8) * Math.PI * 2);
      this.padFilter.frequency.setTargetAtTime(f, t, 1);
      this.arpFilter.frequency.setTargetAtTime(1000 + 900 * (0.5 + 0.5 * Math.sin((bar / 8) * Math.PI * 2 + 1)), t, 1);
    }
    // arpeggio tizenhatodokban
    const deg = ARP[s];
    const note = chord[deg % 3] + 12 * (1 + Math.floor(deg / 3));
    this._osc(game ? 'square' : 'triangle', midi(note), t, STEP * 0.9, game ? 0.035 : 0.05, this.arpFilter);

    if (!game) return;
    // basszus nyolcadokban
    if (s % 2 === 0) this._osc('triangle', midi(chord[0] - 24), t, STEP * 1.8, 0.16, this.out);
    // lábdob negyedekben
    if (s % 4 === 0) {
      const ctx = sfx.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g);
      g.connect(this.out);
      o.start(t);
      o.stop(t + 0.25);
    }
    // cin az ütésközökben
    if (s % 4 === 2 && sfx.noiseBuf) {
      const ctx = sfx.ctx;
      const src = ctx.createBufferSource();
      src.buffer = sfx.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.out);
      src.start(t);
      src.stop(t + 0.06);
    }
  }
}

export const music = new Music();
