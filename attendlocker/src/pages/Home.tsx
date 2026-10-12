import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../lib/data';
import { impact, maxConsecutiveMisses, minConsecutiveAttends, missed, pct, round2, statusFor } from '../lib/calc';
import { Badge, Empty, Ring, Stat } from '../components/ui';

const fmt = (n: number) => round2(n).toFixed(2);
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

export default function Home({ go }: { go: (p: string) => void }) {
  const { overall, subjects, semester, prefs, subjectTotals, records, profile } = useData();
  const [showArchived, setShowArchived] = useState(false);
  const target = prefs?.target_pct ?? 75;
  const status = statusFor(overall, target);
  const spare = maxConsecutiveMisses(overall, target);
  const need = minConsecutiveAttends(overall, target);

  const rows = useMemo(() => subjects
    .filter(s => s.semester_id === semester?.id && s.archived === showArchived)
    .map(s => ({ id: s.id, name: s.name, t: subjectTotals(s.id), p: pct(subjectTotals(s.id)) }))
    .filter(r => r.t.conducted > 0), [subjects, semester, showArchived, subjectTotals]);
  const best = rows.length ? rows.reduce((a, b) => (b.p > a.p ? b : a)) : null;
  const worst = rows.length ? rows.reduce((a, b) => (b.p < a.p ? b : a)) : null;

  const trend = useMemo(() => {
    if (!semester) return [];
    const ids = new Set(subjects.filter(s => s.semester_id === semester.id).map(s => s.id));
    const rs = records.filter(r => ids.has(r.subject_id)).sort((a, b) => a.class_date.localeCompare(b.class_date));
    let a = semester.starting_attended, c = semester.starting_conducted;
    const out = c > 0 ? [{ date: semester.start_date, pct: round2((a / c) * 100) }] : [];
    for (const r of rs) { c++; if (r.status === 'present') a++; out.push({ date: r.class_date, pct: round2((a / c) * 100) }); }
    return out;
  }, [records, subjects, semester]);

  const miss1 = impact(overall, 0, 1), att1 = impact(overall, 1, 0);

  if (!subjects.some(s => s.semester_id === semester?.id))
    return <Empty title="No subjects yet" body="Add your first subject to start tracking attendance." action={<button className="btn-primary" onClick={() => go('subjects')}>Add subject</button>} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Hi{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}</h1>
      <section className="card flex flex-col items-center gap-3 sm:flex-row sm:justify-around">
        <Ring value={pct(overall)} label="Overall" />
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Badge status={status} />
          <p className="text-sm text-slate-600 dark:text-slate-300">Target {target}%</p>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
            <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, (pct(overall) / target) * 100)}%` }} /></div>
        </div>
      </section>
      {(status === 'danger' || status === 'warning') && (
        <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {status === 'danger'
            ? `You are below your ${target}% target. Attend the next ${need ?? '—'} classes in a row to get back to it.`
            : `You are close to your ${target}% target. You can miss at most ${spare} more class${spare === 1 ? '' : 'es'} in a row.`}
        </div>)}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sessions attended" value={overall.attended} />
        <Stat label="Total sessions" value={overall.conducted} />
        <Stat label="Sessions missed" value={missed(overall)} />
        <Stat label="Status" value={<Badge status={status} />} />
      </div>
      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">What the next class does</h2>
        <p>Miss one: {overall.attended}/{overall.conducted + 1} = {fmt(miss1.afterPct)}% ({sign(miss1.pointsChange)} points, {miss1.relativeChange === null ? '—' : sign(miss1.relativeChange) + '%'} relative).</p>
        <p>Attend one: {att1.after.attended}/{att1.after.conducted} = {fmt(att1.afterPct)}% ({sign(att1.pointsChange)} points).</p>
        <p className="mt-1 text-xs text-slate-500">Points are the difference between two percentages. Relative change is that difference divided by the old percentage.</p>
      </section>
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Subjects</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Archived</label>
        </div>
        {rows.length === 0 ? <p className="text-sm text-slate-500">No subject-wise figures yet. Enter them on the Subjects page.</p> : (<>
          <div className="h-56"><ResponsiveContainer><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} /><Tooltip formatter={(v: number) => `${fmt(v)}%`} />
            <ReferenceLine y={target} stroke="#dc2626" strokeDasharray="4 4" /><Bar dataKey="p" name="Attendance" fill="#2f6df6" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <p className="mt-2 text-sm">Highest: <b>{best!.name}</b> ({fmt(best!.p)}%). Lowest: <b>{worst!.name}</b> ({fmt(worst!.p)}%).</p></>)}
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Trend</h2>
        {trend.length < 2 ? <p className="text-sm text-slate-500">The trend appears after you record a few classes.</p> :
          <div className="h-52"><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={['auto', 100]} /><Tooltip formatter={(v: number) => `${v}%`} />
            <ReferenceLine y={target} stroke="#dc2626" strokeDasharray="4 4" /><Line type="monotone" dataKey="pct" stroke="#2f6df6" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>}
      </section>
      <p className="text-xs text-slate-500">Overall = total attended ÷ total conducted, not an average of subject percentages. Starting totals ({semester?.starting_attended}/{semester?.starting_conducted}) are imported; everything after is recorded here.</p>
    </div>
  );
}
