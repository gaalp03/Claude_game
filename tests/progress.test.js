import { describe, it, expect } from 'vitest';
import {
  medalTimes, medalFor, starMaskFor, countStars, recordStars, totalStars,
  SKINS, isSkinUnlocked, checkAchievements, ACHIEVEMENTS, STAR_CLEAR, STAR_PAR, STAR_TIME
} from '../src/core/progress.js';
import { defaultSave, loadSave } from '../src/core/save.js';
import { encodeTrack, decodeTrack } from '../src/core/replay.js';
import { LEVELS, CHAPTERS, MAX_STARS } from '../src/levels/index.js';
import { loadLevel } from '../src/core/level-loader.js';
import { createWorld } from '../src/core/world.js';

describe('medals and stars', () => {
  it('derives medal thresholds from the developer time', () => {
    const t = medalTimes(300);
    expect(t).toEqual({ dev: 300, gold: 378, silver: 480 });
    expect(t.gold % 6).toBe(0);
    expect(medalFor(300, 300)).toBe('dev');
    expect(medalFor(301, 300)).toBe('gold');
    expect(medalFor(378, 300)).toBe('gold');
    expect(medalFor(400, 300)).toBe('silver');
    expect(medalFor(900, 300)).toBe('bronze');
  });

  it('computes star masks', () => {
    expect(starMaskFor({ frames: 900, ghosts: 3 }, 1, 300)).toBe(STAR_CLEAR);
    expect(starMaskFor({ frames: 900, ghosts: 1 }, 1, 300)).toBe(STAR_CLEAR | STAR_PAR);
    expect(starMaskFor({ frames: 350, ghosts: 1 }, 1, 300)).toBe(STAR_CLEAR | STAR_PAR | STAR_TIME);
    expect(countStars(7)).toBe(3);
    expect(countStars(5)).toBe(2);
  });

  it('accumulates stars over runs and keeps the best medal', () => {
    const s = defaultSave();
    let r = recordStars(s, 'a', STAR_CLEAR | STAR_TIME, 'gold');
    expect(r.newStars).toBe(STAR_CLEAR | STAR_TIME);
    expect(r.medalUp).toBe(true);
    r = recordStars(s, 'a', STAR_CLEAR | STAR_PAR, 'bronze');
    expect(r.newStars).toBe(STAR_PAR);
    expect(r.medalUp).toBe(false);
    expect(s.levels.a).toMatchObject({ stars: 7, medal: 'gold' });
    expect(totalStars(s)).toBe(3);
  });

  it('every shipped level can earn all three stars with its own solution', () => {
    for (const l of LEVELS) {
      expect(starMaskFor({ frames: l.devFrames, ghosts: l.ghosts }, l.ghosts, l.devFrames)).toBe(7);
    }
    expect(MAX_STARS).toBe(72);
  });
});

describe('skins', () => {
  it('unlock by stars and the last one needs almost everything', () => {
    expect(SKINS[0].stars).toBe(0);
    for (let i = 1; i < SKINS.length; i++) expect(SKINS[i].stars).toBeGreaterThan(SKINS[i - 1].stars);
    expect(SKINS[SKINS.length - 1].stars).toBeLessThanOrEqual(MAX_STARS);
    expect(isSkinUnlocked(SKINS[1], SKINS[1].stars)).toBe(true);
    expect(isSkinUnlocked(SKINS[1], SKINS[1].stars - 1)).toBe(false);
  });
});

describe('achievements', () => {
  const ctx = (extra = {}) => ({ chapters: CHAPTERS.map((c) => c.ids), maxStars: MAX_STARS, ...extra });
  it('unlock once and are stored', () => {
    const s = defaultSave();
    expect(checkAchievements(s, ctx())).toEqual([]);
    s.levels.level01 = { done: true, stars: 1 };
    s.stats.ghosts = 1;
    const got = checkAchievements(s, ctx()).map((a) => a.id);
    expect(got).toEqual(expect.arrayContaining(['first_clear', 'first_ghost']));
    expect(checkAchievements(s, ctx())).toEqual([]);
    expect(s.achievements.first_clear).toBeGreaterThan(0);
  });
  it('clean loop needs a ghost level without deaths', () => {
    const s = defaultSave();
    expect(checkAchievements(s, ctx({ event: 'win', ghosts: 0, deathsThisLevel: 0 })).map((a) => a.id)).not.toContain('clean');
    expect(checkAchievements(s, ctx({ event: 'win', ghosts: 2, deathsThisLevel: 0 })).map((a) => a.id)).toContain('clean');
  });
  it('have unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it('old saves get the new fields', () => {
    const mem = new Map([['ghostloop.save.v1', JSON.stringify({ levels: { x: { done: true } }, settings: { muted: true } })]]);
    const s = loadSave({ getItem: (k) => mem.get(k) ?? null, setItem: () => {} });
    expect(s.settings).toMatchObject({ muted: true, music: true, skin: 'neon' });
    expect(s.stats.deaths).toBe(0);
    expect(s.achievements).toEqual({});
  });
});

describe('PB track encoding', () => {
  it('round-trips rounded positions', () => {
    const pts = [];
    for (let i = 0; i < 300; i++) pts.push(60 + i * 3.3, 452 - Math.abs(Math.sin(i / 9)) * 70);
    const back = decodeTrack(encodeTrack(pts));
    expect(back.length).toBe(pts.length);
    for (let i = 0; i < pts.length; i++) expect(Math.abs(back[i] - pts[i])).toBeLessThanOrEqual(0.5);
    expect(decodeTrack('')).toEqual([]);
    expect(decodeTrack('zz!! ??')).toEqual([]);
  });
});

describe('movers with end pauses', () => {
  it('rest at both ends for the given time', () => {
    const level = loadLevel({
      id: 'p', name: 'p', timeLimit: 20, spawn: { x: 2, y: 16 }, goal: { x: 30, y: 16 },
      platforms: [{ x: 0, y: 16, w: 32, h: 2 }],
      movers: [{ id: 'm', x: 10, y: 10, w: 2, h: 0.5, to: { x: 16, y: 10 }, speed: 6, pause: 0.5 }]
    });
    const w = createWorld(level, []);
    const xs = [];
    for (let i = 0; i < 200; i++) {
      w.step(0);
      xs.push(w.movers[0].x);
    }
    // 6 egység 6 egység/s-mal = 60 lépés, majd 30 lépés állás a végén
    expect(xs[59]).toBeCloseTo(16 * 30);
    expect(xs[80]).toBeCloseTo(16 * 30);
    expect(xs[95]).toBeLessThan(16 * 30);
    expect(xs[149]).toBeCloseTo(10 * 30);
    expect(xs[170]).toBeCloseTo(10 * 30);
  });
});
