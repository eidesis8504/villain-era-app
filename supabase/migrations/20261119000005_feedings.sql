-- VILLAIN ERA · 급여 기록 + 거식 추적 (2026-11-19, 리서치 1순위)
-- 개체별 급여 기록, 연속 거부 알림, 개체별 급여 주기, 분양 이전 시 급여 기록 함께 전달.

-- ─────────────────────────────────────────────────────────────
-- 급여 기록
-- ─────────────────────────────────────────────────────────────
create table public.feedings (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  animal_id uuid not null,
  fed_on date not null,
  result text not null check (result in ('ate', 'partial', 'refused', 'unknown')),
  food text not null default '' check (char_length(food) <= 30),
  amount text not null default '' check (char_length(amount) <= 20),
  note text not null default '' check (char_length(note) <= 100),
  created_at timestamptz not null default now(),
  foreign key (owner_id, animal_id) references public.animals (owner_id, id) on delete cascade
);
create index feedings_owner_animal_day_idx on public.feedings (owner_id, animal_id, fed_on desc);
create index feedings_animal_day_idx on public.feedings (animal_id, fed_on);

-- 개체별 급여 주기(일). 비우면 '급여 기록 없음' 알림을 보내지 않는다
alter table public.animals add column feed_every_days smallint check (feed_every_days is null or feed_every_days between 1 and 60);

revoke all on public.feedings from anon;
alter table public.feedings enable row level security;
create policy "feedings_select_own" on public.feedings for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "feedings_insert_own" on public.feedings for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "feedings_update_own" on public.feedings for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "feedings_delete_own" on public.feedings for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

-- ─────────────────────────────────────────────────────────────
-- 알림 종류 확장 (급여·건강) + 푸시 대상 확장 (급여·번식·건강)
-- ─────────────────────────────────────────────────────────────
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('todo', 'weight', 'comment', 'hatch', 'notice', 'transfer', 'system', 'feeding', 'health'));

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
      when p_kind in ('todo', 'comment', 'notice', 'transfer', 'feeding', 'hatch', 'health')
           and exists (select 1 from public.push_subscriptions s where s.user_id = p_user)
      then 'pending' else 'none'
    end
  )
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 연속 거부 알림: 마지막 '먹음·일부' 이후 거부가 3번 이상이면 횟수마다 1번
-- (분양 이전으로 기록을 복사할 때는 알리지 않는다)
-- ─────────────────────────────────────────────────────────────
create or replace function private.on_feeding_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  anchor date;
  streak int;
  a public.animals;
begin
  if new.result <> 'refused' or coalesce(current_setting('ve.bulk_copy', true), '') = 'on' then
    return new;
  end if;
  select max(fed_on) into anchor
    from public.feedings
   where animal_id = new.animal_id and result in ('ate', 'partial');
  select count(*) into streak
    from public.feedings
   where animal_id = new.animal_id and result = 'refused' and (anchor is null or fed_on > anchor);
  if streak >= 3 then
    select * into a from public.animals where id = new.animal_id;
    perform private.notify(
      new.owner_id, 'feeding',
      coalesce(nullif(a.name, ''), a.code) || ' 연속 ' || streak || '회 거부',
      '체중과 건강 상태를 함께 확인해 보세요',
      '/animals/' || new.animal_id,
      'feed-refuse:' || new.animal_id || ':' || coalesce(anchor::text, 'none') || ':' || streak
    );
  end if;
  return new;
end;
$$;

create trigger feedings_after_insert
  after insert on public.feedings
  for each row execute function private.on_feeding_insert();

-- ─────────────────────────────────────────────────────────────
-- 분양 이전: '체중 기록' 옵션에 급여 기록도 함께 (함수 인자는 그대로 — 기존 화면 호환)
-- ─────────────────────────────────────────────────────────────
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
    'feedings', case when p_weights then coalesce(
                 (select jsonb_agg(jsonb_build_object('d', fed_on, 'r', result, 'f', food, 'a', amount) order by fed_on, id)
                    from public.feedings where animal_id = a.id), '[]'::jsonb) else '[]'::jsonb end,
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
    items := items || (case when jsonb_array_length(coalesce(s -> 'feedings', '[]'::jsonb)) > 0
                            then '체중·급여 기록' else '체중 기록' end)::text;
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
    -- 복사한 기록으로는 거부 알림을 만들지 않는다
    perform set_config('ve.bulk_copy', 'on', true);
    insert into public.feedings (owner_id, animal_id, fed_on, result, food, amount)
    select me, nid, (x ->> 'd')::date, x ->> 'r', coalesce(x ->> 'f', ''), coalesce(x ->> 'a', '')
      from jsonb_array_elements(coalesce(s -> 'feedings', '[]'::jsonb)) x;
    perform set_config('ve.bulk_copy', 'off', true);
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

revoke all on function private.on_feeding_insert() from public, anon, authenticated;
