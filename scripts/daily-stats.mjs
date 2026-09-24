// Napi generátor statisztika: hány nap ad igazolt pályát, sablononként hibaokok.
import { buildCandidate, verifyRaw, generateDaily, TEMPLATE_TAGS } from '../src/core/daily.js';
import { hashString } from '../src/core/rng.js';
const fails = {};
const totals = {};
for (const tag of TEMPLATE_TAGS) {
  totals[tag] = 0; fails[tag] = [];
  for (let i = 0; i < 300; i++) {
    const { raw } = buildCandidate(hashString(`probe:${tag}:${i}`), tag);
    const v = verifyRaw(raw);
    totals[tag]++;
    if (!v.ok) fails[tag].push(v.reason);
  }
}
for (const tag of TEMPLATE_TAGS) {
  console.log(tag, `fail ${fails[tag].length}/${totals[tag]}`);
  const counts = {};
  for (const r of fails[tag]) { const k = r.replace(/[\d.]+/g, '#'); counts[k] = (counts[k] || 0) + 1; }
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([k, n]) => console.log('   ', n, k));
}
let fb = 0; const t0 = Date.now(); const tags = {};
const d = new Date(Date.UTC(2026, 0, 1));
for (let i = 0; i < 400; i++) {
  const day = new Date(d.getTime() + i * 86400000);
  const key = day.toISOString().slice(0, 10);
  const g = generateDaily(key, [{}]);
  if (g.fallback) fb++;
  tags[g.tag] = (tags[g.tag] || 0) + 1;
}
console.log('400 days, fallback:', fb, 'ms:', Date.now() - t0, tags);
