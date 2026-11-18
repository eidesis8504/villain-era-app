-- 금칙어 트리거 수정: 테이블마다 따로 검사한다
-- (하나의 IF 식에서 new.nickname 을 읽으면 posts·comments 트리거에서 'record new has no field' 오류가 난다)
create or replace function private.reject_banned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bad boolean := false;
begin
  if tg_table_name = 'posts' then
    bad := private.has_banned(new.title) or private.has_banned(new.body);
  elsif tg_table_name = 'comments' then
    bad := private.has_banned(new.body);
  elsif tg_table_name = 'profiles' then
    bad := private.has_banned(new.nickname) or private.has_banned(new.bio);
  end if;
  if bad then
    raise exception '사용할 수 없는 표현이 들어 있어요 · 운영정책을 확인해 주세요';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_banned() from public, anon, authenticated;
