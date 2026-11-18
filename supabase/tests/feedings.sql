-- 급여 기록 검사 (마이그레이션 feedings): 연속 거부 알림, 본인만 접근, 분양 이전 포함, 기존 호출 호환. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
update public.profiles set status = 'active' where id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid);

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.animals (code, name, feed_every_days) values ('VE-FEEDTEST1', '급여테스트', 2);
reset role;
select set_config('t.a1', (select id::text from public.animals where owner_id = current_setting('t.u1')::uuid and code = 'VE-FEEDTEST1'), true);

-- 거부 3번 → 알림 1개
set local role authenticated;
insert into public.feedings (animal_id, fed_on, result, food) values
  (current_setting('t.a1')::uuid, '2026-11-01', 'ate', '귀뚜라미'),
  (current_setting('t.a1')::uuid, '2026-11-03', 'refused', '귀뚜라미'),
  (current_setting('t.a1')::uuid, '2026-11-05', 'unknown', ''),
  (current_setting('t.a1')::uuid, '2026-11-07', 'refused', '귀뚜라미');
insert into public.feedings (animal_id, fed_on, result) values (current_setting('t.a1')::uuid, '2026-11-09', 'refused');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = current_setting('t.u1')::uuid and kind = 'feeding') = 1,
    '연속 거부 3회에서 알림 1개';
  assert (select title from public.notifications where user_id = current_setting('t.u1')::uuid and kind = 'feeding') like '%연속 3회 거부',
    '알림 제목에 횟수';
end $$;

-- 4번째 거부 → 새 알림 1개 (같은 횟수는 중복 없음)
set local role authenticated;
insert into public.feedings (animal_id, fed_on, result) values (current_setting('t.a1')::uuid, '2026-11-11', 'refused');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = current_setting('t.u1')::uuid and kind = 'feeding') = 2, '4회째 알림';
end $$;

-- 먹은 뒤 다시 3번 거부 → 새 묶음의 알림
set local role authenticated;
insert into public.feedings (animal_id, fed_on, result) values
  (current_setting('t.a1')::uuid, '2026-11-12', 'ate'),
  (current_setting('t.a1')::uuid, '2026-11-13', 'refused'),
  (current_setting('t.a1')::uuid, '2026-11-14', 'refused'),
  (current_setting('t.a1')::uuid, '2026-11-15', 'refused');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = current_setting('t.u1')::uuid and kind = 'feeding') = 3, '새 묶음 알림';
end $$;

-- 다른 사용자는 조회·수정할 수 없다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  assert (select count(*) from public.feedings) = 0, '다른 사용자의 급여 기록이 보이면 안 돼요';
  update public.feedings set note = 'x' where animal_id = current_setting('t.a1')::uuid;
  get diagnostics n = row_count;
  assert n = 0, '다른 사용자가 수정하면 안 돼요';
end $$;
reset role;

-- 분양 이전: 체중·급여 기록 함께 (기존 인자 그대로 호출 = legacy_insert_paths)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.weights (animal_id, measured_on, grams) values (current_setting('t.a1')::uuid, '2026-11-10', 41.5)
  on conflict (animal_id, measured_on) do update set grams = excluded.grams;
select set_config('t.code', (select code from public.create_transfer(current_setting('t.a1')::uuid, true, true, true, '테스트')), true);
reset role;
do $$ begin
  assert jsonb_array_length((select snapshot -> 'feedings' from public.transfers where code = current_setting('t.code'))) = 10,
    '스냅샷에 급여 기록 10건';
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('t.a2', public.claim_transfer(current_setting('t.code'))::text, true);
reset role;
do $$ begin
  assert (select count(*) from public.feedings where owner_id = current_setting('t.u2')::uuid and animal_id = current_setting('t.a2')::uuid) = 10,
    '받은 사람에게 급여 기록 10건 복사';
  assert (select count(*) from public.weights where owner_id = current_setting('t.u2')::uuid and animal_id = current_setting('t.a2')::uuid) = 1,
    '체중 기록도 복사';
  assert (select count(*) from public.notifications where user_id = current_setting('t.u2')::uuid and kind = 'feeding') = 0,
    '복사한 기록으로는 거부 알림을 만들지 않아요';
end $$;

rollback;
