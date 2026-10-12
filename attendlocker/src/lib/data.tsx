import { createContext, useCallback, useRef, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AttRecord, HistoryRow, Prefs, Profile, Semester, Subject } from './types';
import { START_ATTENDED, START_CONDUCTED, START_DATE } from './types';
import { isValidTotals, type Totals } from './calc';

interface Ctx {
  loading: boolean; error: string | null;
  profile: Profile | null; prefs: Prefs | null;
  semesters: Semester[]; semester: Semester | null;
  subjects: Subject[]; records: AttRecord[]; history: HistoryRow[];
  subjectTotals: (id: string) => Totals;
  overall: Totals;                 // semester starting totals + records
  unallocated: Totals;             // starting totals not yet assigned to a subject
  reload: () => Promise<void>;
  act: (fn: () => PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>;
  saveProfile: (p: Partial<Profile>) => Promise<boolean>;
  savePrefs: (p: Partial<Prefs>) => Promise<boolean>;
  setSemester: (id: string) => Promise<void>;
  addSemester: (label: string, start: string) => Promise<boolean>;
  addSubject: (name: string, code?: string) => Promise<boolean>;
  updateSubject: (id: string, p: Partial<Subject>) => Promise<boolean>;
  editBaseline: (s: Subject, conducted: number, attended: number) => Promise<boolean>;
  deleteSubject: (id: string) => Promise<boolean>;
  mark: (subjectId: string, status: 'present' | 'absent', date?: string, note?: string) => Promise<boolean>;
  markMany: (items: { subjectId: string; status: 'present' | 'absent'; date: string }[]) => Promise<boolean>;
  editRecord: (r: AttRecord, p: { status?: 'present' | 'absent'; class_date?: string }) => Promise<boolean>;
  deleteRecord: (r: AttRecord) => Promise<boolean>;
  resetSemester: () => Promise<boolean>;
  setStartingTotals: (conducted: number, attended: number) => Promise<boolean>;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useData = () => useContext(C);
export const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

export function DataProvider({ session, children }: { session: Session; children: ReactNode }) {
  const uid = session.user.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const inFlight = useRef<Promise<void> | null>(null);
  const reload = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const run = load().finally(() => { inFlight.current = null; });
    inFlight.current = run;
    return run;
  }, [uid, session.user.user_metadata]); // eslint-disable-line
  const load = useCallback(async () => {
    setError(null);
    try {
      // First login: create profile, preferences, first semester and 8 placeholder subjects.
      let { data: pf } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
      if (!pf) {
        const name = (session.user.user_metadata?.name as string) ?? '';
        await supabase.from('profiles').upsert({ user_id: uid, name }, { onConflict: 'user_id', ignoreDuplicates: true });
        const r = await supabase.from('profiles').select('*').eq('user_id', uid).single();
        if (r.error) throw r.error; pf = r.data;
      }
      let { data: pr } = await supabase.from('preferences').select('*').eq('user_id', uid).maybeSingle();
      if (!pr) {
        await supabase.from('preferences').upsert({ user_id: uid }, { onConflict: 'user_id', ignoreDuplicates: true });
        const r = await supabase.from('preferences').select('*').eq('user_id', uid).single();
        if (r.error) throw r.error; pr = r.data;
      }
      let { data: sems } = await supabase.from('semesters').select('*').order('created_at');
      if (!sems || sems.length === 0) {
        const s = await supabase.from('semesters').insert({
          label: 'Semester 1', start_date: START_DATE,
          starting_conducted: START_CONDUCTED, starting_attended: START_ATTENDED,
        }).select().single();
        if (s.error) throw s.error;
        const seed = Array.from({ length: 8 }, (_, i) => ({ semester_id: s.data.id, name: `Subject ${i + 1}` }));
        const sb = await supabase.from('subjects').insert(seed);
        if (sb.error) throw sb.error;
        const up = await supabase.from('preferences').update({ active_semester_id: s.data.id }).eq('user_id', uid).select().single();
        if (up.error) throw up.error; pr = up.data; sems = [s.data];
      }
      const [sub, rec, his] = await Promise.all([
        supabase.from('subjects').select('*').order('created_at'),
        supabase.from('attendance_records').select('*').order('class_date', { ascending: false }),
        supabase.from('attendance_history').select('*').order('changed_at', { ascending: false }).limit(200),
      ]);
      const bad = sub.error || rec.error || his.error; if (bad) throw bad;
      setProfile(pf as Profile); setPrefs(pr as Prefs); setSemesters(sems as Semester[]);
      setSubjects(sub.data as Subject[]); setRecords(rec.data as AttRecord[]); setHistory(his.data as HistoryRow[]);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load your data. Check your connection and try again.');
    } finally { setLoading(false); }
  }, [uid, session.user.user_metadata]);
  useEffect(() => { void reload(); }, [reload]);

  const semester = useMemo(
    () => semesters.find(s => s.id === prefs?.active_semester_id) ?? semesters[0] ?? null,
    [semesters, prefs, ]);
  const semSubjects = useMemo(() => subjects.filter(s => s.semester_id === semester?.id), [subjects, semester]);
  const semRecords = useMemo(() => {
    const ids = new Set(semSubjects.map(s => s.id));
    return records.filter(r => ids.has(r.subject_id));
  }, [records, semSubjects]);

  const subjectTotals = useCallback((id: string): Totals => {
    const s = subjects.find(x => x.id === id);
    const rs = records.filter(r => r.subject_id === id);
    return {
      conducted: (s?.base_conducted ?? 0) + rs.length,
      attended: (s?.base_attended ?? 0) + rs.filter(r => r.status === 'present').length,
    };
  }, [subjects, records]);

  // Overall = starting aggregate + recorded entries. Subject baselines are a split of the
  // starting aggregate, so they are never added on top (no double counting).
  const overall = useMemo<Totals>(() => ({
    conducted: (semester?.starting_conducted ?? 0) + semRecords.length,
    attended: (semester?.starting_attended ?? 0) + semRecords.filter(r => r.status === 'present').length,
  }), [semester, semRecords]);
  const unallocated = useMemo<Totals>(() => ({
    conducted: (semester?.starting_conducted ?? 0) - semSubjects.reduce((a, s) => a + s.base_conducted, 0),
    attended: (semester?.starting_attended ?? 0) - semSubjects.reduce((a, s) => a + s.base_attended, 0),
  }), [semester, semSubjects]);

  const act: Ctx['act'] = async fn => {
    const { error: e } = await fn();
    if (e) { setError(e.message); return false; }
    await reload(); return true;
  };
  const log = (action: string, record_id: string | null, subject_id: string | null, o: unknown, n: unknown) =>
    supabase.from('attendance_history').insert({ action, record_id, subject_id, old_value: o, new_value: n });

  const value: Ctx = {
    loading, error, profile, prefs, semesters, semester, subjects, records, history,
    subjectTotals, overall, unallocated, reload, act,
    saveProfile: p => act(() => supabase.from('profiles').update(p).eq('user_id', uid)),
    savePrefs: p => act(() => supabase.from('preferences').update(p).eq('user_id', uid)),
    setSemester: async id => { await act(() => supabase.from('preferences').update({ active_semester_id: id }).eq('user_id', uid)); },
    addSemester: async (label, start) => {
      const r = await supabase.from('semesters').insert({ label, start_date: start }).select().single();
      if (r.error) { setError(r.error.message); return false; }
      return act(() => supabase.from('preferences').update({ active_semester_id: r.data.id }).eq('user_id', uid));
    },
    addSubject: (name, code) => {
      if (!semester || !name.trim()) { setError('Enter a subject name.'); return Promise.resolve(false); }
      return act(() => supabase.from('subjects').insert({ semester_id: semester.id, name: name.trim(), code: code?.trim() || null }));
    },
    updateSubject: (id, p) => act(() => supabase.from('subjects').update(p).eq('id', id)),
    editBaseline: (s, conducted, attended) => {
      if (!isValidTotals({ conducted, attended })) {
        setError('Attended must be a whole number and cannot be more than conducted.'); return Promise.resolve(false);
      }
      return act(async () => {
        await log('baseline_edit', null, s.id,
          { conducted: s.base_conducted, attended: s.base_attended }, { conducted, attended });
        return supabase.from('subjects').update({ base_conducted: conducted, base_attended: attended }).eq('id', s.id);
      });
    },
    deleteSubject: id => act(() => supabase.from('subjects').delete().eq('id', id)),
    mark: (subjectId, status, date = today(), note) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (semester && date < semester.start_date)) {
        setError(`Date must be on or after ${semester?.start_date}.`); return Promise.resolve(false);
      }
      return act(async () => {
        const r = await supabase.from('attendance_records')
          .insert({ subject_id: subjectId, class_date: date, status, note: note ?? null }).select().single();
        if (!r.error) await log('create', r.data.id, subjectId, null, { class_date: date, status });
        return r;
      });
    },
    markMany: items => {
      const bad = items.find(i => semester && i.date < semester.start_date);
      if (bad) { setError(`Dates must be on or after ${semester?.start_date}.`); return Promise.resolve(false); }
      return act(async () => {
        const r = await supabase.from('attendance_records')
          .insert(items.map(i => ({ subject_id: i.subjectId, class_date: i.date, status: i.status }))).select();
        if (!r.error) await supabase.from('attendance_history').insert(
          r.data.map(x => ({ action: 'create', record_id: x.id, subject_id: x.subject_id, new_value: { class_date: x.class_date, status: x.status } })));
        return r;
      });
    },
    editRecord: (r, p) => act(async () => {
      await log('edit', r.id, r.subject_id, { class_date: r.class_date, status: r.status },
        { class_date: p.class_date ?? r.class_date, status: p.status ?? r.status });
      return supabase.from('attendance_records').update(p).eq('id', r.id);
    }),
    deleteRecord: r => act(async () => {
      await log('delete', r.id, r.subject_id, { class_date: r.class_date, status: r.status }, null);
      return supabase.from('attendance_records').delete().eq('id', r.id);
    }),
    setStartingTotals: (conducted, attended) => {
      if (!semester) return Promise.resolve(false);
      if (!isValidTotals({ conducted, attended })) {
        setError('Attended must be a whole number and cannot be more than conducted.'); return Promise.resolve(false);
      }
      return act(async () => {
        await log('baseline_edit', null, null,
          { starting_conducted: semester.starting_conducted, starting_attended: semester.starting_attended },
          { starting_conducted: conducted, starting_attended: attended });
        return supabase.from('semesters').update({ starting_conducted: conducted, starting_attended: attended }).eq('id', semester.id);
      });
    },
    resetSemester: () => act(async () => {
      const ids = semSubjects.map(s => s.id);
      await log('reset', null, null, { records: semRecords.length, starting: semester }, null);
      const d = await supabase.from('attendance_records').delete().in('subject_id', ids);
      if (d.error) return d;
      await supabase.from('subjects').update({ base_conducted: 0, base_attended: 0 }).in('id', ids);
      return supabase.from('semesters').update({ starting_conducted: 0, starting_attended: 0 }).eq('id', semester!.id);
    }),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
export { semesterSubjects };
function semesterSubjects(subjects: Subject[], semId?: string) { return subjects.filter(s => s.semester_id === semId); }
