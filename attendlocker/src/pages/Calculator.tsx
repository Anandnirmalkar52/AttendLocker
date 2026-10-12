import { useMemo, useState } from 'react';
import { useData, today } from '../lib/data';
import { ATTEND_STEPS, MISS_STEPS, impact, maxConsecutiveMisses, minConsecutiveAttends, pct, project, round2, statusFor, type Totals } from '../lib/calc';
import { Badge, Field } from '../components/ui';

const fmt = (n: number) => round2(n).toFixed(2);
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const PRESETS = [65, 70, 75, 80, 85, 90];

export default function Calculator() {
  const d = useData();
  const [scope, setScope] = useState('all');
  const [miss, setMiss] = useState('1'); const [att, setAtt] = useState('0'); const [expected, setExpected] = useState('');
  const [date, setDate] = useState(today());
  const [custom, setCustom] = useState(''); const [targetSel, setTargetSel] = useState<number | 'custom'>(d.prefs?.target_pct ?? 75);
  const [msg, setMsg] = useState<string | null>(null);

  const active = d.subjects.filter(s => s.semester_id === d.semester?.id && !s.archived);
  // Overall always uses the combined totals; a chosen subject only decides where a recording goes.
  const subj = scope === 'all' ? null : active.find(s => s.id === scope) ?? null;
  const base: Totals = d.overall;
  const subjBase: Totals | null = subj ? d.subjectTotals(subj.id) : null;

  const m = num(miss), a = num(att), e = num(expected);
  const err = useMemo(() => {
    if (![m, a].every(x => Number.isInteger(x) && x >= 0 && x <= 1000)) return 'Enter whole numbers from 0 to 1000.';
    if (!Number.isNaN(e) && (!Number.isInteger(e) || e < m + a)) return 'Expected classes must be a whole number and at least misses + attended.';
    return null;
  }, [m, a, e]);
  const missN = err ? 0 : m, attN = err ? 0 : a;
  const o = impact(base, attN, missN);
  const so = subjBase ? impact(subjBase, attN, missN) : null;

  const T = targetSel === 'custom' ? num(custom) : targetSel;
  const tOk = Number.isFinite(T) && T > 0 && T <= 100;
  const canMiss = tOk ? maxConsecutiveMisses(base, T) : null;
  const mustAttend = tOk ? minConsecutiveAttends(base, T) : null;

  async function record() {
    if (!subj || err || missN + attN === 0) return;
    const items = [
      ...Array.from({ length: missN }, () => ({ subjectId: subj.id, status: 'absent' as const, date })),
      ...Array.from({ length: attN }, () => ({ subjectId: subj.id, status: 'present' as const, date })),
    ];
    if (await d.markMany(items)) setMsg(`Recorded ${missN} absence(s) and ${attN} present class(es) for ${subj.name} on ${date}.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Calculator</h1>
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Absence simulator</h2>
        <Field label="Subject">{id => (
          <select id={id} className="input" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="all">All subjects (overall only)</option>
            {active.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>)}</Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Will miss">{id => <input id={id} inputMode="numeric" className="input" value={miss} onChange={e => setMiss(e.target.value)} />}</Field>
          <Field label="Will attend">{id => <input id={id} inputMode="numeric" className="input" value={att} onChange={e => setAtt(e.target.value)} />}</Field>
          <Field label="Expected total" hint="Optional">{id => <input id={id} inputMode="numeric" className="input" value={expected} onChange={e => setExpected(e.target.value)} />}</Field>
        </div>
        {err && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{err}</p>}
        {!err && !Number.isNaN(e) && e > m + a && <p className="text-xs text-slate-500">{e - m - a} of the expected classes are not counted yet. Add them to Will attend or Will miss.</p>}
        <div className="rounded-xl bg-brand-50 p-3 text-sm dark:bg-slate-800" aria-live="polite">
          <p className="font-semibold">Overall preview</p>
          <p>{o.before.attended}/{o.before.conducted} ({fmt(o.beforePct)}%) → {o.after.attended}/{o.after.conducted} (<b>{fmt(o.afterPct)}%</b>)</p>
          <p>Change: {sign(o.pointsChange)} percentage points; {o.relativeChange === null ? '—' : sign(o.relativeChange)}% relative to your current percentage.</p>
          {so && subjBase && <p className="mt-2">{subj!.name}: {fmt(so.beforePct)}% → <b>{fmt(so.afterPct)}%</b> ({sign(so.pointsChange)} points)</p>}
        </div>
        <p className="text-xs text-slate-500">This is a preview only. Nothing is saved until you confirm.</p>
        <Field label="Date for the recorded classes">{id => <input id={id} type="date" min={d.semester?.start_date} className="input" value={date} onChange={e => setDate(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={() => setMsg('Simulation only. No changes were saved.')}>Simulate only</button>
          <button className="btn-primary" disabled={!subj || !!err || missN + attN === 0} onClick={record}>Confirm and record</button>
        </div>
        {!subj && <p className="text-xs text-slate-500">To record, pick a subject. Overall-only mode is for what-if checks.</p>}
        {msg && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Target calculator (overall)</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Target attendance">
          {PRESETS.map(p => <button key={p} aria-pressed={targetSel === p} className={targetSel === p ? 'btn-primary' : 'btn-ghost'} onClick={() => setTargetSel(p)}>{p}%</button>)}
          <button aria-pressed={targetSel === 'custom'} className={targetSel === 'custom' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTargetSel('custom')}>Custom</button>
        </div>
        {targetSel === 'custom' && <Field label="Custom target (%)" hint="Greater than 0 and up to 100.">{id => <input id={id} inputMode="decimal" className="input" value={custom} onChange={e => setCustom(e.target.value)} />}</Field>}
        {!tOk ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">Enter a target above 0 and up to 100.</p> :
          base.conducted === 0 ? <p className="text-sm text-slate-500">Record some classes first, then targets can be calculated.</p> : (<>
            <div className="flex items-center gap-2 text-sm"><Badge status={statusFor(base, T)} /> Current {fmt(pct(base))}% vs target {T}%</div>
            <p className="text-sm">{mustAttend === null ? 'A 100% target cannot be reached again once a class has been missed.' :
              mustAttend > 0 ? `Attend the next ${mustAttend} classes in a row to reach ${T}%. Formula: ceil((T×N − A) ÷ (1 − T)).` :
                `You can miss up to ${canMiss} classes in a row and stay at or above ${T}%. Formula: floor(A ÷ T − N).`}</p>
            <table className="w-full text-sm tabular-nums"><caption className="mb-1 text-left font-medium">Projection</caption>
              <tbody>
                {ATTEND_STEPS.map(n => { const t = project(base, n, 0); return <tr key={'a' + n}><td>Attend next {n}</td><td>{t.attended}/{t.conducted}</td><td className="text-right">{fmt(pct(t))}%</td></tr>; })}
                {MISS_STEPS.map(n => { const t = project(base, 0, n); return <tr key={'m' + n}><td>Miss next {n}</td><td>{t.attended}/{t.conducted}</td><td className="text-right">{fmt(pct(t))}%</td></tr>; })}
              </tbody></table></>)}
      </section>
    </div>
  );
}
