-- iSEJARAH v66: additive feature schema
begin;
alter table if exists public.pbd_records add column if not exists inherited_from_period text;
alter table if exists public.pbd_records add column if not exists inherited_from_record_id text;
alter table if exists public.pbd_records add column if not exists freshly_assessed boolean not null default true;
alter table if exists public.interventions add column if not exists review_date date;
alter table if exists public.interventions add column if not exists result text;
alter table if exists public.interventions add column if not exists follow_up_status text not null default 'BELUM_BERMULA';
alter table if exists public.interventions add column if not exists reviewed_at timestamptz;

create table if not exists public.academic_sessions(
  year text primary key, label text not null, status text not null default 'DRAFT',
  opened_at timestamptz, closed_at timestamptz, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table if not exists public.student_enrollments(
  id uuid primary key default gen_random_uuid(), student_id text not null, academic_year text not null references public.academic_sessions(year),
  class_id text, year_level integer not null, status text not null default 'ACTIVE', teacher_id text,
  source_enrollment_id uuid references public.student_enrollments(id), created_at timestamptz not null default now(),
  unique(student_id,academic_year)
);
create table if not exists public.assessment_archives(
  id uuid primary key default gen_random_uuid(), academic_year text not null, assessment_id text, class_id text,
  snapshot jsonb not null, locked_at timestamptz not null default now(), locked_by uuid references auth.users(id)
);
create table if not exists public.backup_registry(
  id uuid primary key default gen_random_uuid(), academic_year text, file_name text, checksum text,
  exported_at timestamptz not null default now(), exported_by uuid references auth.users(id), metadata jsonb not null default '{}'::jsonb
);

alter table public.academic_sessions enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.assessment_archives enable row level security;
alter table public.backup_registry enable row level security;
create policy sessions_read on public.academic_sessions for select to authenticated using(true);
create policy sessions_admin_write on public.academic_sessions for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());
create policy enrollments_scoped_read on public.student_enrollments for select to authenticated using(public.can_access_class(class_id));
create policy enrollments_admin_write on public.student_enrollments for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());
create policy archives_scoped_read on public.assessment_archives for select to authenticated using(public.can_access_class(class_id));
create policy archives_admin_write on public.assessment_archives for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());
create policy backups_admin on public.backup_registry for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());
commit;

