import assert from 'node:assert/strict';
import * as c from '../src/lib/calc.ts';
const base = { attended: 119, conducted: 126 };
const r = (n: number) => c.round2(n);
assert.equal(r(c.pct(base)), 94.44);
for (const [m, p, d] of [[1, 93.70, -0.74], [5, 90.84, -3.60], [10, 87.50, -6.94]] as const) {
  const i = c.impact(base, 0, m);
  assert.equal(r(i.afterPct), p); assert.equal(r(i.pointsChange), d);
}
assert.equal(r(c.impact(base, 0, 1).relativeChange!), -0.79);
assert.equal(c.maxConsecutiveMisses(base, 75), 32);
assert.equal(c.maxConsecutiveMisses(base, 90), 6);
assert.equal(c.maxConsecutiveMisses(base, 100), 0);
assert.equal(c.maxConsecutiveMisses({ attended: 50, conducted: 100 }, 75), 0);
assert.equal(c.maxConsecutiveMisses({ attended: 0, conducted: 0 }, 75), null);
assert.equal(c.maxConsecutiveMisses(base, 0), null);
assert.equal(c.maxConsecutiveMisses(base, 101), null);
assert.equal(c.minConsecutiveAttends(base, 75), 0);
assert.equal(c.minConsecutiveAttends({ attended: 60, conducted: 100 }, 75), 60);
assert.equal(c.minConsecutiveAttends({ attended: 60, conducted: 100 }, 100), null);
const t = { attended: 7, conducted: 12 }; const n = c.minConsecutiveAttends(t, 80)!;
assert.ok(c.pct(c.project(t, n, 0)) >= 80 && c.pct(c.project(t, n - 1, 0)) < 80);
const x = c.maxConsecutiveMisses(base, 85)!;
assert.ok(c.pct(c.project(base, 0, x)) >= 85 && c.pct(c.project(base, 0, x + 1)) < 85);
assert.equal(c.isValidTotals({ attended: 5, conducted: 4 }), false);
assert.equal(c.isValidTotals({ attended: 1.5, conducted: 4 }), false);
console.log('calc tests passed');
