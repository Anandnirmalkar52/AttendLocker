// Pure attendance math. No UI or database code here so it is easy to test.
export interface Totals { attended: number; conducted: number }

export const pct = (t: Totals): number =>
  t.conducted > 0 ? (t.attended / t.conducted) * 100 : 0;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function isValidTotals(t: Totals): boolean {
  return Number.isInteger(t.attended) && Number.isInteger(t.conducted) &&
    t.attended >= 0 && t.conducted >= 0 && t.attended <= t.conducted;
}

export const missed = (t: Totals) => t.conducted - t.attended;

/** Add future classes. `attend` come out as present, `miss` as absent. */
export function project(t: Totals, attend: number, miss: number): Totals {
  return { attended: t.attended + attend, conducted: t.conducted + attend + miss };
}

export interface Impact {
  before: Totals; after: Totals;
  beforePct: number; afterPct: number;
  pointsChange: number;          // percentage points (after - before)
  relativeChange: number | null; // % change relative to the old percentage
}

export function impact(before: Totals, attend: number, miss: number): Impact {
  const after = project(before, attend, miss);
  const b = pct(before), a = pct(after);
  return {
    before, after, beforePct: b, afterPct: a,
    pointsChange: a - b,
    relativeChange: b > 0 ? ((a - b) / b) * 100 : null,
  };
}

/** Target in percent (0-100]. Returns null when input is invalid. */
export function normalizeTarget(targetPct: number): number | null {
  if (!Number.isFinite(targetPct) || targetPct <= 0 || targetPct > 100) return null;
  return targetPct / 100;
}

/** Most classes you can miss in a row and still be >= target. */
export function maxConsecutiveMisses(t: Totals, targetPct: number): number | null {
  const T = normalizeTarget(targetPct);
  if (T === null || t.conducted === 0) return null;
  // A/(N+x) >= T  =>  x <= A/T - N. Epsilon guards float error.
  const x = Math.floor(t.attended / T - t.conducted + 1e-9);
  return x < 0 ? 0 : x;
}

/** Consecutive classes to attend to reach the target. 0 if already there, null if impossible. */
export function minConsecutiveAttends(t: Totals, targetPct: number): number | null {
  const T = normalizeTarget(targetPct);
  if (T === null || t.conducted === 0) return null;
  if (pct(t) >= targetPct - 1e-9) return 0;
  if (T >= 1) return null; // 100% can never be reached once a class is missed
  return Math.ceil((T * t.conducted - t.attended) / (1 - T) - 1e-9);
}

export type Status = 'excellent' | 'safe' | 'warning' | 'danger' | 'none';

export function statusFor(t: Totals, targetPct: number): Status {
  if (t.conducted === 0) return 'none';
  const p = pct(t);
  if (p < targetPct) return 'danger';
  const spare = maxConsecutiveMisses(t, targetPct) ?? 0;
  if (spare <= 2) return 'warning';
  return p >= 90 ? 'excellent' : 'safe';
}

export const ATTEND_STEPS = [5, 10, 15, 20];
export const MISS_STEPS = [1, 2, 3, 5, 10];
