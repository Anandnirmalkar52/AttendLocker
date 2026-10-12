import { useState } from 'react';
import { useData } from '../lib/data';
import { maxConsecutiveMisses, minConsecutiveAttends, missed, pct, round2, statusFor } from '../lib/calc';
import { Badge, Confirm, Empty, Field, Modal, Ring } from '../components/ui';
import type { Subject } from '../lib/types';

export default function Subjects() {
  const d = useData();
  const target = d.prefs?.target_pct ?? 75;
  const [q, setQ] = useState(''); const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false); const [nName, setNName] = useState(''); const [nCode, setNCode] = useState('');
  const [editing, setEditing] = useState<Subject | null>(null);
  const [detail, setDetail] = useState<Subject | null>(null);
  const [del, setDel] = useState<Subject | null>(null);
  const [eName, setEName] = useState(''); const [eCode, setECode] = useState(''); const [eCond, setECond] = useState(''); const [eAtt, setEAtt] = useState('');

  const list = d.subjects.filter(s => s.semester_id === d.semester?.id && s.archived === showArchived &&
    s.name.toLowerCase().includes(q.toLowerCase()));
  const un = d.unallocated;
  const reconciled = un.conducted === 0 && un.attended === 0;

  function openEdit(s: Subject) { setEditing(s); setEName(s.name); setECode(s.code ?? ''); setECond(String(s.base_conducted)); setEAtt(String(s.base_attended)); }
  async function saveEdit() {
    if (!editing || !eName.trim()) return;
    const c = Number(eCond), a = Number(eAtt);
    if (!Number.isInteger(c) || !Number.isInteger(a)) { alert('Enter whole numbers for classes.'); return; }
    const ok1 = await d.updateSubject(editing.id, { name: eName.trim(), code: eCode.trim() || null });
    const changed = c !== editing.base_conducted || a !== editing.base_attended;
    const ok2 = !changed || await d.editBaseline(editing, c, a);
    if (ok1 && ok2) setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold">Subjects</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}>Add subject</button></div>
      <div className="flex gap-2">
        <input className="input" placeholder="Search subjects" aria-label="Search subjects" value={q} onChange={e => setQ(e.target.value)} />
        <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Archived</label>
      </div>
      <div className={`rounded-xl p-3 text-sm ${reconciled ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200'}`}>
        {reconciled ? 'Subject starting figures match your imported totals.' :
          `Starting totals not yet assigned to a subject: ${un.attended} attended of ${un.conducted} conducted${un.conducted < 0 || un.attended < 0 ? ' (subject figures are higher than the imported totals — check them)' : ''}. Edit each subject's attendance until this reaches 0 / 0. Overall attendance already includes these totals, so nothing is counted twice.`}
      </div>

      {list.length === 0 ? <Empty title={showArchived ? 'No archived subjects' : 'No subjects found'} body="Add a subject or change your search." /> :
        list.map(s => {
          const t = d.subjectTotals(s.id); const p = pct(t);
          const spare = maxConsecutiveMisses(t, target), need = minConsecutiveAttends(t, target);
          return (
            <article key={s.id} className="card flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <Ring value={p} size={84} stroke={9} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{s.name}</h2>
                  {s.code && <p className="text-xs text-slate-500">{s.code}</p>}
                  <p className="text-sm tabular-nums">{t.attended} attended · {missed(t)} missed · {t.conducted} total</p>
                  <Badge status={statusFor(t, target)} />
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t.conducted === 0 ? 'No classes recorded yet.' : need ? `Attend the next ${need} classes to reach ${target}%.` : `You can miss ${spare} more in a row and stay at ${target}%.`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" onClick={() => d.mark(s.id, 'present')}>Mark present</button>
                <button className="btn-ghost" onClick={() => d.mark(s.id, 'absent')}>Mark absent</button>
                <button className="btn-ghost" onClick={() => openEdit(s)}>Edit attendance</button>
                <button className="btn-ghost" onClick={() => setDetail(s)}>View details</button>
                <button className="btn-ghost" onClick={() => d.updateSubject(s.id, { archived: !s.archived })}>{s.archived ? 'Unarchive' : 'Archive'}</button>
                <button className="btn-danger" onClick={() => setDel(s)}>Delete subject</button>
              </div>
            </article>);
        })}

      <Modal open={adding} title="Add subject" onClose={() => setAdding(false)}>
        <div className="flex flex-col gap-3">
          <Field label="Subject name">{id => <input id={id} className="input" value={nName} maxLength={80} onChange={e => setNName(e.target.value)} />}</Field>
          <Field label="Subject code (optional)">{id => <input id={id} className="input" value={nCode} maxLength={20} onChange={e => setNCode(e.target.value)} />}</Field>
          <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={async () => { if (await d.addSubject(nName, nCode)) { setNName(''); setNCode(''); setAdding(false); } }}>Add</button></div>
        </div>
      </Modal>

      <Modal open={!!editing} title="Edit attendance" onClose={() => setEditing(null)}>
        <div className="flex flex-col gap-3">
          <Field label="Subject name">{id => <input id={id} className="input" value={eName} maxLength={80} onChange={e => setEName(e.target.value)} />}</Field>
          <Field label="Subject code (optional)">{id => <input id={id} className="input" value={eCode} maxLength={20} onChange={e => setECode(e.target.value)} />}</Field>
          <Field label="Starting classes conducted" hint="Imported starting figures, before anything you record in the app.">{id => <input id={id} inputMode="numeric" className="input" value={eCond} onChange={e => setECond(e.target.value)} />}</Field>
          <Field label="Starting classes attended">{id => <input id={id} inputMode="numeric" className="input" value={eAtt} onChange={e => setEAtt(e.target.value)} />}</Field>
          <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={saveEdit}>Save</button></div>
        </div>
      </Modal>

      <Modal open={!!detail} title={detail?.name ?? ''} onClose={() => setDetail(null)}>
        {detail && (() => { const t = d.subjectTotals(detail.id); const rs = d.records.filter(r => r.subject_id === detail.id);
          return (<div className="flex flex-col gap-2 text-sm">
            <p>Attendance: <b>{round2(pct(t)).toFixed(2)}%</b> ({t.attended}/{t.conducted})</p>
            <p>Starting figures: {detail.base_attended}/{detail.base_conducted}. Recorded since: {rs.filter(r => r.status === 'present').length}/{rs.length}.</p>
            <p>Target {target}%: {maxConsecutiveMisses(t, target) === null ? 'no classes yet' : `can miss ${maxConsecutiveMisses(t, target)} in a row; ${minConsecutiveAttends(t, target) ? `must attend ${minConsecutiveAttends(t, target)} in a row to reach it` : 'already at or above it'}`}.</p>
            <ul className="max-h-40 overflow-auto">{rs.slice(0, 10).map(r => <li key={r.id}>{r.class_date}: {r.status}</li>)}</ul>
            <button className="btn-ghost mt-2" onClick={() => setDetail(null)}>Close</button></div>); })()}
      </Modal>

      <Confirm open={!!del} title="Delete subject?" confirmText="Delete"
        body={`"${del?.name}" and all its attendance records will be removed permanently. Archive it instead to keep the history.`}
        onCancel={() => setDel(null)} onConfirm={async () => { if (del) await d.deleteSubject(del.id); setDel(null); }} />
    </div>
  );
}
