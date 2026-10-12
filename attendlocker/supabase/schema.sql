-- AttendLocker schema. Run in the Supabase SQL editor.
-- Every table has user_id and Row Level Security so users only see their own rows.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 100),
  college text not null default '' check (char_length(college) <= 150),
  degree text not null default 'B.Tech',
  academic_year text not null default '',
  created_at timestamptz not null default now()
);

create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_pct numeric(5,2) not null default 75 check (target_pct > 0 and target_pct <= 100),
  dark_mode boolean not null default false,
  active_semester_id uuid
);

-- Starting_* are the imported aggregate totals. They are never added to subject
-- totals, so importing a per-subject breakdown cannot double count sessions.
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  start_date date not null,
  starting_conducted int not null default 0 check (starting_conducted >= 0),
  starting_attended int not null default 0 check (starting_attended >= 0),
  created_at timestamptz not null default now(),
  check (starting_attended <= starting_conducted)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  code text check (char_length(code) <= 20),
  base_conducted int not null default 0 check (base_conducted >= 0),  -- imported starting figures
  base_attended int not null default 0 check (base_attended >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  check (base_attended <= base_conducted)
);

-- Entries recorded AFTER setup. Subject totals = base_* + these rows.
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_date date not null,
  status text not null check (status in ('present','absent')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index on public.attendance_records (user_id, class_date);

create table public.attendance_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id uuid,
  subject_id uuid,
  action text not null check (action in ('create','edit','delete','reset','baseline_edit')),
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['profiles','preferences','semesters','subjects','attendance_records','attendance_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- A subject_id on a record must belong to the same user (blocks cross-user references).
create or replace function public.check_subject_owner() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.subjects s where s.id = new.subject_id and s.user_id = new.user_id) then
    raise exception 'subject does not belong to user';
  end if;
  return new;
end $$;
create trigger trg_record_owner before insert or update on public.attendance_records
  for each row execute function public.check_subject_owner();
