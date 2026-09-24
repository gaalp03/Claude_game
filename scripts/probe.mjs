// Fizikai mérések: ugrásmagasság, távolság
import { createBody, stepBody, IN_RIGHT, IN_JUMP, TILE } from '../src/core/physics.js';
const floor = [{ x: -1000, y: 480, w: 5000, h: 60 }];
function run(seq) {
  const b = createBody(100, 480);
  // talajra érkezés
  stepBody(b, 0, floor, []);
  let minY = b.y, frames = 0, startX = b.x;
  for (const bits of seq) { stepBody(b, bits, floor, []); frames++; minY = Math.min(minY, b.y); }
  return { rise: 452 - minY, dist: (b.x - startX) / TILE, grounded: b.grounded };
}
console.log('standing jump', run(Array(40).fill(IN_JUMP)));
console.log('standing jump right', run(Array(40).fill(IN_JUMP | IN_RIGHT)));
const runup = Array(30).fill(IN_RIGHT).concat(Array(40).fill(IN_JUMP | IN_RIGHT));
console.log('running jump', run(runup));
