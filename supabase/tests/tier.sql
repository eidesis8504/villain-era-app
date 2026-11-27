-- 등급(Hz) 검사 (마이그레이션 tier): 항목별 세기, 상한과 바닥, 내 등급, 직접 고칠 수 없음, 이력서
-- 실행: Supabase MCP execute_sql. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
select set_config('t.u3', (select id::text from public.profiles where is_test order by created_at offset 2 limit 1), true);
select set_config('t.u4', (select id::text from public.profiles where is_test order by created_at offset 3 limit 1), true);
-- u1 철수·u2 영희·u4 민수: 3일 된 계정 / u3 새내기: 1시간 된 계정
delete from public.animals where owner_id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);
delete from public.usage_events where user_id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);
delete from public.notifications where user_id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);
update public.profiles set status = 'active', role = 'member', nickname = '철수', created_at = now() - interval '3 days' where id = current_setting('t.u1')::uuid;
update public.profiles set status = 'active', role = 'member', nickname = '영희', created_at = now() - interval '3 days' where id = current_setting('t.u2')::uuid;
update public.profiles set status = 'active', role = 'member', nickname = '새내기', created_at = now() - interval '1 hour' where id = current_setting('t.u3')::uuid;
update public.profiles set status = 'active', role = 'member', nickname = '민수', created_at = now() - interval '3 days' where id = current_setting('t.u4')::uuid;

-- ── 철수의 활동 만들기 ─────────────────────────────────────────
-- 개체 3마리: 기록 3건(센다) / 기록 1건(안 센다) / 분양 보낼 개체
insert into public.animals (owner_id, code, name) values
  (current_setting('t.u1')::uuid, 'VE-TIERTEST01', '기록 3건'),
  (current_setting('t.u1')::uuid, 'VE-TIERTEST02', '기록 1건'),
  (current_setting('t.u1')::uuid, 'VE-TIERTEST03', '분양 보낼 개체');
select set_config('t.a1', (select id::text from public.animals where code = 'VE-TIERTEST01'), true);
select set_config('t.a2', (select id::text from public.animals where code = 'VE-TIERTEST02'), true);
select set_config('t.a3', (select id::text from public.animals where code = 'VE-TIERTEST03'), true);
insert into public.weights (owner_id, animal_id, measured_on, grams) values
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, '2026-11-01', 40),
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, '2026-11-10', 41),
  (current_setting('t.u1')::uuid, current_setting('t.a2')::uuid, '2026-11-01', 30);
insert into public.feedings (owner_id, animal_id, fed_on, result) values
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, '2026-11-02', 'ate');
-- 앱을 연 날 5일, 두 달에 걸쳐
insert into public.usage_events (user_id, day, name) values
  (current_setting('t.u1')::uuid, '2026-10-05', 'open'), (current_setting('t.u1')::uuid, '2026-10-06', 'open'),
  (current_setting('t.u1')::uuid, '2026-11-01', 'open'), (current_setting('t.u1')::uuid, '2026-11-02', 'open'),
  (current_setting('t.u1')::uuid, '2026-11-03', 'open'), (current_setting('t.u1')::uuid, '2026-11-03', 'view:scan');
-- 글 3개(하나는 숨김)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.posts (cat, title, body, attach, media) values
  ('자유', '등급 시험 글 1', '본문', null, '[]'), ('자유', '등급 시험 글 2', '본문', null, '[]'), ('자유', '등급 시험 글 3', '본문', null, '[]');
reset role;
update public.posts set hidden = true where title = '등급 시험 글 3';
select set_config('t.p1', (select id::text from public.posts where title = '등급 시험 글 1'), true);
select set_config('t.p3', (select id::text from public.posts where title = '등급 시험 글 3'), true);
-- 영희의 질문에 철수가 답하고 채택됨
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.posts (cat, title, body, attach, media) values ('Q&A', '등급 시험 질문', '본문', null, '[]');
reset role;
select set_config('t.q1', (select id::text from public.posts where title = '등급 시험 질문'), true);
insert into public.comments (post_id, author_id, body, adopted) values
  (current_setting('t.q1')::uuid, current_setting('t.u1')::uuid, '채택될 답변', true),
  (current_setting('t.q1')::uuid, current_setting('t.u1')::uuid, '채택되지 않은 답변', false);
-- 좋아요: 영희(센다) · 새내기(하루가 안 된 계정이라 안 센다) · 철수 자신(안 센다) · 숨겨진 글의 좋아요(안 센다)
insert into public.likes (post_id, user_id) values
  (current_setting('t.p1')::uuid, current_setting('t.u2')::uuid),
  (current_setting('t.p1')::uuid, current_setting('t.u3')::uuid),
  (current_setting('t.p1')::uuid, current_setting('t.u1')::uuid),
  (current_setting('t.p3')::uuid, current_setting('t.u4')::uuid);
-- 분양 이전: 철수가 보내고 영희가 받음
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('t.code', (public.create_transfer(p_animal => current_setting('t.a3')::uuid, p_weights => false, p_lineage => false, p_clutches => false)).code, true);
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.claim_transfer(current_setting('t.code'));
reset role;
-- 신고: 같은 글에 대한 조치된 신고 2건(1건으로 센다) · 기각된 신고(안 센다) / 민수는 감점만 있다
insert into public.reports (reporter_id, target_kind, target_id, target_user, reason, status) values
  (current_setting('t.u2')::uuid, 'post', current_setting('t.p3')::uuid, current_setting('t.u1')::uuid, 'spam', 'actioned'),
  (current_setting('t.u4')::uuid, 'post', current_setting('t.p3')::uuid, current_setting('t.u1')::uuid, 'spam', 'actioned'),
  (current_setting('t.u2')::uuid, 'post', current_setting('t.p1')::uuid, current_setting('t.u1')::uuid, 'spam', 'dismissed'),
  (current_setting('t.u2')::uuid, 'user', current_setting('t.u4')::uuid, current_setting('t.u4')::uuid, 'abuse', 'actioned');
-- 영희: 앱을 연 날 200일 (상한 확인)
insert into public.usage_events (user_id, day, name)
select current_setting('t.u2')::uuid, current_date - g, 'open' from generate_series(0, 199) g;

-- ── 1. 항목별 세기 ─────────────────────────────────────────────
do $$
declare
  parts jsonb := private.tier_parts(current_setting('t.u1')::uuid);
  -- 항목: [개수, 점수]
  want jsonb := '{"posts":[2,10],"likes":[1,2],"adopted":[1,20],"days":[5,5],"months":[2,20],"transfers":[1,30],"animals":[1,15],"penalty":[1,-50]}';
  x jsonb;
begin
  assert jsonb_array_length(parts) = 8, '항목은 8개예요: ' || parts::text;
  assert (select string_agg(e->>'k', ',' order by o) from jsonb_array_elements(parts) with ordinality as t(e, o))
         = 'posts,likes,adopted,days,months,transfers,animals,penalty', '항목 순서가 달라요';
  for x in select * from jsonb_array_elements(parts) loop
    assert (x->>'n')::int = (want->(x->>'k')->>0)::int and (x->>'hz')::int = (want->(x->>'k')->>1)::int,
           (x->>'k') || ' 항목이 달라요: ' || x::text;
  end loop;
end $$;

-- ── 2. 상한 ───────────────────────────────────────────────────
do $$
declare d jsonb; m jsonb;
begin
  select e into d from jsonb_array_elements(private.tier_parts(current_setting('t.u2')::uuid)) e where e->>'k' = 'days';
  select e into m from jsonb_array_elements(private.tier_parts(current_setting('t.u2')::uuid)) e where e->>'k' = 'months';
  assert (d->>'n')::int = 200 and (d->>'hz')::int = 180 and (d->>'cap')::int = 180, '연 날은 180에서 멈춰요: ' || d::text;
  assert (m->>'hz')::int <= 120, '연 달은 120을 넘지 않아요: ' || m::text;
end $$;

-- ── 4. 내 등급: 합계와 내역, 내 hz 고치기 / 6. 직접 고칠 수 없음 / 3. 남의 내역은 볼 수 없음 ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare t jsonb := public.my_tier();
begin
  assert (t->>'hz')::int = 52, '철수의 합계는 52예요: ' || t::text;
  assert jsonb_array_length(t->'parts') = 8, '내역도 함께 돌려줘요';
  assert (select hz from public.profiles where id = current_setting('t.u1')::uuid) = 52, 'my_tier가 내 hz를 고쳐요';
  begin
    update public.profiles set hz = 999 where id = current_setting('t.u1')::uuid;
    raise exception 'SENTINEL 내 hz를 직접 고칠 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform private.tier_parts(current_setting('t.u2')::uuid);
    raise exception 'SENTINEL 남의 내역을 볼 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select hz from public.profiles where id = current_setting('t.u1')::uuid) = 52, '다른 회원에게는 합계가 보여요';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$ begin
  begin
    perform public.my_tier();
    raise exception 'SENTINEL 계정 없이 내 등급을 부를 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

-- ── 3. 바닥: 감점만 있는 회원 ─────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u4'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare t jsonb := public.my_tier();
begin
  assert (t->>'hz')::int = 0, '합계는 0 아래로 내려가지 않아요: ' || t::text;
  assert (select (e->>'hz')::int from jsonb_array_elements(t->'parts') e where e->>'k' = 'penalty') = -50, '감점은 내역에 보여요';
end $$;
reset role;

-- ── 5. 하루 계산 ──────────────────────────────────────────────
update public.profiles set hz = 0 where id = current_setting('t.u1')::uuid;
select private.refresh_tiers();
do $$ begin
  assert (select hz from public.profiles where id = current_setting('t.u1')::uuid) = 52, '하루 계산이 철수의 hz를 채워요';
  assert (select hz from public.profiles where id = current_setting('t.u2')::uuid) between 180 and 1000, '하루 계산이 영희의 hz를 채워요';
  assert (select hz from public.profiles where id = current_setting('t.u4')::uuid) = 0, '감점만 있으면 0';
end $$;

-- ── 7. 이력서에 등급 점수 / 8. 예약 작업 ──────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('t.tok', public.share_animal(current_setting('t.a1')::uuid), true);
reset role;
do $$ begin
  assert (public.get_resume(current_setting('t.tok'))->'owner'->>'hz')::int = 52, '이력서의 분양자 정보에 hz가 있어요';
  assert (public.get_resume(current_setting('t.tok'))->'owner'->>'nickname') = '철수', '이력서의 다른 정보는 그대로예요';
  assert exists (select 1 from cron.job where jobname = 'villain-era-tiers'), '하루 한 번 계산하는 예약 작업이 있어요';
end $$;

rollback;
