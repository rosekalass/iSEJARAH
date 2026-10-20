-- Bridge existing app credentials to access control for the new module only.
begin;
create schema item_analysis_private;
revoke all on schema item_analysis_private from public,anon;
grant usage on schema item_analysis_private to authenticated;
create table item_analysis_private.sessions(
 auth_id uuid primary key references auth.users(id) on delete cascade,
 user_row_id text references public.users(id), verified_at timestamptz,
 failures integer not null default 0, window_started timestamptz not null default now()
);
revoke all on item_analysis_private.sessions from public,anon,authenticated;
create function item_analysis_private.user_id() returns text language sql stable security definer set search_path='' as $$
 select coalesce(u.data->>'legacyId',u.id) from item_analysis_private.sessions s join public.users u on u.id=s.user_row_id
 where s.auth_id=auth.uid() and s.verified_at>now()-interval '24 hours' and coalesce(u.active,true) and coalesce((u.data->>'active')::boolean,true)
$$;
create function item_analysis_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from item_analysis_private.sessions s join public.users u on u.id=s.user_row_id where s.auth_id=auth.uid() and s.verified_at>now()-interval '24 hours' and coalesce(u.active,true) and coalesce((u.data->>'active')::boolean,true) and upper(coalesce(u.role,u.data->>'role','')) in('ADMIN','KETUA_PANITIA'))
$$;
create function item_analysis_private.can_class(p_class text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from item_analysis_private.sessions s join public.users u on u.id=s.user_row_id join public.classes c on c.id=p_class
 where s.auth_id=auth.uid() and s.verified_at>now()-interval '24 hours' and coalesce(u.active,true) and coalesce((u.data->>'active')::boolean,true)
 and (upper(coalesce(u.role,u.data->>'role','')) in('ADMIN','KETUA_PANITIA') or (upper(coalesce(u.role,u.data->>'role',''))='GURU_SEJARAH' and coalesce(c.teacher_id,c.data->>'teacherId') in(u.id,u.data->>'legacyId'))))
$$;
create function item_analysis_private.bind(p_login text,p_password text) returns boolean language plpgsql security definer set search_path='' as $$
declare normalized text; profile public.users; session_row item_analysis_private.sessions; passed boolean:=false;
begin
 if auth.uid() is null then return false;end if;
 normalized:=upper(trim(p_login));
 insert into item_analysis_private.sessions(auth_id) values(auth.uid()) on conflict do nothing;
 select * into session_row from item_analysis_private.sessions where auth_id=auth.uid() for update;
 if session_row.window_started<now()-interval '15 minutes' then session_row.failures:=0;update item_analysis_private.sessions set failures=0,window_started=now() where auth_id=auth.uid();end if;
 if session_row.failures>=5 then return false;end if;
 select * into profile from public.users u where coalesce(u.active,true) and coalesce((u.data->>'active')::boolean,true)
 and (upper(coalesce(u.login_id,u.data->>'loginId',u.id))=normalized or (normalized ~ '^[0-9]{12}$' and regexp_replace(coalesce(u.data->>'mykad',u.data->>'myKad',''),'[^0-9]','','g')=normalized)) order by u.id limit 1;
 if profile.id is not null then
  if upper(coalesce(profile.role,profile.data->>'role','')) in('ADMIN','KETUA_PANITIA') and normalized='ADMIN' then
   passed:=encode(sha256(convert_to(p_password,'UTF8')),'hex')='7d77b9fdb2a1f783e11ae71c70a8820f3a58dfef556f43d614dfbc2c25cfad2e';
  elsif upper(coalesce(profile.role,profile.data->>'role',''))='GURU_SEJARAH' and normalized ~ '^[0-9]{12}$' then
   passed:=p_password=normalized;
  end if;
 end if;
 if passed then update item_analysis_private.sessions set user_row_id=profile.id,verified_at=now(),failures=0 where auth_id=auth.uid();
 else update item_analysis_private.sessions set user_row_id=null,verified_at=null,failures=failures+1 where auth_id=auth.uid();end if;
 return passed;
end $$;
revoke all on all functions in schema item_analysis_private from public,anon;
grant execute on function item_analysis_private.user_id(),item_analysis_private.is_admin(),item_analysis_private.can_class(text),item_analysis_private.bind(text,text) to authenticated;
create function public.item_analysis_bind_session(p_login text,p_password text) returns boolean language sql security invoker set search_path='' as $$select item_analysis_private.bind(p_login,p_password)$$;
revoke all on function public.item_analysis_bind_session(text,text) from public,anon;
grant execute on function public.item_analysis_bind_session(text,text) to authenticated;
create function public.item_analysis_session_ready() returns boolean language sql stable security invoker set search_path='' as $$select item_analysis_private.user_id() is not null$$;
revoke all on function public.item_analysis_session_ready() from public,anon;
grant execute on function public.item_analysis_session_ready() to authenticated;
alter policy item_papers_read on public.item_analysis_papers using((select item_analysis_private.user_id()) is not null);
alter policy item_papers_insert on public.item_analysis_papers with check((select item_analysis_private.is_admin()));
alter policy item_papers_update on public.item_analysis_papers using((select item_analysis_private.is_admin())) with check((select item_analysis_private.is_admin()));
alter policy item_responses_read on public.item_analysis_responses using(item_analysis_private.can_class(class_id));
alter policy item_responses_insert on public.item_analysis_responses with check(item_analysis_private.can_class(class_id));
alter policy item_responses_update on public.item_analysis_responses using(item_analysis_private.can_class(class_id)) with check(item_analysis_private.can_class(class_id));
create or replace function public.item_analysis_save_responses(p_paper_id text,p_rows jsonb) returns setof public.item_analysis_responses language plpgsql security invoker set search_path=public,pg_temp as $$
declare r jsonb; expected integer; changed integer; seen text[]:='{}'; sid text;
begin
 if auth.uid() is null or item_analysis_private.user_id() is null then raise exception 'ITEM_LOGIN_REQUIRED'; end if;
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
create or replace function public.item_analysis_save_paper(p_id text,p_expected_revision integer,p_data jsonb) returns setof public.item_analysis_papers language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not item_analysis_private.is_admin() then raise exception 'ITEM_ADMIN_REQUIRED';end if;
 return query update public.item_analysis_papers set data=p_data,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id and revision=p_expected_revision returning *;
 if not found then raise exception 'ITEM_PAPER_CONFLICT' using errcode='40001';end if;
end $$;
commit;
