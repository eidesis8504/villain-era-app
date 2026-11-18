-- 자동 숨김 악용 방지: 게스트 계정은 버튼 한 번으로 만들어지므로,
-- 만든 지 24시간이 안 된 계정의 신고는 자동 숨김 인원(3명)에 세지 않는다. 신고 기록과 운영자 알림은 그대로.
create or replace function public.report_content(p_kind text, p_id uuid, p_reason text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_user uuid;
  n int;
  adm record;
begin
  if me is null or not private.is_member() then
    raise exception '회원만 신고할 수 있어요';
  end if;
  if p_reason is null or p_reason not in ('spam', 'abuse', 'sexual', 'illegal', 'privacy', 'other') then
    raise exception '신고 이유를 골라 주세요';
  end if;
  if p_kind = 'post' then
    select author_id into v_user from public.posts where id = p_id;
  elsif p_kind = 'comment' then
    select author_id into v_user from public.comments where id = p_id;
  elsif p_kind = 'user' then
    select id into v_user from public.profiles where id = p_id;
  else
    raise exception '신고 대상을 확인해 주세요';
  end if;
  if v_user is null then
    raise exception '신고할 대상을 찾을 수 없어요';
  end if;
  if v_user = me then
    raise exception '내 글이나 내 계정은 신고할 수 없어요';
  end if;

  insert into public.reports (reporter_id, target_kind, target_id, target_user, reason, note)
  values (me, p_kind, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (reporter_id, target_kind, target_id) do nothing;
  if not found then
    return;
  end if;

  if p_kind in ('post', 'comment') then
    select count(distinct r.reporter_id) into n
      from public.reports r
      join public.profiles pr on pr.id = r.reporter_id
     where r.target_kind = p_kind and r.target_id = p_id and r.status = 'open'
       and pr.created_at <= now() - interval '24 hours';
    if n >= 3 then
      if p_kind = 'post' then
        update public.posts set hidden = true where id = p_id;
      else
        update public.comments set hidden = true where id = p_id;
      end if;
    end if;
  end if;

  for adm in select id from public.profiles where role = 'admin' and status = 'active' loop
    perform private.notify(
      adm.id, 'system', '신고 접수',
      case p_kind when 'post' then '게시글' when 'comment' then '댓글' else '회원' end || ' 신고가 들어왔어요',
      '/admin?tab=reports', 'report:' || p_kind || ':' || p_id
    );
  end loop;
end;
$$;

revoke all on function public.report_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;
