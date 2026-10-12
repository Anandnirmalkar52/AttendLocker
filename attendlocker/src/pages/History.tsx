import { useMemo, useState } from 'react';
import { useData, today } from '../lib/data';
import { Confirm, Empty, Field } from '../components/ui';
import type { AttRecord } from '../lib/types';

const monthKey = (d: string) => d.slice(0, 7);
function weekStart(d: string) { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toLocaleDateString('en-CA'); }

export default function History() {
  const d = useData();
  const start = d.semester?.start_date ?? '2026-08-24';
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [sub, setSub] = useState('all');
  const [month, setMonth] = useState(monthKey(today() < start ? start : today()));
  const [view, setView] = useState<'records' | 'summary' | 'changes'>('records');
  const [nSub, setNSub] = useState(''); const [nDate, setNDate] = useState(today()); const [nStatus, setNStatus] = useState<'present' | 'absent'>('present');
  const [del, setDel] = useState<AttRecord | null>(null);

  const subs = d.subjects.filter(s => s.semester_id === d.semester?.id);
  const nameOf = (id: string | null) => subs.find(s => s.id === id)?.name ?? d.subjects.find(s => s.id === id)?.name ?? 'Deleted subject';
  const semIds = new Set(subs.map(s => s.id));
  const recs = useMemo(() => d.records.filter(r => semIds.has(r.subject_id) && (sub === 'all' || r.subject_id === sub) &&
    (!from || r.class_date >= from) && (!to || r.class_date <= to)), [d.records, sub, from, to, d.subjects, d.semester]);

  const summary = (key: (x: string) => string) => {
    const m = new Map<string, { p: number; a: number }>();
    recs.forEach(r => { const k = key(r.class_date); const v = m.get(k) ?? { p: 0, a: 0 }; r.status === 'present' ? v.p++ : v.a++; m.set(k, v); });
    return [...m.entries()].sort((x, y) => y[0].localeCompare(x[0]));
  };

  // Calendar
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), days = new Date(y, mo, 0).getDate(), offset = (first.getDay() + 6) % 7;
  const byDay = new Map<string, { p: number; a: number }>();
  recs.forEach(r => { if (monthKey(r.class_date) === month) { const v = byDay.get(r.class_date) ?? { p: 0, a: 0 }; r.status === 'present' ? v.p++ : v.a++; byDay.set(r.class_date, v); } });
  const shift = (n: number) => { const x = new Date(y, mo - 1 + n, 1); const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; if (k + '-31' >= start.slice(0, 7)) setMonth(k); };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">History</h1>
      <section className="card flex flex-col gap-2">
        <div className="mb-1 flex items-center justify-between">
          <button className="btn-ghost" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
          <b>{first.toLocaleString('en', { month: 'long', year: 'numeric' })}</b>
          <button className="btn-ghost" aria-label="Next month" onClick={() => shift(1)}>›</button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <div key={i} className="text-slate-500">{x}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={'o' + i} />)}
          {Array.from({ length: days }, (_, i) => { const dt = `${month}-${String(i + 1).padStart(2, '0')}`; const v = byDay.get(dt); const before = dt < start;
            return (<button key={dt} disabled={before} onClick={() => { setFrom(dt); setTo(dt); setView('records'); }}
              aria-label={`${dt}${v ? `, ${v.p} present, ${v.a} absent` : ''}`} className={`min-h-[40px] rounded-lg p-1 ${before ? 'opacity-30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {i + 1}<div className="flex justify-center gap-0.5">{v?.p ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}{v?.a ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : null}</div></button>); })}
        </div>
        <p className="text-xs text-slate-500">Green = present, red = absent. Tracking starts {start}.</p>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Add a past record</h2>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Subject">{id => <select id={id} className="input" value={nSub} onChange={e => setNSub(e.target.value)}><option value="">Choose…</option>{subs.filter(s => !s.archived).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}</Field>
          <Field label="Date">{id => <input id={id} type="date" min={start} max={today()} className="input" value={nDate} onChange={e => setNDate(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Status" className="input" value={nStatus} onChange={e => setNStatus(e.target.value as 'present' | 'absent')}><option value="present">Present</option><option value="absent">Absent</option></select>
          <button className="btn-primary" disabled={!nSub} onClick={() => d.mark(nSub, nStatus, nDate)}>Add record</button>
        </div>
      </section>

      <div className="flex gap-2" role="tablist">
        {(['records', 'summary', 'changes'] as const).map(v => <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'btn-primary flex-1' : 'btn-ghost flex-1'} onClick={() => setView(v)}>{{ records: 'Records', summary: 'Summary', changes: 'Changes' }[v]}</button>)}
      </div>

      {view !== 'changes' && <div className="grid grid-cols-3 gap-2">
        <Field label="From">{id => <input id={id} type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />}</Field>
        <Field label="To">{id => <input id={id} type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />}</Field>
        <Field label="Subject">{id => <select id={id} className="input" value={sub} onChange={e => setSub(e.target.value)}><option value="all">All</option>{subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}</Field>
      </div>}

      {view === 'records' && (recs.length === 0 ? <Empty title="No records" body="Marked classes show up here. Imported starting totals are not listed because they have no dates." /> :
        <ul className="flex flex-col gap-2">{recs.map(r => (
          <li key={r.id} className="card flex items-center justify-between gap-2 !p-3 text-sm">
            <div><p className="font-medium">{nameOf(r.subject_id)}</p><p className="text-slate-500">{r.class_date}</p></div>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${r.status === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{r.status === 'present' ? 'Present' : 'Absent'}</span>
            <div className="flex gap-1">
              <button className="btn-ghost !min-h-[40px] !px-2" onClick={() => d.editRecord(r, { status: r.status === 'present' ? 'absent' : 'present' })}>Flip</button>
              <button className="btn-danger !min-h-[40px] !px-2" onClick={() => setDel(r)}>Delete</button></div>
          </li>))}</ul>)}

      {view === 'summary' && (<div className="grid gap-3 sm:grid-cols-2">
        {([['Weekly (week starting Monday)', weekStart], ['Monthly', monthKey]] as const).map(([t, fn]) => (
          <section key={t} className="card text-sm"><h2 className="mb-2 font-semibold">{t}</h2>
            {summary(fn).length === 0 ? <p className="text-slate-500">Nothing recorded.</p> : summary(fn).map(([k, v]) => <p key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">{v.p} present, {v.a} absent</span></p>)}</section>))}</div>)}

      {view === 'changes' && (d.history.length === 0 ? <Empty title="No changes yet" body="Every record you add, correct or delete is logged here." /> :
        <ul className="flex flex-col gap-2">{d.history.map(h => (
          <li key={h.id} className="card !p-3 text-xs"><p className="font-semibold">{h.action} · {nameOf(h.subject_id)} · {new Date(h.changed_at).toLocaleString()}</p>
            <p className="break-all text-slate-500">{h.old_value ? JSON.stringify(h.old_value) : '—'} → {h.new_value ? JSON.stringify(h.new_value) : '—'}</p></li>))}</ul>)}

      <Confirm open={!!del} title="Delete this record?" confirmText="Delete" body="The entry is removed and attendance is recalculated. The deletion stays in your change log."
        onCancel={() => setDel(null)} onConfirm={async () => { if (del) await d.deleteRecord(del); setDel(null); }} />
    </div>
  );
}
