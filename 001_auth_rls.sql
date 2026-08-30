-- iSEJARAH v66: real Supabase Auth migration and class-scoped RLS
-- Backward-safe: additive only. Run in Supabase SQL Editor as database owner.
begin;

alter table if exists public.users add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table if exists public.users add column if not exists role text;
alter table if exists public.users add column if not exists active boolean not null default true;
alter table if exists public.classes add column if not exists teacher_id text;

create or replace function public.current_app_user_id() returns text
language sql stable security definer set search_path=public
as $$ select u.id::text from public.users u where u.auth_user_id=auth.uid() and coalesce(u.active,true) limit 1 $$;

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path=public
as $$ select upper(coalesce(u.role,'')) from public.users u where u.auth_user_id=auth.uid() and coalesce(u.active,true) limit 1 $$;

create or replace function public.is_isejarah_admin() returns boolean
language sql stable security definer set search_path=public
as $$ select public.current_app_role() in ('ADMIN','KETUA_PANITIA') $$;

create or replace function public.can_access_class(p_class_id text) returns boolean
language sql stable security definer set search_path=public
as $$ select public.is_isejarah_admin() or exists(select 1 from public.classes c where c.id::text=p_class_id and c.teacher_id::text=public.current_app_user_id()) $$;

grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_isejarah_admin() to authenticated;
grant execute on function public.can_access_class(text) to authenticated;

alter table if exists public.users enable row level security;
alter table if exists public.classes enable row level security;
alter table if exists public.students enable row level security;
alter table if exists public.assessments enable row level security;
alter table if exists public.scores enable row level security;
alter table if exists public.pbd_records enable row level security;
alter table if exists public.pbd_group_levels enable row level security;
alter table if exists public.pbd_overall enable row level security;
alter table if exists public.pbd_locks enable row level security;
alter table if exists public.interventions enable row level security;
alter table if exists public.headcount enable row level security;
alter table if exists public.audit_logs enable row level security;

drop policy if exists users_self_or_admin on public.users;
create policy users_self_or_admin on public.users for select to authenticated using(auth_user_id=auth.uid() or public.is_isejarah_admin());
drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());

drop policy if exists classes_scoped_read on public.classes;
create policy classes_scoped_read on public.classes for select to authenticated using(public.can_access_class(id::text));
drop policy if exists classes_admin_write on public.classes;
create policy classes_admin_write on public.classes for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());

drop policy if exists assessments_scoped_read on public.assessments;
create policy assessments_scoped_read on public.assessments for select to authenticated using(public.can_access_class(class_id::text));
drop policy if exists assessments_admin_write on public.assessments;
create policy assessments_admin_write on public.assessments for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());

drop policy if exists students_scoped on public.students;
create policy students_scoped on public.students for all to authenticated using(public.can_access_class(class_id::text)) with check(public.can_access_class(class_id::text));
drop policy if exists scores_scoped on public.scores;
create policy scores_scoped on public.scores for all to authenticated using(exists(select 1 from public.students s where s.id=scores.student_id and public.can_access_class(s.class_id::text))) with check(exists(select 1 from public.students s where s.id=scores.student_id and public.can_access_class(s.class_id::text)));
drop policy if exists pbd_records_scoped on public.pbd_records;
create policy pbd_records_scoped on public.pbd_records for all to authenticated using(public.can_access_class(class_id::text)) with check(public.can_access_class(class_id::text));
drop policy if exists pbd_group_levels_scoped on public.pbd_group_levels;
create policy pbd_group_levels_scoped on public.pbd_group_levels for all to authenticated using(public.can_access_class(class_id::text)) with check(public.can_access_class(class_id::text));
drop policy if exists pbd_overall_scoped on public.pbd_overall;
create policy pbd_overall_scoped on public.pbd_overall for all to authenticated using(public.can_access_class(class_id::text)) with check(public.can_access_class(class_id::text));
drop policy if exists pbd_locks_scoped on public.pbd_locks;
create policy pbd_locks_scoped on public.pbd_locks for select to authenticated using(public.can_access_class(class_id::text));
drop policy if exists pbd_locks_admin_write on public.pbd_locks;
create policy pbd_locks_admin_write on public.pbd_locks for all to authenticated using(public.is_isejarah_admin()) with check(public.is_isejarah_admin());
drop policy if exists interventions_scoped on public.interventions;
create policy interventions_scoped on public.interventions for all to authenticated using(public.can_access_class(class_id::text)) with check(public.can_access_class(class_id::text));
drop policy if exists headcount_scoped on public.headcount;
create policy headcount_scoped on public.headcount for all to authenticated using(public.can_access_class(class_id::text)) with check(public.can_access_class(class_id::text));
drop policy if exists audit_read_admin on public.audit_logs;
create policy audit_read_admin on public.audit_logs for select to authenticated using(public.is_isejarah_admin());
drop policy if exists audit_insert_authenticated on public.audit_logs;
create policy audit_insert_authenticated on public.audit_logs for insert to authenticated with check(true);

-- Remove these legacy grants only after every user has auth_user_id and the frontend authMode is "password".
-- revoke all on all tables in schema public from anon;
commit;
