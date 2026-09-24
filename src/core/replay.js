// Input-rögzítés és visszajátszás. Egy kör = képkockánként egy input-bájt.
// A szellem ugyanazokat a bájtokat kapja ugyanazzal a fizikával, ezért pontosan
// ugyanazt a mozgást végzi (amíg az élő játékos nem változtat a közös világon).

/** Az adott képkocka inputja; a felvétel vége után a szellem tétlen marad. */
export function inputAt(rec, frame) {
  return frame < rec.length ? rec[frame] : 0;
}

/** Egy kör felvevője: az élő inputokat gyűjti. */
export class Recorder {
  constructor() {
    this.inputs = [];
  }
  push(bits) {
    this.inputs.push(bits & 0xff);
  }
  get length() {
    return this.inputs.length;
  }
  /** Lezárt, módosíthatatlan másolat szellemnek */
  snapshot() {
    return Uint8Array.from(this.inputs);
  }
  clear() {
    this.inputs.length = 0;
  }
}

/** Futáshossz-kódolás tömör tároláshoz: "bits:count,bits:count,..." */
export function encodeRLE(rec) {
  const out = [];
  let i = 0;
  while (i < rec.length) {
    const v = rec[i];
    let n = 1;
    while (i + n < rec.length && rec[i + n] === v) n++;
    out.push(`${v.toString(36)}:${n.toString(36)}`);
    i += n;
  }
  return out.join(',');
}

export function decodeRLE(str) {
  if (!str) return new Uint8Array(0);
  const parts = str.split(',');
  const arr = [];
  for (const p of parts) {
    const [v, n] = p.split(':').map((s) => parseInt(s, 36));
    if (!Number.isInteger(v) || !Number.isInteger(n) || n < 0) throw new Error(`bad RLE chunk "${p}"`);
    for (let k = 0; k < n; k++) arr.push(v);
  }
  return Uint8Array.from(arr);
}

/**
 * Egy kör lejátszása előre adott inputokkal; visszaadja a játékos pályáját.
 * Tesztekhez és hibakereséshez: ugyanaz az input → ugyanaz a trajektória.
 */
export function simulateRound(createWorld, level, recordings, inputs) {
  const world = createWorld(level, recordings);
  const trail = [];
  for (let f = 0; f < inputs.length && world.status === 'playing'; f++) {
    world.step(inputs[f]);
    trail.push(world.entities.map((e) => [e.x, e.y, e.alive ? 1 : 0]));
  }
  return { world, trail };
}
