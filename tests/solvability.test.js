import { describe, it, expect } from 'vitest';
import { LEVELS, RAW_LEVELS } from '../src/levels/index.js';
import { runSolution } from '../src/core/solver.js';
import { generateDaily, buildCandidate, verifyRaw, TEMPLATE_TAGS, dailyNumber, dateKey } from '../src/core/daily.js';
import { loadLevel } from '../src/core/level-loader.js';
import { hashString } from '../src/core/rng.js';
import { findTrivialWin } from './helpers.js';

describe('hand-made levels are solvable', () => {
  for (const level of LEVELS) {
    it(`${level.id} "${level.name}" can be solved with ${level.ghosts} ghost(s)`, () => {
      const res = runSolution(level, level.solution);
      expect(res.reason).toBeUndefined();
      expect(res.ok).toBe(true);
      expect(res.ghosts.length).toBe(level.ghosts);
      expect(res.frames).toBeLessThan(level.frameLimit);
    });
  }
});

describe('ghost levels actually need ghosts', () => {
  for (const level of LEVELS.filter((l) => l.ghosts > 0)) {
    it(`${level.id}: final route fails without ghosts`, () => {
      const res = runSolution(level, [level.solution[level.solution.length - 1]]);
      expect(res.ok).toBe(false);
    });
    it(`${level.id}: no run-and-jump shortcut`, () => {
      expect(findTrivialWin(level)).toBeNull();
    });
  }
});

describe('daily loop generator', () => {
  const pool = RAW_LEVELS.filter((r) => r.ghosts > 0);

  it('produces a verified level for every day of a year', () => {
    let fallbacks = 0;
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 366; i++) {
      const key = new Date(start + i * 86400000).toISOString().slice(0, 10);
      const g = generateDaily(key, pool);
      if (g.fallback) fallbacks++;
      const level = loadLevel(g.raw);
      const res = runSolution(level, g.raw.solution);
      expect(res.ok, `${key}: ${res.reason}`).toBe(true);
      expect(res.ghosts.length).toBe(g.raw.ghosts);
      expect(level.timeLimit).toBeGreaterThanOrEqual(8);
      expect(level.timeLimit).toBeLessThanOrEqual(15);
    }
    expect(fallbacks).toBe(0);
  }, 30000);

  it('is deterministic per date and varies across dates', () => {
    const a = generateDaily('2026-09-24', pool);
    const b = generateDaily('2026-09-24', pool);
    expect(JSON.stringify(a.raw)).toBe(JSON.stringify(b.raw));
    const keys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
    const distinct = new Set(keys.map((k) => JSON.stringify(generateDaily(k, pool).raw.platforms)));
    expect(distinct.size).toBeGreaterThan(3);
  });

  it('every template can produce solvable levels', () => {
    for (const tag of TEMPLATE_TAGS) {
      let ok = 0;
      for (let i = 0; i < 20; i++) if (verifyRaw(buildCandidate(hashString(`t:${tag}:${i}`), tag).raw).ok) ok++;
      expect(ok, tag).toBeGreaterThan(10);
    }
  });

  it('generated ghost puzzles have no run-and-jump shortcut', () => {
    const start = Date.UTC(2026, 5, 1);
    for (let i = 0; i < 40; i++) {
      const key = new Date(start + i * 86400000).toISOString().slice(0, 10);
      const level = loadLevel(generateDaily(key, pool).raw);
      expect(findTrivialWin(level, 6), key).toBeNull();
    }
  }, 30000);

  it('numbers days from the epoch', () => {
    expect(dailyNumber('2026-01-01')).toBe(1);
    expect(dailyNumber('2026-01-31')).toBe(31);
    expect(dailyNumber('2027-01-01')).toBe(366);
    expect(dateKey(new Date(2026, 8, 24))).toBe('2026-09-24');
  });
});

describe('shortcut finder sanity', () => {
  it('finds a win on an easy level (so a null result means something)', () => {
    const level = loadLevel({
      id: 'easy',
      name: 'Easy',
      timeLimit: 10,
      spawn: { x: 2, y: 16 },
      goal: { x: 20, y: 16 },
      platforms: [{ x: 0, y: 16, w: 32, h: 2 }, { x: 10, y: 14, w: 1, h: 2 }]
    });
    expect(findTrivialWin(level)).not.toBeNull();
  });
});

describe('solution replay', () => {
  it('final inputs + solution ghosts reproduce the win exactly', async () => {
    const { createWorld } = await import('../src/core/world.js');
    for (const level of LEVELS) {
      const res = runSolution(level, level.solution);
      const w = createWorld(level, res.ghosts);
      for (let f = 0; f < res.finalInputs.length && w.status === 'playing'; f++) w.step(res.finalInputs[f]);
      expect(w.status, level.id).toBe('won');
      expect(w.frame).toBe(res.frames);
    }
  });
});
