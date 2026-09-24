import { describe, it, expect } from 'vitest';
import { loadSave, writeSave, recordLevel, recordDaily, currentStreak, defaultSave, SAVE_KEY } from '../src/core/save.js';
import { shareText, outcomeRow } from '../src/core/share.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

describe('save', () => {
  it('round-trips through storage', () => {
    const s = memStorage();
    const d = loadSave(s);
    recordLevel(d, 'level01', 300, 0, 2);
    d.settings.muted = true;
    writeSave(d, s);
    const e = loadSave(s);
    expect(e.levels.level01).toMatchObject({ done: true, bestFrames: 300, fewestGhosts: 0 });
    expect(e.settings.muted).toBe(true);
  });

  it('survives corrupt data', () => {
    const s = memStorage();
    s.setItem(SAVE_KEY, '{nope');
    expect(loadSave(s)).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });

  it('keeps best time and fewest ghosts separately', () => {
    const d = defaultSave();
    expect(recordLevel(d, 'x', 500, 2, 5)).toEqual({ firstClear: true, newTime: true, newGhosts: true });
    expect(recordLevel(d, 'x', 400, 3, 5)).toEqual({ firstClear: false, newTime: true, newGhosts: false });
    expect(recordLevel(d, 'x', 450, 1, 5)).toEqual({ firstClear: false, newTime: false, newGhosts: true });
    expect(d.levels.x).toMatchObject({ bestFrames: 400, fewestGhosts: 1 });
  });

  it('tracks the daily streak', () => {
    const d = defaultSave();
    const r = { attempts: 3, ghosts: 1, frames: 400, outcomes: ['ghost', 'win'] };
    expect(recordDaily(d, '2026-03-01', r).streak).toBe(1);
    expect(recordDaily(d, '2026-03-02', r).streak).toBe(2);
    expect(recordDaily(d, '2026-03-02', r)).toEqual({ first: false, streak: 2 });
    expect(recordDaily(d, '2026-03-03', r).streak).toBe(3);
    expect(currentStreak(d, '2026-03-04')).toBe(3);
    expect(currentStreak(d, '2026-03-06')).toBe(0);
    expect(recordDaily(d, '2026-03-06', r).streak).toBe(1);
    expect(d.daily.best).toBe(3);
    // hónapváltás
    const e = defaultSave();
    recordDaily(e, '2026-02-28', r);
    expect(recordDaily(e, '2026-03-01', r).streak).toBe(2);
  });
});

describe('share text', () => {
  it('builds a wordle-like result', () => {
    const t = shareText({ number: 267, attempts: 4, ghosts: 2, frames: 385, outcomes: ['ghost', 'death', 'ghost', 'win'], streak: 3 });
    expect(t).toBe('GHOST LOOP · Daily #267\n🟪🟥🟪🟩\n🔁 4 attempts · 👻 2 ghosts · ⏱️ 6.42s\n🔥 3-day streak');
  });
  it('truncates long rows', () => {
    const row = outcomeRow(new Array(30).fill('death').concat(['win']));
    expect(row.startsWith('+16')).toBe(true);
    expect(row.endsWith('🟩')).toBe(true);
  });
});
