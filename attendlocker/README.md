# AttendLocker — Smart Attendance Manager
A personal attendance tracker (not an official or government app). React + TypeScript, Tailwind, Recharts, Supabase.

## Setup
1. Create a Supabase project. In the SQL editor, run `supabase/schema.sql`.
2. In Authentication > Providers, keep Email enabled. Add your site URL under URL Configuration (used by password reset).
3. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only, never the service key).
4. `npm install`, then `npm run dev`. Run `npm test` for the calculation tests, `npm run build` to type-check and build.

## How totals work (no double counting)
- The semester stores the imported starting totals (126 conducted / 119 attended on 24 Aug 2026).
- Each subject stores its own starting figures. They are a split of the starting totals, never added on top of them.
- Marked classes are dated rows in `attendance_records`.
- Overall = starting totals + all records. Subject = its starting figures + its records.
- The Subjects page shows how much of the starting totals is still unassigned to a subject.
