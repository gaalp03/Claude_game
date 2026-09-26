// Előrehaladás-rendszer: érmek és csillagok, feloldható kinézetek, achievementek.
// Tiszta (Phaser-független) logika, tesztelhető.

// ---------------------------------------------------------------- érmek, csillagok

export const MEDALS = ['none', 'bronze', 'silver', 'gold', 'dev'];
export const MEDAL_INFO = {
  bronze: { name: 'Bronze', color: 0xd08a4f },
  silver: { name: 'Silver', color: 0xc9d3ea },
  gold: { name: 'Gold', color: 0xffd23f },
  dev: { name: 'Beat the Dev', color: 0x6ff7ff }
};

/** 0,1 mp-re (6 képkockára) felfelé kerekítés, hogy a kiírt határidő pontos legyen */
const roundUp6 = (f) => Math.ceil(f / 6) * 6;

/**
 * Időhatárok a fejlesztői (ellenőrző bot) idő alapján.
 * Az arany ~25%, az ezüst ~60% ráhagyást ad az emberi játékosnak.
 */
export function medalTimes(devFrames) {
  return { dev: devFrames, gold: roundUp6(devFrames * 1.25), silver: roundUp6(devFrames * 1.6) };
}

export function medalFor(frames, devFrames) {
  const t = medalTimes(devFrames);
  if (frames <= t.dev) return 'dev';
  if (frames <= t.gold) return 'gold';
  if (frames <= t.silver) return 'silver';
  return 'bronze';
}

export const medalRank = (m) => Math.max(0, MEDALS.indexOf(m || 'none'));

// csillag-bitek: 1 = teljesítve, 2 = par szellemszámon belül, 4 = arany idő
export const STAR_CLEAR = 1;
export const STAR_PAR = 2;
export const STAR_TIME = 4;

export function starMaskFor({ frames, ghosts }, par, devFrames) {
  let m = STAR_CLEAR;
  if (ghosts <= par) m |= STAR_PAR;
  if (frames <= medalTimes(devFrames).gold) m |= STAR_TIME;
  return m;
}

export const countStars = (mask) => ((mask & 1) ? 1 : 0) + ((mask & 2) ? 1 : 0) + ((mask & 4) ? 1 : 0);

/** Összes csillag a mentésből */
export function totalStars(save) {
  let n = 0;
  for (const id of Object.keys(save.levels)) n += countStars(save.levels[id].stars || 0);
  return n;
}

export function countMedals(save, medal) {
  return Object.values(save.levels).filter((l) => l.medal === medal).length;
}

/**
 * Egy teljesítés beírása: a csillagok összeadódnak (több futásból is gyűjthetők),
 * az érem a legjobb marad. Visszaadja az újonnan szerzett csillagokat és érmet.
 */
export function recordStars(save, id, mask, medal) {
  const entry = save.levels[id] || (save.levels[id] = { done: true });
  const prevMask = entry.stars || 0;
  const prevMedal = entry.medal || 'none';
  entry.stars = prevMask | mask;
  const medalUp = medalRank(medal) > medalRank(prevMedal);
  if (medalUp) entry.medal = medal;
  return { newStars: entry.stars & ~prevMask, medalUp, medal: entry.medal };
}

// ---------------------------------------------------------------- kinézetek

export const SKINS = [
  { id: 'neon', name: 'Neon', color: 0x00f0ff, stars: 0 },
  { id: 'acid', name: 'Acid', color: 0x9dff3a, stars: 6 },
  { id: 'flamingo', name: 'Flamingo', color: 0xff5fd2, stars: 14 },
  { id: 'ember', name: 'Ember', color: 0xff8a3d, stars: 24 },
  { id: 'gold', name: 'Gold', color: 0xffd23f, stars: 36 },
  { id: 'frost', name: 'Frost', color: 0xeaf6ff, stars: 50 },
  { id: 'prism', name: 'Prism', color: 'prism', stars: 66 }
];

export function skinById(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export const isSkinUnlocked = (skin, stars) => stars >= skin.stars;

// ---------------------------------------------------------------- achievementek

/**
 * Minden achievement egy feltétel a mentés (+ az épp történt esemény) alapján.
 * ctx: { event, levelId, ghosts, deathsThisLevel, medal, chapterIds }
 */
export const ACHIEVEMENTS = [
  { id: 'first_clear', name: 'Closed Loop', desc: 'Finish your first level', test: (s) => doneCount(s) >= 1 },
  { id: 'first_ghost', name: 'Echo', desc: 'Record your first ghost', test: (s) => s.stats.ghosts >= 1 },
  { id: 'tower', name: 'Tower of Me', desc: 'Stack ghosts to finish "Tower"', test: (s) => !!s.levels.level08?.done },
  { id: 'chapter1', name: 'First Loops', desc: 'Finish every Chapter 1 level', test: (s, c) => c.chapters[0].every((id) => s.levels[id]?.done) },
  { id: 'chapter2', name: 'Paradox', desc: 'Finish every Chapter 2 level', test: (s, c) => c.chapters[1].length > 0 && c.chapters[1].every((id) => s.levels[id]?.done) },
  { id: 'stars20', name: 'Stargazer', desc: 'Collect 20 stars', test: (s) => totalStars(s) >= 20 },
  { id: 'stars_all', name: 'Perfectionist', desc: 'Collect every star', test: (s, c) => totalStars(s) >= c.maxStars },
  { id: 'gold5', name: 'Golden', desc: 'Earn 5 gold medals or better', test: (s) => countMedals(s, 'gold') + countMedals(s, 'dev') >= 5 },
  { id: 'dev1', name: 'Beat the Dev', desc: 'Beat a developer time', test: (s) => countMedals(s, 'dev') >= 1 },
  { id: 'dev10', name: 'Speed Demon', desc: 'Beat 10 developer times', test: (s) => countMedals(s, 'dev') >= 10 },
  { id: 'clean', name: 'Clean Loop', desc: 'Finish a ghost level without dying', test: (s, c) => c.event === 'win' && c.ghosts > 0 && c.deathsThisLevel === 0 },
  { id: 'daily1', name: 'Daily Looper', desc: 'Finish a Daily Loop', test: (s) => Object.keys(s.daily.history).length >= 1 },
  { id: 'streak3', name: 'Habit', desc: 'Reach a 3-day daily streak', test: (s) => s.daily.best >= 3 },
  { id: 'streak7', name: 'Ritual', desc: 'Reach a 7-day daily streak', test: (s) => s.daily.best >= 7 },
  { id: 'ghosts100', name: 'Crowded Timeline', desc: 'Record 100 ghosts', test: (s) => s.stats.ghosts >= 100 },
  { id: 'deaths100', name: 'Persistence', desc: 'Fall 100 times and keep going', test: (s) => s.stats.deaths >= 100 }
];

function doneCount(s) {
  return Object.values(s.levels).filter((l) => l.done).length;
}

/**
 * Új achievementek ellenőrzése és rögzítése.
 * @returns a most feloldott achievementek listája
 */
export function checkAchievements(save, ctx) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) continue;
    let ok = false;
    try {
      ok = a.test(save, ctx);
    } catch {
      ok = false;
    }
    if (ok) {
      save.achievements[a.id] = Date.now();
      got.push(a);
    }
  }
  return got;
}
