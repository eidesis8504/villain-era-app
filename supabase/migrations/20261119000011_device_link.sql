-- VILLAIN ERA · 다른 기기에서 이어 쓰기(연결 코드) (2026-11-19)
-- 쓰던 기기에서 받은 8자리 코드를 새 기기에 넣으면, Edge Function(device-link)이 같은 계정의 일회용 로그인 열쇠를 만들어 준다.
-- 코드·시도 기록은 API로 노출되지 않는 private 스키마에 두고, 아래 private 함수는 Edge Function의 DB 연결에서만 부른다.
-- 코드는 평문으로 저장하지 않는다(정규화한 코드의 SHA-256만).

create table private.device_link_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz -- 사용했거나 무효로 만든 시각
);
create index device_link_codes_user_idx on private.device_link_codes (user_id);

create table private.device_link_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  at timestamptz not null default now()
);
create index device_link_attempts_ip_idx on private.device_link_attempts (ip_hash, at);

revoke all on table private.device_link_codes, private.device_link_attempts from public, anon, authenticated;

-- 코드 정규화(전각 → 반각, 대문자, 영문·숫자만) 후 해시. 발급과 사용이 같은 규칙을 쓴다.
create or replace function private.device_link_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(
    upper(regexp_replace(normalize(coalesce(p_code, ''), NFKC), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;

-- 코드 발급: 쓰지 않은 이전 코드는 무효, 같은 사용자는 10분에 5번까지, 10분(600초) 유효
create or replace function private.device_link_issue(p_user uuid)
returns table (code text, expires_in int)
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- 31자: 헷갈리는 0·O·1·I·L 제외
  v_code text := '';
  v_byte int;
begin
  if (select count(*) from private.device_link_codes c
       where c.user_id = p_user and c.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited';
  end if;
  while length(v_code) < 8 loop
    v_byte := get_byte(extensions.gen_random_bytes(1), 0);
    if v_byte < 248 then -- 31 × 8: 248 이상을 버려 글자가 고르게 나오게 한다
      v_code := v_code || substr(v_alphabet, 1 + v_byte % 31, 1);
    end if;
  end loop;
  update private.device_link_codes c set used_at = now() where c.user_id = p_user and c.used_at is null;
  insert into private.device_link_codes (code_hash, user_id, expires_at)
  values (private.device_link_hash(v_code), p_user, now() + interval '600 seconds');
  delete from private.device_link_codes c where c.expires_at < now() - interval '1 day';
  return query select v_code, 600;
end;
$$;

-- 코드 사용: 같은 IP(해시)에서 10분에 실패 10번이면 잠금. 한 문장으로 사용 처리해 동시에 두 번 쓰이지 않는다.
-- 결과: 성공 (계정, null) / 실패 (null, 'invalid' | 'expired' | 'rate_limited')
create or replace function private.device_link_consume(p_code text, p_ip_hash text)
returns table (user_id uuid, error text)
language plpgsql
set search_path = ''
as $$
declare
  v_hash text := private.device_link_hash(p_code);
  v_user uuid;
begin
  if (select count(*) from private.device_link_attempts a
       where a.ip_hash = p_ip_hash and a.at > now() - interval '10 minutes') >= 10 then
    return query select null::uuid, 'rate_limited'::text;
    return;
  end if;
  update private.device_link_codes c set used_at = now()
   where c.code_hash = v_hash and c.used_at is null and c.expires_at > now()
  returning c.user_id into v_user;
  if v_user is not null then
    return query select v_user, null::text;
    return;
  end if;
  insert into private.device_link_attempts (ip_hash) values (p_ip_hash);
  delete from private.device_link_attempts a where a.at < now() - interval '1 day';
  return query select null::uuid,
    (case when exists (select 1 from private.device_link_codes c where c.code_hash = v_hash)
          then 'expired' else 'invalid' end)::text;
end;
$$;

-- 다른 기기 모두 연결 끊기: 쓰지 않은 코드를 모두 무효로
create or replace function private.device_link_revoke(p_user uuid)
returns void
language sql
set search_path = ''
as $$
  update private.device_link_codes set used_at = now() where user_id = p_user and used_at is null;
$$;

revoke all on function private.device_link_hash(text), private.device_link_issue(uuid),
  private.device_link_consume(text, text), private.device_link_revoke(uuid) from public, anon, authenticated;

-- 이 기기 계정이 비어 있는지: 개체·글·댓글·할 일이 없고 운영자가 아님 (다른 기기 기록을 불러오기 전에 확인)
create or replace function public.my_account_is_empty()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not exists (select 1 from public.animals a where a.owner_id = auth.uid())
     and not exists (select 1 from public.posts p where p.author_id = auth.uid())
     and not exists (select 1 from public.comments c where c.author_id = auth.uid())
     and not exists (select 1 from public.todos t where t.owner_id = auth.uid())
     and not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
$$;

revoke all on function public.my_account_is_empty() from public, anon;
grant execute on function public.my_account_is_empty() to authenticated;
