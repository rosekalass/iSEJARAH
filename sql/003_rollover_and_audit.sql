-- iSEJARAH v66: idempotent rollover; never updates/deletes historical rows
create or replace function public.rollover_academic_session(p_from_year text,p_to_year text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_created int:=0; v_graduated int:=0;
begin
  if not public.is_isejarah_admin() then raise exception 'Admin access required'; end if;
  if p_from_year=p_to_year then raise exception 'Source and destination sessions must differ'; end if;
  insert into public.academic_sessions(year,label,status,created_by) values(p_to_year,p_to_year,'DRAFT',auth.uid()) on conflict(year) do nothing;
  insert into public.student_enrollments(student_id,academic_year,class_id,year_level,status,teacher_id,source_enrollment_id)
  select e.student_id,p_to_year,null,e.year_level+1,'PENDING_ASSIGNMENT',null,e.id
  from public.student_enrollments e where e.academic_year=p_from_year and e.status='ACTIVE' and e.year_level in(4,5)
  on conflict(student_id,academic_year) do nothing;
  get diagnostics v_created=row_count;
  insert into public.student_enrollments(student_id,academic_year,class_id,year_level,status,teacher_id,source_enrollment_id)
  select e.student_id,p_to_year,null,6,'GRADUATED',null,e.id
  from public.student_enrollments e where e.academic_year=p_from_year and e.status='ACTIVE' and e.year_level=6
  on conflict(student_id,academic_year) do nothing;
  get diagnostics v_graduated=row_count;
  update public.academic_sessions set status='ARCHIVED',closed_at=coalesce(closed_at,now()) where year=p_from_year and status<>'ARCHIVED';
  return jsonb_build_object('from',p_from_year,'to',p_to_year,'promoted',v_created,'graduated',v_graduated,'idempotent',true);
end $$;
revoke all on function public.rollover_academic_session(text,text) from public;
grant execute on function public.rollover_academic_session(text,text) to authenticated;
