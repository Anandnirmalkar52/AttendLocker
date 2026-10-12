export interface Profile { user_id: string; name: string; college: string; degree: string; academic_year: string }
export interface Prefs { user_id: string; target_pct: number; dark_mode: boolean; active_semester_id: string | null }
export interface Semester { id: string; label: string; start_date: string; starting_conducted: number; starting_attended: number }
export interface Subject { id: string; semester_id: string; name: string; code: string | null; base_conducted: number; base_attended: number; archived: boolean }
export interface AttRecord { id: string; subject_id: string; class_date: string; status: 'present' | 'absent'; note: string | null }
export interface HistoryRow { id: string; record_id: string | null; subject_id: string | null; action: string; old_value: unknown; new_value: unknown; changed_at: string }
export const START_DATE = '2026-08-24';
export const START_CONDUCTED = 126;
export const START_ATTENDED = 119;
