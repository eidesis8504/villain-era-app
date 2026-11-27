-- VILLAIN ERA · 분양·홍보 게시판과 분양 이력서 (2026-11-27)
-- 1) 커뮤니티 분류에 '분양·홍보'를 더하고, 글에 서버가 채우는 분양 카드(attach.kind = 'adopt')를 붙인다.
-- 2) 분양 이력서: 개체의 사육 기록 요약을 계정 없이 볼 수 있는 링크(/r/<토큰>). 분양자가 만들고 끈다.
-- 추가형 변경이다: 지금 운영 중인 화면(옛 분류 4개, 기존 첨부)은 그대로 동작한다.

-- ─────────────────────────────────────────────────────────────
-- 분류 추가
-- ─────────────────────────────────────────────────────────────
alter table public.posts drop constraint posts_cat_check;
alter table public.posts add constraint posts_cat_check
  check (cat in ('자유', 'Q&A', '정보', '사육일지', '분양·홍보'));

-- ─────────────────────────────────────────────────────────────
-- 분양 이력서 토큰 (개체마다 살아 있는 토큰은 하나)
-- ─────────────────────────────────────────────────────────────
create table public.animal_shares (
  token text primary key check (token ~ '^[A-Z0-9]{16}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  animal_id uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (owner_id, animal_id) references public.animals (owner_id, id) on delete cascade
);
create unique index animal_shares_live_idx on public.animal_shares (animal_id) where revoked_at is null;
create index animal_shares_owner_idx on public.animal_shares (owner_id);

-- 토큰은 함수로만 만들고 끈다. 본인 것만 읽는다
revoke all on public.animal_shares from anon, authenticated;
grant select on public.animal_shares to authenticated;
alter table public.animal_shares enable row level security;
create policy "animal_shares_select_own" on public.animal_shares for select to authenticated
  using (owner_id = (select auth.uid()));

create or replace function public.share_animal(p_animal uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  perform 1 from public.animals where id = p_animal and owner_id = auth.uid() for update;
  if not found then
    raise exception '개체를 찾을 수 없어요';
  end if;
  select token into v_token from public.animal_shares where animal_id = p_animal and revoked_at is null;
  if v_token is not null then
    return v_token;
  end if;
  loop
    v_token := private.random_code(16);
    exit when not exists (select 1 from public.animal_shares where token = v_token);
  end loop;
  insert into public.animal_shares (token, owner_id, animal_id) values (v_token, auth.uid(), p_animal);
  return v_token;
end;
$$;

create or replace function public.unshare_animal(p_animal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.animal_shares set revoked_at = now()
   where animal_id = p_animal and owner_id = auth.uid() and revoked_at is null;
end;
$$;

-- 이력서 보기: 계정 없이도 부른다. 없거나 꺼진 토큰, 이용이 제한된 계정이면 null.
-- 넣지 않는 것: 건강 기록(증상·진료), 급여량, 메모
create or replace function public.get_resume(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token text := upper(regexp_replace(coalesce(p_token, ''), '[^A-Za-z0-9]', '', 'g'));
  sh public.animal_shares;
  a public.animals;
  p public.profiles;
begin
  select * into sh from public.animal_shares where token = v_token and revoked_at is null;
  if not found then
    return null;
  end if;
  select * into a from public.animals where id = sh.animal_id;
  select * into p from public.profiles where id = sh.owner_id;
  if a.id is null or p.id is null or p.status <> 'active' then
    return null;
  end if;
  return jsonb_build_object(
    'animal', jsonb_build_object('code', a.code, 'species', a.species, 'name', a.name, 'sex', a.sex, 'morph', a.morph,
                                 'hatch_date', a.hatch_date, 'photo_path', a.photo_path, 'status', a.status),
    'owner', jsonb_build_object('nickname', p.nickname,
                                'badge', case when p.role = 'admin' then '운영자' else p.badge end,
                                'since', (p.created_at at time zone 'Asia/Seoul')::date),
    'weights', coalesce(
      (select jsonb_agg(jsonb_build_object('d', w.measured_on, 'g', w.grams) order by w.measured_on)
         from (select measured_on, grams from public.weights where animal_id = a.id order by measured_on desc limit 200) w),
      '[]'::jsonb),
    'feedings', coalesce(
      (select jsonb_agg(jsonb_build_object('d', f.fed_on, 'r', f.result, 'f', f.food) order by f.fed_on, f.id)
         from (select id, fed_on, result, food from public.feedings
                where animal_id = a.id and fed_on > current_date - 90 order by fed_on desc, id desc limit 200) f),
      '[]'::jsonb),
    'sire', (select jsonb_build_object('code', x.code, 'name', x.name, 'morph', x.morph, 'species', x.species)
               from public.animals x where x.id = a.sire_id),
    'dam', (select jsonb_build_object('code', x.code, 'name', x.name, 'morph', x.morph, 'species', x.species)
              from public.animals x where x.id = a.dam_id),
    'shared_at', sh.created_at
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 새 계정 제한: 분양·홍보 글은 시작한 지 24시간이 지나고 개체를 1마리 이상 등록한 계정만 (운영자는 예외)
-- ─────────────────────────────────────────────────────────────
create or replace function private.can_trade(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_user and p.status = 'active'
       and (p.role = 'admin'
            or (p.created_at <= now() - interval '24 hours'
                and exists (select 1 from public.animals a where a.owner_id = p.id)))
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 분양 카드: 화면이 보낸 값을 그대로 믿지 않고 서버가 다시 만든다.
--   개체 정보는 글쓴이의 살아 있는 이력서 토큰으로만 채운다 (남의 개체·꾸민 정보를 붙일 수 없다)
-- ─────────────────────────────────────────────────────────────
create or replace function private.on_adopt_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t jsonb := new.attach;
  s jsonb;
  v_seller jsonb;
  v_token text;
  v_animal jsonb;
begin
  if new.cat <> '분양·홍보' then
    if jsonb_typeof(t) = 'object' and t ->> 'kind' = 'adopt' then
      raise exception '분양 카드는 분양·홍보 글에만 붙일 수 있어요';
    end if;
    return new;
  end if;
  if not private.can_trade(new.author_id) then
    raise exception '분양·홍보 글은 앱을 시작한 지 24시간이 지나고 개체를 1마리 이상 등록한 뒤에 쓸 수 있어요';
  end if;
  if t is null or jsonb_typeof(t) <> 'object' or coalesce(t ->> 'kind', '') <> 'adopt'
     or coalesce(t ->> 'mode', '') not in ('sale', 'show') then
    raise exception '분양·홍보 글의 종류(분양 또는 홍보)를 골라 주세요';
  end if;

  s := coalesce(t -> 'seller', '{"type":"person"}'::jsonb);
  if s ->> 'type' = 'person' then
    v_seller := jsonb_build_object('type', 'person');
  elsif s ->> 'type' = 'biz' then
    if btrim(coalesce(s ->> 'name', '')) = '' or btrim(coalesce(s ->> 'rep', '')) = '' or btrim(coalesce(s ->> 'tel', '')) = ''
       or coalesce(s ->> 'brn', '') !~ '^\d{3}-\d{2}-\d{5}$' then
      raise exception '사업자 판매자는 상호·대표자·사업자등록번호·연락처를 모두 적어 주세요';
    end if;
    v_seller := jsonb_build_object(
      'type', 'biz',
      'name', left(btrim(s ->> 'name'), 40),
      'rep', left(btrim(s ->> 'rep'), 20),
      'brn', s ->> 'brn',
      'tel', left(btrim(s ->> 'tel'), 20),
      'permit', left(btrim(coalesce(s ->> 'permit', '')), 40));
  else
    raise exception '판매자 구분을 확인해 주세요';
  end if;
  if private.has_banned(concat_ws(' ', t ->> 'price', t ->> 'region', s ->> 'name', s ->> 'rep', s ->> 'permit')) then
    raise exception '사용할 수 없는 표현이 들어 있어요 · 운영정책을 확인해 주세요';
  end if;

  v_token := nullif(t ->> 'resume', '');
  if v_token is not null then
    select jsonb_build_object('code', a.code, 'name', a.name, 'species', a.species, 'sex', a.sex, 'morph', a.morph,
                              'hatch_date', a.hatch_date, 'photo_path', a.photo_path)
      into v_animal
      from public.animal_shares sh
      join public.animals a on a.id = sh.animal_id
     where sh.token = v_token and sh.owner_id = new.author_id and sh.revoked_at is null;
    if v_animal is null then
      raise exception '개체의 분양 이력서 링크를 확인해 주세요';
    end if;
  end if;

  new.attach := jsonb_build_object(
    'kind', 'adopt',
    'mode', t ->> 'mode',
    'status', case when t ->> 'mode' = 'sale' then 'open' end,
    'price', left(btrim(coalesce(t ->> 'price', '')), 20),
    'region', left(btrim(coalesce(t ->> 'region', '')), 20),
    'seller', v_seller,
    'resume', v_token,
    'animal', v_animal);
  return new;
end;
$$;

create trigger posts_adopt
  before insert on public.posts
  for each row execute function private.on_adopt_post();

-- 분양 상태 바꾸기 (글쓴이·운영자). 글은 화면에서 직접 고칠 수 없으므로 함수로만 바꾼다
create or replace function public.set_adopt_status(p_post uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  if p_status is null or p_status not in ('open', 'hold', 'done') then
    raise exception '분양 상태를 확인해 주세요';
  end if;
  update public.posts set attach = jsonb_set(attach, '{status}', to_jsonb(p_status))
   where id = p_post and cat = '분양·홍보' and attach ->> 'mode' = 'sale'
     and (author_id = auth.uid() or private.is_admin());
  if not found then
    raise exception '분양 글을 찾을 수 없어요';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 실행 권한
-- ─────────────────────────────────────────────────────────────
revoke all on function private.can_trade(uuid) from public, anon, authenticated;
revoke all on function private.on_adopt_post() from public, anon, authenticated;
revoke all on function public.share_animal(uuid) from public, anon;
revoke all on function public.unshare_animal(uuid) from public, anon;
revoke all on function public.set_adopt_status(uuid, text) from public, anon;
revoke all on function public.get_resume(text) from public;
grant execute on function public.share_animal(uuid) to authenticated;
grant execute on function public.unshare_animal(uuid) to authenticated;
grant execute on function public.set_adopt_status(uuid, text) to authenticated;
grant execute on function public.get_resume(text) to anon, authenticated;
