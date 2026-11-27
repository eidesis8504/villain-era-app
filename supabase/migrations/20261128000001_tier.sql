-- VILLAIN ERA · 등급(Hz) (2026-11-28)
-- 앱 안 활동으로 점수(Hz)를 매긴다. 무엇을 몇 점으로 세는지는 private.tier_parts 한 곳에만 있다.
-- 합계는 profiles.hz에 두고 하루에 한 번 다시 계산한다. 사용자는 이 열을 고칠 수 없다
-- (authenticated에게는 닉네임·소개 등 정해진 열의 UPDATE 권한만 있다).
-- 등급 이름과 기준 점수는 앱 코드(src/lib/tier.ts)에 있다.
-- 추가형 변경이다: 지금 운영 중인 화면은 그대로 동작한다.

alter table public.profiles add column hz integer not null default 0 check (hz between 0 and 1000);

-- ─────────────────────────────────────────────────────────────
-- 점수 내역: [{k, n(개수), unit(1개당 점수), cap(상한), hz(점수)}, …]
--   홍보·인지도: posts 5×20 · likes 2×100 · adopted 20×5
--   활동 기간:   days 1×180 · months 10×12
--   신뢰도:      transfers 30×5 · animals 15×10 · penalty −50(상한 없음)
-- 더하는 항목의 상한을 모두 합치면 1000이다.
-- ─────────────────────────────────────────────────────────────
create or replace function private.tier_parts(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'k', v.k, 'n', v.n, 'unit', v.unit, 'cap', v.cap,
           'hz', case when v.cap is null then v.n * v.unit else least(v.n * v.unit, v.cap) end) order by v.ord), '[]'::jsonb)
    from (values
      -- 내가 쓴 글 (숨겨진 글 제외)
      (1, 'posts', (select count(*) from public.posts p where p.author_id = p_user and not p.hidden), 5, 100),
      -- 내 글이 받은 좋아요 (내가 누른 것, 시작한 지 하루가 안 된 회원이 누른 것 제외)
      (2, 'likes', (select count(*) from public.likes l
                      join public.posts p on p.id = l.post_id
                      join public.profiles lp on lp.id = l.user_id
                     where p.author_id = p_user and not p.hidden and l.user_id <> p_user
                       and lp.status = 'active' and lp.created_at < now() - interval '1 day'), 2, 200),
      -- 채택된 내 답변
      (3, 'adopted', (select count(*) from public.comments c
                        join public.posts p on p.id = c.post_id
                       where c.author_id = p_user and c.adopted and not c.hidden and p.author_id <> p_user), 20, 100),
      -- 앱을 연 날 수 · 연 달 수
      (4, 'days', (select count(*) from public.usage_events e where e.user_id = p_user and e.name = 'open'), 1, 180),
      (5, 'months', (select count(distinct date_trunc('month', e.day)) from public.usage_events e
                      where e.user_id = p_user and e.name = 'open'), 10, 120),
      -- 내가 보낸 분양 이전을 실제로 받은 서로 다른 회원 수
      (6, 'transfers', (select count(distinct t.claimed_by) from public.transfers t
                         where t.owner_id = p_user and t.claimed_at is not null and t.claimed_by <> p_user), 30, 150),
      -- 체중·급여 기록이 합쳐 3건 이상인 내 개체 수
      (7, 'animals', (select count(*) from public.animals a
                       where a.owner_id = p_user and a.status <> 'external'
                         and (select count(*) from public.weights w where w.animal_id = a.id)
                           + (select count(*) from public.feedings f where f.animal_id = a.id) >= 3), 15, 150),
      -- 운영자가 조치한 나에 대한 신고 (같은 대상은 1건)
      (8, 'penalty', (select count(distinct (r.target_kind, r.target_id)) from public.reports r
                       where r.target_user = p_user and r.status = 'actioned'), -50, null)
    ) as v(ord, k, n, unit, cap);
$$;

-- 내역의 합계: 0 이상 1000 이하
create or replace function private.tier_total(p_parts jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(1000, greatest(0, coalesce((select sum((e->>'hz')::int) from jsonb_array_elements(p_parts) e), 0)))::int;
$$;

-- 하루 계산: 이용 중인 회원 모두의 hz
create or replace function private.refresh_tiers()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
     set hz = t.hz
    from (select id, private.tier_total(private.tier_parts(id)) as hz from public.profiles where status = 'active') t
   where p.id = t.id and p.hz <> t.hz;
$$;

-- 내 등급: 합계와 내역. 내 hz도 지금 값으로 고친다 (내역은 본인만 본다)
create or replace function public.my_tier()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_parts jsonb;
  v_hz integer;
begin
  if me is null or not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  v_parts := private.tier_parts(me);
  v_hz := private.tier_total(v_parts);
  update public.profiles set hz = v_hz where id = me and hz <> v_hz;
  return jsonb_build_object('hz', v_hz, 'parts', v_parts);
end;
$$;

revoke all on function private.tier_parts(uuid), private.tier_total(jsonb), private.refresh_tiers() from public, anon, authenticated;
revoke all on function public.my_tier() from public, anon;
grant execute on function public.my_tier() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 분양 이력서: 분양자 정보에 hz를 더한다 (그 밖의 본문은 adopt_board와 같다)
-- ─────────────────────────────────────────────────────────────
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
                                'since', (p.created_at at time zone 'Asia/Seoul')::date,
                                'hz', p.hz),
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
-- 하루 한 번 (한국 시간 09:05) 다시 계산 · 지금 한 번 계산
-- ─────────────────────────────────────────────────────────────
select cron.schedule('villain-era-tiers', '5 0 * * *', $$ select private.refresh_tiers(); $$);
select private.refresh_tiers();
