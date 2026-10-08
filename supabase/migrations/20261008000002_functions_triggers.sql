-- VILLAIN ERA · 서버 함수(RPC)와 트리거

-- ─────────────────────────────────────────────────────────────
-- 공통 유틸
-- ─────────────────────────────────────────────────────────────

-- 혼동되는 문자(0/O, 1/I)를 뺀 무작위 코드
create or replace function private.random_code(n int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(n);
  out text := '';
begin
  for i in 0 .. n - 1 loop
    out := out || substr(chars, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return out;
end;
$$;

-- 개체 ID: VE- + 영문 대문자·숫자 10자리 (문자·숫자 각각 1개 이상, 사육자 안에서 유일)
create or replace function private.gen_animal_code(p_owner uuid)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  b bytea;
  c text;
begin
  loop
    b := extensions.gen_random_bytes(10);
    c := '';
    for i in 0 .. 9 loop
      c := c || substr(chars, (get_byte(b, i) % 36) + 1, 1);
    end loop;
    if c ~ '[A-Z]' and c ~ '[0-9]'
       and not exists (select 1 from public.animals where owner_id = p_owner and code = 'VE-' || c) then
      return 'VE-' || c;
    end if;
  end loop;
end;
$$;

-- 알림 1건 생성 (푸시 대상 종류이고 구독이 있으면 발송 대기열에 올린다)
create or replace function private.notify(
  p_user uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_link text default null,
  p_dedupe text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key, push_state)
  values (
    p_user, p_kind, p_title, coalesce(p_body, ''), p_link, p_dedupe,
    case
      when p_kind in ('todo', 'comment', 'notice', 'transfer')
           and exists (select 1 from public.push_subscriptions s where s.user_id = p_user)
      then 'pending' else 'none'
    end
  )
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 가입 · 초대 코드
-- ─────────────────────────────────────────────────────────────

-- 소셜 로그인으로 auth.users가 생기면 '대기(pending)' 프로필을 만든다
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- 초대 코드 입력 → 회원 활성화
create or replace function public.redeem_invite(p_code text, p_nickname text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_nick text := btrim(coalesce(p_nickname, ''));
  inv public.invite_codes;
  prof public.profiles;
begin
  if me is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  select * into prof from public.profiles where id = me for update;
  if not found then
    raise exception '프로필을 찾을 수 없어요 — 다시 로그인해 주세요';
  end if;
  if prof.status = 'active' then
    return prof;
  end if;
  if prof.status = 'blocked' then
    raise exception '이용이 제한된 계정이에요';
  end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 12 then
    raise exception '닉네임은 2–12자로 입력해 주세요';
  end if;

  select * into inv from public.invite_codes where code = v_code for update;
  if not found or not inv.active then
    raise exception '초대 코드를 확인해 주세요';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception '만료된 초대 코드예요';
  end if;
  if inv.uses >= inv.max_uses then
    raise exception '사용 횟수가 끝난 초대 코드예요';
  end if;

  update public.invite_codes set uses = uses + 1 where code = inv.code;
  insert into public.invite_redemptions (code, user_id) values (inv.code, me) on conflict do nothing;
  update public.profiles
     set nickname = v_nick, status = 'active', role = inv.role, activated_at = now()
   where id = me
   returning * into prof;
  return prof;
end;
$$;

-- 관리자: 초대 코드 발급
create or replace function public.create_invite(
  p_role text default 'member',
  p_max_uses int default 1,
  p_days int default 30,
  p_note text default ''
)
returns public.invite_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invite_codes;
  c text;
begin
  if not private.is_admin() then
    raise exception '관리자만 초대 코드를 만들 수 있어요';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception '역할을 확인해 주세요';
  end if;
  loop
    c := private.random_code(8);
    exit when not exists (select 1 from public.invite_codes where code = c);
  end loop;
  insert into public.invite_codes (code, role, max_uses, expires_at, note, created_by)
  values (
    c, p_role, greatest(1, least(coalesce(p_max_uses, 1), 1000)),
    case when coalesce(p_days, 0) > 0 then now() + make_interval(days => p_days) end,
    left(coalesce(p_note, ''), 60), auth.uid()
  )
  returning * into inv;
  return inv;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 사육 데이터
-- ─────────────────────────────────────────────────────────────

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger animals_touch_updated_at
  before update on public.animals
  for each row execute function private.touch_updated_at();

-- 새 체중이 직전 측정보다 줄면 알림함에 경고를 남긴다
create or replace function private.on_weight_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prev record;
  a public.animals;
  diff numeric;
begin
  select measured_on, grams into prev
    from public.weights
   where animal_id = new.animal_id and measured_on < new.measured_on
   order by measured_on desc
   limit 1;
  if not found then
    return new;
  end if;
  diff := round(new.grams - prev.grams, 1);
  if diff < 0 then
    select * into a from public.animals where id = new.animal_id;
    perform private.notify(
      new.owner_id, 'weight',
      coalesce(nullif(a.name, ''), a.code) || ' 체중이 줄었어요',
      '직전 측정 대비 −' || to_char(abs(diff), 'FM999990.0') || ' g',
      '/animals/' || new.animal_id || '/weight'
    );
  end if;
  return new;
end;
$$;

create trigger weights_after_insert
  after insert on public.weights
  for each row execute function private.on_weight_insert();

-- 부화·폐사 기록: 부화 수만큼 개체를 자동 등록하고 부모를 연결한다
create or replace function public.record_hatch(
  p_clutch uuid,
  p_hatched int,
  p_dead int,
  p_date date,
  p_note text default ''
)
returns setof public.animals
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clutches;
  dam public.animals;
  inc int;
  ids uuid[] := '{}';
  nid uuid;
begin
  if not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  select * into c from public.clutches where id = p_clutch and owner_id = auth.uid() for update;
  if not found then
    raise exception '산란 기록을 찾을 수 없어요';
  end if;
  inc := c.fertile - c.dead - (select count(*) from public.animals where clutch_id = c.id);
  if coalesce(p_hatched, 0) < 0 or coalesce(p_dead, 0) < 0 or coalesce(p_hatched, 0) + coalesce(p_dead, 0) = 0 then
    raise exception '부화 또는 폐사 수를 입력해 주세요';
  end if;
  if p_hatched + p_dead > inc then
    raise exception '인큐 중인 알보다 많아요';
  end if;
  if p_date is null or p_date < c.laid_on then
    raise exception '날짜를 확인해 주세요';
  end if;

  select * into dam from public.animals where id = c.dam_id;
  for i in 1 .. p_hatched loop
    insert into public.animals (owner_id, code, species, sex, morph, hatch_date, status, sire_id, dam_id, clutch_id)
    values (c.owner_id, private.gen_animal_code(c.owner_id), dam.species, 'U', '미정', p_date, 'keeping', c.sire_id, c.dam_id, c.id)
    returning id into nid;
    ids := ids || nid;
  end loop;

  if p_dead > 0 then
    update public.clutches
       set dead = dead + p_dead, dead_on = p_date,
           dead_note = coalesce(nullif(btrim(p_note), ''), dead_note)
     where id = c.id;
  end if;

  if p_hatched > 0 then
    perform private.notify(
      c.owner_id, 'hatch',
      c.seq || '차 부화 · ' || p_hatched || '마리 자동 등록',
      (select string_agg(code, ', ' order by code) from public.animals where id = any (ids)),
      '/clutch/' || c.dam_id
    );
  end if;

  return query select * from public.animals where id = any (ids) order by code;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 커뮤니티
-- ─────────────────────────────────────────────────────────────

create or replace function private.on_comment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.posts;
  v_who text;
  v_badge text;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id returning * into p;
    if p.author_id <> new.author_id then
      select pr.nickname, case when pr.role = 'admin' then '운영자' else pr.badge end
        into v_who, v_badge
        from public.profiles pr where pr.id = new.author_id;
      perform private.notify(
        p.author_id, 'comment',
        case when p.cat = 'Q&A' then '내 질문에 답변이 달렸어요' else '내 글에 댓글이 달렸어요' end,
        coalesce(v_who, '회원') || coalesce(' · ' || v_badge, '') || ' — ' || left(new.body, 40),
        '/community/' || p.id
      );
    end if;
    return new;
  else
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function private.on_comment_change();
create trigger comments_after_delete
  after delete on public.comments
  for each row execute function private.on_comment_change();

create or replace function private.on_like_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  else
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$$;

create trigger likes_after_insert
  after insert on public.likes
  for each row execute function private.on_like_change();
create trigger likes_after_delete
  after delete on public.likes
  for each row execute function private.on_like_change();

-- Q&A 답변 채택: 질문 작성자만, 한 번만, 내 답변은 불가
create or replace function public.adopt_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cm public.comments;
  p public.posts;
begin
  select * into cm from public.comments where id = p_comment;
  if not found then
    raise exception '답변을 찾을 수 없어요';
  end if;
  select * into p from public.posts where id = cm.post_id for update;
  if p.author_id <> auth.uid() then
    raise exception '질문 작성자만 채택할 수 있어요';
  end if;
  if p.cat <> 'Q&A' then
    raise exception 'Q&A 글에서만 채택할 수 있어요';
  end if;
  if cm.author_id = auth.uid() then
    raise exception '내 답변은 채택할 수 없어요';
  end if;
  if exists (select 1 from public.comments where post_id = p.id and adopted) then
    raise exception '이미 채택한 답변이 있어요';
  end if;
  update public.comments set adopted = true where id = cm.id;
  perform private.notify(cm.author_id, 'comment', '내 답변이 채택됐어요', left(p.title, 60), '/community/' || p.id);
end;
$$;

-- 공지 등록 시 모든 회원 알림함에 넣는다
create or replace function private.on_notice_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  for m in select id from public.profiles where status = 'active' and id is distinct from new.author_id loop
    perform private.notify(m.id, 'notice', '공지', new.title, '/notices', 'notice:' || new.id);
  end loop;
  return new;
end;
$$;

create trigger notices_after_insert
  after insert on public.notices
  for each row execute function private.on_notice_insert();

-- ─────────────────────────────────────────────────────────────
-- 분양 이전 (보내는 쪽 스냅샷 → 받는 쪽 계정에 복사)
-- ─────────────────────────────────────────────────────────────

-- 개체 1마리와 조상(depth 단계)을 JSON으로 묶는다
create or replace function private.animal_node(p_id uuid, p_depth int)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  a public.animals;
begin
  if p_id is null then
    return null;
  end if;
  select * into a from public.animals where id = p_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'code', a.code, 'species', a.species, 'name', a.name, 'sex', a.sex,
    'morph', a.morph, 'hatch_date', a.hatch_date,
    'sire', case when p_depth > 0 then private.animal_node(a.sire_id, p_depth - 1) end,
    'dam', case when p_depth > 0 then private.animal_node(a.dam_id, p_depth - 1) end
  );
end;
$$;

create or replace function public.create_transfer(
  p_animal uuid,
  p_weights boolean,
  p_lineage boolean,
  p_clutches boolean,
  p_label text default ''
)
returns public.transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.animals;
  t public.transfers;
  snap jsonb;
  c text;
  csum jsonb;
begin
  if not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  select * into a from public.animals where id = p_animal and owner_id = auth.uid() for update;
  if not found then
    raise exception '개체를 찾을 수 없어요';
  end if;
  if a.status <> 'keeping' then
    raise exception '사육 중인 개체만 분양 이전할 수 있어요';
  end if;

  if p_clutches then
    select jsonb_build_object(
             'n', count(*), 'eggs', coalesce(sum(eggs), 0), 'fert', coalesce(sum(fertile), 0),
             'dead', coalesce(sum(dead), 0),
             'hatched', (select count(*) from public.animals k where k.clutch_id in
                          (select id from public.clutches where dam_id = a.id or sire_id = a.id)))
      into csum
      from public.clutches where dam_id = a.id or sire_id = a.id;
    if (csum ->> 'n')::int = 0 then
      csum := null;
    end if;
  end if;

  snap := jsonb_build_object(
    'animal', jsonb_build_object('code', a.code, 'species', a.species, 'name', a.name, 'sex', a.sex,
                                 'morph', a.morph, 'hatch_date', a.hatch_date),
    'from', (select nickname from public.profiles where id = a.owner_id),
    'sire', case when p_lineage then private.animal_node(a.sire_id, 1) end,
    'dam', case when p_lineage then private.animal_node(a.dam_id, 1) end,
    'weights', case when p_weights then coalesce(
                 (select jsonb_agg(jsonb_build_object('d', measured_on, 'g', grams) order by measured_on)
                    from public.weights where animal_id = a.id), '[]'::jsonb) else '[]'::jsonb end,
    'clutches', csum
  );

  loop
    c := private.random_code(8);
    exit when not exists (select 1 from public.transfers where code = c);
  end loop;

  insert into public.transfers (owner_id, animal_id, code, recipient_label, include_weights, include_lineage, include_clutches, snapshot)
  values (a.owner_id, a.id, c, left(btrim(coalesce(p_label, '')), 30), p_weights, p_lineage, p_clutches, snap)
  returning * into t;

  update public.animals set status = 'sold' where id = a.id;
  return t;
end;
$$;

create or replace function public.cancel_transfer(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transfers;
begin
  select * into t from public.transfers where id = p_id and owner_id = auth.uid() for update;
  if not found then
    raise exception '분양 기록을 찾을 수 없어요';
  end if;
  if t.claimed_at is not null then
    raise exception '이미 상대방이 받은 분양이라 취소할 수 없어요';
  end if;
  if t.canceled_at is not null then
    return;
  end if;
  update public.transfers set canceled_at = now() where id = t.id;
  update public.animals set status = 'keeping' where id = t.animal_id and status = 'sold';
end;
$$;

-- 받는 사람이 코드를 확인할 때 보여줄 요약
create or replace function public.preview_transfer(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.transfers;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  select * into t from public.transfers where code = v_code;
  if not found then
    raise exception '분양 코드를 찾을 수 없어요';
  end if;
  return jsonb_build_object(
    'code', t.code,
    'animal', t.snapshot -> 'animal',
    'from', t.snapshot ->> 'from',
    'weights', jsonb_array_length(coalesce(t.snapshot -> 'weights', '[]'::jsonb)),
    'lineage', t.include_lineage,
    'clutches', t.snapshot -> 'clutches',
    'mine', t.owner_id = auth.uid(),
    'state', case
      when t.canceled_at is not null then 'canceled'
      when t.claimed_at is not null then 'claimed'
      when t.expires_at < now() then 'expired'
      else 'open' end,
    'expires_at', t.expires_at
  );
end;
$$;

-- 스냅샷의 조상 노드를 받는 사람 계정에 '외부' 개체로 만든다 (같은 ID가 있으면 재사용)
create or replace function private.ensure_external(p_owner uuid, p_node jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  existing uuid;
  sire uuid;
  dam uuid;
  nid uuid;
begin
  if p_node is null or jsonb_typeof(p_node) <> 'object' then
    return null;
  end if;
  select id into existing from public.animals where owner_id = p_owner and code = p_node ->> 'code';
  if existing is not null then
    return existing;
  end if;
  sire := private.ensure_external(p_owner, p_node -> 'sire');
  dam := private.ensure_external(p_owner, p_node -> 'dam');
  insert into public.animals (owner_id, code, species, name, sex, morph, hatch_date, status, sire_id, dam_id)
  values (
    p_owner, p_node ->> 'code', coalesce(p_node ->> 'species', '크레스티드게코'), coalesce(p_node ->> 'name', ''),
    coalesce(p_node ->> 'sex', 'U'), coalesce(p_node ->> 'morph', ''), (p_node ->> 'hatch_date')::date,
    'external', sire, dam
  )
  returning id into nid;
  return nid;
end;
$$;

create or replace function public.claim_transfer(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  t public.transfers;
  s jsonb;
  new_code text;
  sire uuid;
  dam uuid;
  nid uuid;
  items text[] := '{}';
begin
  if not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  select * into t from public.transfers where code = v_code for update;
  if not found then
    raise exception '분양 코드를 찾을 수 없어요';
  end if;
  if t.owner_id = me then
    raise exception '내가 만든 분양 코드는 받을 수 없어요';
  end if;
  if t.canceled_at is not null then
    raise exception '취소된 분양 코드예요';
  end if;
  if t.claimed_at is not null then
    raise exception '이미 사용된 분양 코드예요';
  end if;
  if t.expires_at < now() then
    raise exception '만료된 분양 코드예요';
  end if;

  s := t.snapshot;
  if t.include_lineage then
    sire := private.ensure_external(me, s -> 'sire');
    dam := private.ensure_external(me, s -> 'dam');
    items := items || '혈통 정보'::text;
  end if;

  new_code := s -> 'animal' ->> 'code';
  if exists (select 1 from public.animals where owner_id = me and code = new_code) then
    new_code := private.gen_animal_code(me);
  end if;
  if t.include_weights then
    items := items || '체중 기록'::text;
  end if;
  if t.include_clutches and s -> 'clutches' is not null and jsonb_typeof(s -> 'clutches') = 'object' then
    items := items || '산란 기록'::text;
  end if;

  insert into public.animals (owner_id, code, species, name, sex, morph, hatch_date, status, sire_id, dam_id, origin)
  values (
    me, new_code, coalesce(s -> 'animal' ->> 'species', '크레스티드게코'), coalesce(s -> 'animal' ->> 'name', ''),
    coalesce(s -> 'animal' ->> 'sex', 'U'), coalesce(s -> 'animal' ->> 'morph', ''),
    (s -> 'animal' ->> 'hatch_date')::date, 'keeping', sire, dam,
    jsonb_build_object(
      'from', s ->> 'from', 'transfer_code', t.code, 'received_on', current_date,
      'original_code', s -> 'animal' ->> 'code',
      'items', coalesce(array_to_string(items, ', '), ''),
      'clutches', case when t.include_clutches then s -> 'clutches' end
    )
  )
  returning id into nid;

  if t.include_weights then
    insert into public.weights (owner_id, animal_id, measured_on, grams)
    select me, nid, (w ->> 'd')::date, (w ->> 'g')::numeric
      from jsonb_array_elements(coalesce(s -> 'weights', '[]'::jsonb)) w
    on conflict do nothing;
  end if;

  update public.transfers set claimed_by = me, claimed_at = now(), claimed_animal_id = nid where id = t.id;

  perform private.notify(
    t.owner_id, 'transfer', '분양 개체 인수 완료',
    coalesce((select nickname from public.profiles where id = me), '회원') || '님이 '
      || coalesce(nullif(s -> 'animal' ->> 'name', ''), s -> 'animal' ->> 'code') || '을(를) 받았어요',
    case when t.animal_id is not null then '/animals/' || t.animal_id end
  );
  return nid;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 웹 푸시 구독 등록 (같은 브라우저를 다른 계정이 쓰면 소유자를 바꾼다)
-- ─────────────────────────────────────────────────────────────
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_endpoint !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception '알림 구독 정보가 올바르지 않아요';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, ua)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_ua, ''), 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        ua = excluded.ua, created_at = now();
end;
$$;

-- 브라우저 구독에 필요한 VAPID 공개키 (발송 함수가 처음 실행될 때 Vault에 생성된다)
create or replace function public.get_vapid_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key' limit 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- 실행 권한: 로그인한 사용자에게만
-- ─────────────────────────────────────────────────────────────
revoke all on function public.redeem_invite(text, text) from public, anon;
revoke all on function public.create_invite(text, int, int, text) from public, anon;
revoke all on function public.record_hatch(uuid, int, int, date, text) from public, anon;
revoke all on function public.adopt_comment(uuid) from public, anon;
revoke all on function public.create_transfer(uuid, boolean, boolean, boolean, text) from public, anon;
revoke all on function public.cancel_transfer(uuid) from public, anon;
revoke all on function public.preview_transfer(text) from public, anon;
revoke all on function public.claim_transfer(text) from public, anon;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.get_vapid_public_key() from public, anon;

grant execute on function public.redeem_invite(text, text) to authenticated;
grant execute on function public.create_invite(text, int, int, text) to authenticated;
grant execute on function public.record_hatch(uuid, int, int, date, text) to authenticated;
grant execute on function public.adopt_comment(uuid) to authenticated;
grant execute on function public.create_transfer(uuid, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.cancel_transfer(uuid) to authenticated;
grant execute on function public.preview_transfer(text) to authenticated;
grant execute on function public.claim_transfer(text) to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.get_vapid_public_key() to authenticated;

revoke all on all functions in schema private from public, anon;
grant execute on function private.is_member(), private.is_admin() to authenticated;
