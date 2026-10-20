-- Additive Analisis Item module. Existing marks/PBD tables and policies are unchanged.
begin;
create table public.item_analysis_papers (
 id text primary key, academic_year text not null check(academic_year ~ '^20[0-9]{2}$'),
 year_level integer not null check(year_level between 4 and 6),
 exam_type text not null check(exam_type in ('UPSA','UASA')),
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 unique(academic_year,year_level,exam_type)
);
create table public.item_analysis_responses (
 paper_id text not null references public.item_analysis_papers(id),
 student_id text not null references public.students(id),
 class_id text not null references public.classes(id),
 attendance text check(attendance in ('Hadir','TH')),
 scores jsonb not null default '{}'::jsonb check(jsonb_typeof(scores)='object'),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 primary key(paper_id,student_id)
);
create index item_analysis_responses_class_idx on public.item_analysis_responses(class_id,paper_id);
create index item_analysis_responses_student_idx on public.item_analysis_responses(student_id);
alter table public.item_analysis_papers enable row level security;
alter table public.item_analysis_responses enable row level security;
revoke all on public.item_analysis_papers, public.item_analysis_responses from anon;
grant select,insert,update on public.item_analysis_papers,public.item_analysis_responses to authenticated;
create policy item_papers_read on public.item_analysis_papers for select to authenticated using((select public.current_app_user_id()) is not null);
create policy item_papers_insert on public.item_analysis_papers for insert to authenticated with check((select public.is_isejarah_admin()));
create policy item_papers_update on public.item_analysis_papers for update to authenticated using((select public.is_isejarah_admin())) with check((select public.is_isejarah_admin()));
create policy item_responses_read on public.item_analysis_responses for select to authenticated using((select public.current_app_user_id()) is not null and public.can_access_class(class_id));
create policy item_responses_insert on public.item_analysis_responses for insert to authenticated with check((select public.current_app_user_id()) is not null and public.can_access_class(class_id));
create policy item_responses_update on public.item_analysis_responses for update to authenticated using((select public.current_app_user_id()) is not null and public.can_access_class(class_id)) with check((select public.current_app_user_id()) is not null and public.can_access_class(class_id));
create function public.item_analysis_validate_response() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare k text; v jsonb; maximum integer; paper public.item_analysis_papers; cls public.classes;
begin
 select * into paper from public.item_analysis_papers where id=new.paper_id;
 select * into cls from public.classes where id=new.class_id;
 if paper.id is null or cls.id is null or not exists(select 1 from public.students s where s.id=new.student_id and s.class_id=new.class_id) then raise exception 'ITEM_INVALID_SCOPE'; end if;
 if coalesce(cls.academic_year,cls.data->>'academicYear')<>paper.academic_year or coalesce(cls.data->>'year','0')::integer<>paper.year_level then raise exception 'ITEM_INVALID_PAPER_CLASS'; end if;
 if new.attendance='TH' and new.scores<>'{}'::jsonb then raise exception 'ITEM_TH_HAS_SCORES'; end if;
 if new.attendance is null and new.scores<>'{}'::jsonb then raise exception 'ITEM_ATTENDANCE_REQUIRED'; end if;
 for k,v in select * from jsonb_each(new.scores) loop
  maximum:=case when k ~ '^A([1-9]|1[0-9]|20)$' then 1 when k ~ '^B[1-4]$' then 5 when k in ('C5A','C6A') then 2 when k in ('C5B','C6B') then 3 else null end;
  if maximum is null or jsonb_typeof(v)<>'number' then raise exception 'ITEM_INVALID_SCORE'; end if;
  if (v::text)::numeric<0 or (v::text)::numeric>maximum or trunc((v::text)::numeric)<>(v::text)::numeric then raise exception 'ITEM_INVALID_SCORE'; end if;
 end loop;
 new.updated_at:=now();new.updated_by:=auth.uid();
 if tg_op='UPDATE' then new.revision:=old.revision+1;else new.revision:=1;end if;
 return new;
end $$;
revoke all on function public.item_analysis_validate_response() from public;
create trigger item_response_validate before insert or update on public.item_analysis_responses for each row execute function public.item_analysis_validate_response();
create function public.item_analysis_save_responses(p_paper_id text,p_rows jsonb) returns setof public.item_analysis_responses language plpgsql security invoker set search_path=public,pg_temp as $$
declare r jsonb; expected integer; changed integer; seen text[]:='{}'; sid text;
begin
 if auth.uid() is null or public.current_app_user_id() is null then raise exception 'ITEM_LOGIN_REQUIRED'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>250 then raise exception 'ITEM_INVALID_BATCH'; end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  sid:=r->>'student_id';expected:=coalesce((r->>'expected_revision')::integer,0);
  if sid is null or sid=any(seen) or expected<0 then raise exception 'ITEM_INVALID_BATCH';end if;
  seen:=array_append(seen,sid);
  if expected=0 then
   insert into public.item_analysis_responses(paper_id,student_id,class_id,attendance,scores) values(p_paper_id,sid,r->>'class_id',r->>'attendance',coalesce(r->'scores','{}'::jsonb)) on conflict(paper_id,student_id) do nothing;
  else
   update public.item_analysis_responses set class_id=r->>'class_id',attendance=r->>'attendance',scores=coalesce(r->'scores','{}'::jsonb) where paper_id=p_paper_id and student_id=sid and revision=expected;
  end if;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'ITEM_CONFLICT: %',sid using errcode='40001';end if;
 end loop;
 return query select * from public.item_analysis_responses where paper_id=p_paper_id and student_id=any(seen);
end $$;
revoke all on function public.item_analysis_save_responses(text,jsonb) from public;
grant execute on function public.item_analysis_save_responses(text,jsonb) to authenticated;
create function public.item_analysis_save_paper(p_id text,p_expected_revision integer,p_data jsonb) returns setof public.item_analysis_papers language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not public.is_isejarah_admin() then raise exception 'ITEM_ADMIN_REQUIRED';end if;
 return query update public.item_analysis_papers set data=p_data,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id and revision=p_expected_revision returning *;
 if not found then raise exception 'ITEM_PAPER_CONFLICT' using errcode='40001';end if;
end $$;
revoke all on function public.item_analysis_save_paper(text,integer,jsonb) from public;
grant execute on function public.item_analysis_save_paper(text,integer,jsonb) to authenticated;
commit;
