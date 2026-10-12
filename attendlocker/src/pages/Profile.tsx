import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../lib/data';
import { pct, round2 } from '../lib/calc';
import { download, toCsv } from '../lib/csv';
import { Confirm, Field } from '../components/ui';

export default function Profile({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  const d = useData();
  const [name, setName] = useState(''); const [college, setCollege] = useState(''); const [degree, setDegree] = useState('');
  const [year, setYear] = useState(''); const [target, setTarget] = useState('75');
  const [semLabel, setSemLabel] = useState(''); const [semStart, setSemStart] = useState('');
  const [stC, setStC] = useState(''); const [stA, setStA] = useState('');
  useEffect(() => { if (d.semester) { setStC(String(d.semester.starting_conducted)); setStA(String(d.semester.starting_attended)); } }, [d.semester]);
  const [resetOpen, setResetOpen] = useState(false); const [saved, setSaved] = useState(false);
  useEffect(() => { if (d.profile) { setName(d.profile.name); setCollege(d.profile.college); setDegree(d.profile.degree); setYear(d.profile.academic_year); } }, [d.profile]);
  useEffect(() => { if (d.prefs) setTarget(String(d.prefs.target_pct)); }, [d.prefs]);

  async function save() {
    const t = Number(target);
    if (!Number.isFinite(t) || t <= 0 || t > 100) { alert('Target must be above 0 and up to 100.'); return; }
    const a = await d.saveProfile({ name: name.trim(), college: college.trim(), degree: degree.trim(), academic_year: year.trim() });
    const b = await d.savePrefs({ target_pct: t, dark_mode: dark });
    setSaved(a && b); setTimeout(() => setSaved(false), 2500);
  }
  const semSubs = d.subjects.filter(s => s.semester_id === d.semester?.id);
  function exportRecords() {
    const rows = d.records.filter(r => semSubs.some(s => s.id === r.subject_id)).map(r => ({
      date: r.class_date, subject: semSubs.find(s => s.id === r.subject_id)?.name ?? '', status: r.status, note: r.note ?? '' }));
    download('attendance-records.csv', toCsv(rows.length ? rows : [{ date: '', subject: '', status: '', note: '' }]));
  }
  function exportSummary() {
    const rows = semSubs.map(s => { const t = d.subjectTotals(s.id); return {
      subject: s.name, code: s.code ?? '', archived: s.archived, starting_conducted: s.base_conducted, starting_attended: s.base_attended,
      conducted: t.conducted, attended: t.attended, missed: t.conducted - t.attended, percentage: round2(pct(t)) }; });
    rows.push({ subject: 'OVERALL', code: '', archived: false, starting_conducted: d.semester?.starting_conducted ?? 0, starting_attended: d.semester?.starting_attended ?? 0,
      conducted: d.overall.conducted, attended: d.overall.attended, missed: d.overall.conducted - d.overall.attended, percentage: round2(pct(d.overall)) });
    download('attendance-summary.csv', toCsv(rows));
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Profile</h1>
      <section className="card flex flex-col gap-3">
        <Field label="Name">{id => <input id={id} className="input" value={name} maxLength={100} onChange={e => setName(e.target.value)} />}</Field>
        <Field label="College">{id => <input id={id} className="input" value={college} maxLength={150} onChange={e => setCollege(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Degree">{id => <input id={id} className="input" value={degree} onChange={e => setDegree(e.target.value)} />}</Field>
          <Field label="Academic year">{id => <input id={id} className="input" placeholder="2026-27" value={year} onChange={e => setYear(e.target.value)} />}</Field></div>
        <Field label="Attendance target (%)">{id => <input id={id} inputMode="decimal" className="input" value={target} onChange={e => setTarget(e.target.value)} />}</Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dark} onChange={e => { setDark(e.target.checked); void d.savePrefs({ dark_mode: e.target.checked }); }} />Dark mode</label>
        <button className="btn-primary" onClick={save}>Save changes</button>
        {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</p>}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Semester</h2>
        <Field label="Current semester">{id => <select id={id} className="input" value={d.semester?.id} onChange={e => d.setSemester(e.target.value)}>{d.semesters.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>}</Field>
        <p className="text-xs text-slate-500">Tracking since {d.semester?.start_date}. Starting totals: {d.semester?.starting_attended}/{d.semester?.starting_conducted}.</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starting classes conducted">{id => <input id={id} inputMode="numeric" className="input" value={stC} onChange={e => setStC(e.target.value)} />}</Field>
          <Field label="Starting classes attended">{id => <input id={id} inputMode="numeric" className="input" value={stA} onChange={e => setStA(e.target.value)} />}</Field></div>
        <button className="btn-ghost" onClick={() => d.setStartingTotals(Number(stC), Number(stA))}>Save starting totals</button>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="New semester name" className="input" placeholder="Semester 2" value={semLabel} onChange={e => setSemLabel(e.target.value)} />
          <input aria-label="New semester start date" type="date" className="input" value={semStart} onChange={e => setSemStart(e.target.value)} /></div>
        <button className="btn-ghost" disabled={!semLabel.trim() || !semStart} onClick={async () => { if (await d.addSemester(semLabel.trim(), semStart)) { setSemLabel(''); setSemStart(''); } }}>Add semester</button>
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="font-semibold">Export and backup</h2>
        <button className="btn-ghost" onClick={exportRecords}>Export attendance records (CSV)</button>
        <button className="btn-ghost" onClick={exportSummary}>Export subject summary (CSV)</button>
      </section>

      <section className="card flex flex-col gap-2">
        <button className="btn-danger" onClick={() => setResetOpen(true)}>Reset semester attendance</button>
        <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
      </section>
      <Confirm open={resetOpen} title="Reset this semester?" confirmText="Reset everything"
        body="This deletes every recorded entry and sets starting totals and all subject starting figures to 0 for the current semester. Your subjects stay. This cannot be undone."
        onCancel={() => setResetOpen(false)} onConfirm={async () => { await d.resetSemester(); setResetOpen(false); }} />
    </div>
  );
}
