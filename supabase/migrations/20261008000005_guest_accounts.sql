-- VILLAIN ERA · 로그인 없이 시작 (기기별 자동 계정 = Supabase 익명 로그인)
-- 새 계정은 초대 코드 없이 바로 활성 회원이 되고 기본 닉네임을 받는다.
-- 초대 코드 테이블·redeem_invite는 클로즈드 베타를 다시 켤 때를 위해 그대로 둔다.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, avatar_url, nickname, status, activated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    '사육자' || lpad(floor(random() * 10000)::int::text, 4, '0'),
    'active',
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 관리자 코드 입력 → 운영자 권한 (공지 작성 등)
create or replace function public.apply_admin_code(p_code text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  inv public.invite_codes;
  prof public.profiles;
begin
  if me is null then
    raise exception '로그인이 필요해요';
  end if;
  select * into inv from public.invite_codes where code = v_code for update;
  if not found or not inv.active or inv.role <> 'admin' then
    raise exception '관리자 코드를 확인해 주세요';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception '만료된 코드예요';
  end if;
  if inv.uses >= inv.max_uses then
    raise exception '이미 사용된 코드예요';
  end if;
  update public.invite_codes set uses = uses + 1 where code = inv.code;
  insert into public.invite_redemptions (code, user_id) values (inv.code, me) on conflict do nothing;
  update public.profiles
     set role = 'admin', status = 'active', activated_at = coalesce(activated_at, now())
   where id = me
   returning * into prof;
  return prof;
end;
$$;

revoke all on function public.apply_admin_code(text) from public, anon;
grant execute on function public.apply_admin_code(text) to authenticated;
