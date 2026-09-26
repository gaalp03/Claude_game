import { describe, it, expect } from 'vitest';
import { loadLevel, LevelError } from '../src/core/level-loader.js';
import { RAW_LEVELS, LEVELS, CHAPTERS } from '../src/levels/index.js';
import { TILE } from '../src/core/physics.js';

const minimal = () => ({
  id: 't',
  name: 'Test',
  timeLimit: 10,
  spawn: { x: 2, y: 16 },
  goal: { x: 20, y: 16 },
  platforms: [{ x: 0, y: 16, w: 32, h: 2 }]
});

describe('level loader', () => {
  it('loads all shipped levels', () => {
    expect(RAW_LEVELS.length).toBeGreaterThanOrEqual(12);
    expect(LEVELS.length).toBe(RAW_LEVELS.length);
    const ids = new Set(LEVELS.map((l) => l.id));
    expect(ids.size).toBe(LEVELS.length);
  });

  it('levels follow the difficulty curve', () => {
    const g = LEVELS.map((l) => l.ghosts);
    expect(g.slice(0, 3)).toEqual([0, 0, 0]);
    expect(g.slice(3, 6)).toEqual([1, 1, 1]);
    for (const n of g.slice(6, 12)) expect(n).toBeGreaterThanOrEqual(2);
    expect(Math.max(...g.slice(0, 12))).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < 12; i++) expect(g[i]).toBeGreaterThanOrEqual(g[i - 1]);
    // 2. fejezet: minden pálya szellemes, és a vége a legnehezebb
    expect(LEVELS.length).toBe(24);
    for (const n of g.slice(12)) expect(n).toBeGreaterThanOrEqual(1);
    expect(g[23]).toBe(3);
  });

  it('every level has a developer time and belongs to a chapter', () => {
    for (const l of LEVELS) {
      expect(l.devFrames).toBeGreaterThan(60);
      expect(l.devFrames).toBeLessThan(l.frameLimit);
    }
    expect(CHAPTERS.map((c) => c.ids.length)).toEqual([12, 12]);
  });

  it('time limits are 8-15 seconds', () => {
    for (const l of LEVELS) {
      expect(l.timeLimit).toBeGreaterThanOrEqual(8);
      expect(l.timeLimit).toBeLessThanOrEqual(15);
      expect(l.frameLimit).toBe(l.timeLimit * 60);
    }
  });

  it('converts tile units to pixels and adds border walls', () => {
    const l = loadLevel(minimal());
    expect(l.width).toBe(32 * TILE);
    expect(l.height).toBe(18 * TILE);
    expect(l.spawn).toEqual({ x: 2 * TILE, y: 16 * TILE });
    expect(l.solids[0]).toEqual({ x: 0, y: 16 * TILE, w: 32 * TILE, h: 2 * TILE });
    expect(l.solids.filter((s) => s.border).length).toBe(2);
    expect(l.ghosts).toBe(0);
  });

  it('parses buttons, doors and movers', () => {
    const raw = {
      ...minimal(),
      buttons: [{ id: 'b1', x: 5, y: 16 }],
      doors: [{ id: 'd1', x: 10, y: 11, w: 1, h: 5, button: 'b1' }],
      movers: [{ id: 'm1', x: 12, y: 16, w: 3, h: 0.5, to: { x: 12, y: 8 }, speed: 3, buttons: ['b1'] }],
      hazards: [{ x: 15, y: 10, w: 1, h: 1, to: { x: 15, y: 14 }, speed: 2 }]
    };
    const l = loadLevel(raw);
    expect(l.buttons[0]).toMatchObject({ id: 'b1', x: 150, w: 30 });
    expect(l.doors[0]).toMatchObject({ id: 'd1', buttons: ['b1'], mode: 'any', invert: false });
    expect(l.movers[0].to).toEqual({ x: 360, y: 240 });
    expect(l.movers[0].speed).toBeCloseTo(1.5);
    expect(l.hazards[0].kind).toBe('block');
  });

  const bad = [
    ['missing id', (r) => delete r.id],
    ['missing spawn', (r) => delete r.spawn],
    ['bad time limit', (r) => (r.timeLimit = 0)],
    ['unknown button', (r) => (r.doors = [{ id: 'd', x: 1, y: 1, w: 1, h: 1, button: 'nope' }])],
    ['duplicate ids', (r) => (r.buttons = [{ id: 'a', x: 1, y: 16 }, { id: 'a', x: 3, y: 16 }])],
    ['spawn in wall', (r) => r.platforms.push({ x: 1, y: 14, w: 2, h: 2 })],
    ['goal outside', (r) => (r.goal = { x: 40, y: 16 })],
    ['negative size rect', (r) => r.platforms.push({ x: 1, y: 1, w: -1, h: 1 })],
    ['too many ghosts', (r) => (r.ghosts = 9)],
    ['bad solution', (r) => (r.solution = ['R10'])]
  ];
  for (const [label, mutate] of bad) {
    it(`rejects: ${label}`, () => {
      const r = minimal();
      mutate(r);
      expect(() => loadLevel(r)).toThrow(LevelError);
    });
  }
});
