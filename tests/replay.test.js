import { describe, it, expect } from 'vitest';
import { loadLevel } from '../src/core/level-loader.js';
import { createWorld } from '../src/core/world.js';
import { encodeRLE, decodeRLE, Recorder, inputAt, simulateRound } from '../src/core/replay.js';
import { createBody, stepBody, IN_RIGHT, IN_JUMP } from '../src/core/physics.js';
import { randomInputs, trajectory } from './helpers.js';
import level04 from '../src/levels/level04.json';
import level08 from '../src/levels/level08.json';
import level11 from '../src/levels/level11.json';

describe('deterministic physics', () => {
  it('same inputs always produce the same body movement', () => {
    const floor = [{ x: -1000, y: 480, w: 4000, h: 60 }, { x: 300, y: 420, w: 60, h: 60 }];
    const inputs = randomInputs(42, 600);
    const run = () => {
      const b = createBody(100, 480);
      const out = [];
      for (const bits of inputs) {
        stepBody(b, bits, floor, []);
        out.push(b.x, b.y, b.vx, b.vy);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('same inputs always produce the same world trajectory', () => {
    for (const raw of [level04, level08, level11]) {
      const level = loadLevel(raw);
      for (let seed = 1; seed <= 5; seed++) {
        const inputs = randomInputs(seed, level.frameLimit);
        const a = trajectory(level, [], inputs);
        const b = trajectory(level, [], inputs);
        expect(a.path).toEqual(b.path);
        expect(a.world.status).toBe(b.world.status);
      }
    }
  });

  it('jump height stays within the designed range (2.5 tiles, not 3)', () => {
    const floor = [{ x: -1000, y: 480, w: 4000, h: 60 }];
    const b = createBody(100, 480);
    stepBody(b, 0, floor, []);
    let minY = b.y;
    for (let i = 0; i < 40; i++) {
      stepBody(b, IN_JUMP | IN_RIGHT, floor, []);
      minY = Math.min(minY, b.y);
    }
    const rise = 480 - 28 - minY;
    expect(rise).toBeGreaterThan(60);
    expect(rise).toBeLessThan(90);
  });
});

describe('ghost replay', () => {
  it('a recorded round replays exactly as the ghost', () => {
    const level = loadLevel(level08);
    for (let seed = 10; seed < 16; seed++) {
      const inputs = randomInputs(seed, 400);
      const live = trajectory(level, [], inputs);
      const rec = Uint8Array.from(live.world.liveInputs);
      // új kör: a szellem az előző kör inputjait kapja, az élő játékos áll
      const next = trajectory(level, [rec], new Array(rec.length).fill(0));
      for (let f = 0; f < next.path.length; f++) {
        expect(next.path[f][0]).toEqual(live.path[f][0 + live.path[f].length - 1]);
      }
    }
  });

  it('stacked ghosts reproduce their own rounds (3 layers)', () => {
    const level = loadLevel(level04);
    const recs = [];
    const paths = [];
    for (let layer = 0; layer < 3; layer++) {
      const inputs = randomInputs(100 + layer, 300);
      const t = trajectory(level, recs.slice(), inputs);
      paths.push(t.path.map((p) => p[p.length - 1]));
      recs.push(Uint8Array.from(t.world.liveInputs));
    }
    // negyedik kör: mindhárom szellem ugyanazt teszi, mint élőként
    const final = trajectory(level, recs, new Array(300).fill(0));
    for (let g = 0; g < 3; g++) {
      for (let f = 0; f < paths[g].length; f++) {
        expect(final.path[f][g]).toEqual(paths[g][f]);
      }
    }
  });

  it('a ghost stays idle after its recording ends', () => {
    const level = loadLevel(level04);
    const rec = Uint8Array.from(new Array(60).fill(IN_RIGHT));
    const w = createWorld(level, [rec]);
    for (let i = 0; i < 200; i++) w.step(0);
    const g = w.ghosts[0];
    expect(g.vx).toBe(0);
    const x = g.x;
    w.step(0);
    expect(g.x).toBe(x);
  });

  it('inputAt returns 0 beyond the recording', () => {
    const rec = Uint8Array.from([1, 2, 4]);
    expect(inputAt(rec, 1)).toBe(2);
    expect(inputAt(rec, 3)).toBe(0);
  });

  it('simulateRound helper matches manual stepping', () => {
    const level = loadLevel(level04);
    const inputs = randomInputs(7, 200);
    const a = simulateRound(createWorld, level, [], inputs);
    const b = trajectory(level, [], inputs);
    expect(a.trail.map((t) => t.map((e) => [e[0], e[1]]))).toEqual(b.path.map((t) => t.map((e) => [e[0], e[1]])));
  });
});

describe('recording storage', () => {
  it('RLE encoding round-trips', () => {
    for (let seed = 1; seed < 20; seed++) {
      const rec = Uint8Array.from(randomInputs(seed, 500));
      expect(decodeRLE(encodeRLE(rec))).toEqual(rec);
    }
    expect(decodeRLE('')).toEqual(new Uint8Array(0));
  });

  it('RLE is compact for held keys', () => {
    const rec = Uint8Array.from(new Array(600).fill(IN_RIGHT));
    expect(encodeRLE(rec).length).toBeLessThan(10);
  });

  it('recorder snapshots are independent copies', () => {
    const r = new Recorder();
    r.push(1);
    r.push(2);
    const snap = r.snapshot();
    r.push(4);
    r.clear();
    expect(Array.from(snap)).toEqual([1, 2]);
    expect(r.length).toBe(0);
  });

  it('rejects malformed RLE', () => {
    expect(() => decodeRLE('x:y:z,??')).toThrow();
  });
});
