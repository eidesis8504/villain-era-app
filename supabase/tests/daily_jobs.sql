-- 하루 점검 알림 검사 (마이그레이션 daily_jobs): 급여 공백·재진 하루 전·부화 D-7·산란 D-3, 두 번 돌려도 알림은 1번. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
update public.profiles set status = 'active', tz = 'Asia/Seoul' where id = current_setting('t.u1')::uuid;
select set_config('t.today', (now() at time zone 'Asia/Seoul')::date::text, true);
delete from public.notifications where user_id = current_setting('t.u1')::uuid;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.animals (code, name, sex, feed_every_days) values
  ('VE-DAILYGAP1', '공백', 'U', 1),     -- 5일 전 급여, 주기 1일 → 알림
  ('VE-DAILYOK01', '정상', 'U', 3),     -- 2일 전 급여, 주기 3일 → 없음
  ('VE-DAILYFEM1', '어미', 'F', null),
  ('VE-DAILYMAL1', '아비', 'M', null);
reset role;
select set_config('t.gap', (select id::text from public.animals where code = 'VE-DAILYGAP1' and owner_id = current_setting('t.u1')::uuid), true);
select set_config('t.ok', (select id::text from public.animals where code = 'VE-DAILYOK01' and owner_id = current_setting('t.u1')::uuid), true);
select set_config('t.f', (select id::text from public.animals where code = 'VE-DAILYFEM1' and owner_id = current_setting('t.u1')::uuid), true);
select set_config('t.m', (select id::text from public.animals where code = 'VE-DAILYMAL1' and owner_id = current_setting('t.u1')::uuid), true);
set local role authenticated;
insert into public.feedings (animal_id, fed_on, result) values
  (current_setting('t.gap')::uuid, current_setting('t.today')::date - 5, 'ate'),
  (current_setting('t.ok')::uuid, current_setting('t.today')::date - 2, 'ate');
insert into public.vet_visits (animal_id, visited_on, clinic, next_visit) values
  (current_setting('t.ok')::uuid, current_setting('t.today')::date - 7, '내일병원', current_setting('t.today')::date + 1),
  (current_setting('t.ok')::uuid, current_setting('t.today')::date - 7, '나중병원', current_setting('t.today')::date + 3);
insert into public.breeders (female_id, male_id, gravid_on, lay_expected_on)
values (current_setting('t.f')::uuid, current_setting('t.m')::uuid, current_setting('t.today')::date - 11, current_setting('t.today')::date + 3);
insert into public.clutches (dam_id, sire_id, seq, laid_on, eggs, fertile, expected_from, expected_to) values
  (current_setting('t.f')::uuid, current_setting('t.m')::uuid, 1, current_setting('t.today')::date - 60, 2, 2, current_setting('t.today')::date + 7, current_setting('t.today')::date + 20),
  (current_setting('t.f')::uuid, current_setting('t.m')::uuid, 2, current_setting('t.today')::date - 59, 2, 2, current_setting('t.today')::date + 6, current_setting('t.today')::date + 20);
reset role;
-- 산란 예정은 그라비드 이후 산란이 없을 때만: 위 차수들은 그라비드(오늘-11) 전에 낳은 것으로 둔다
update public.clutches set laid_on = current_setting('t.today')::date - 60 where dam_id = current_setting('t.f')::uuid;

select private.run_daily();
select private.run_daily();

do $$
declare u uuid := current_setting('t.u1')::uuid;
begin
  assert (select count(*) from public.notifications where user_id = u and kind = 'feeding' and dedupe_key like 'feed-gap:' || current_setting('t.gap') || ':%') = 1,
    '급여 공백 알림 1번';
  assert (select count(*) from public.notifications where user_id = u and kind = 'feeding' and dedupe_key like 'feed-gap:' || current_setting('t.ok') || ':%') = 0,
    '주기 안이면 알림 없음';
  assert (select count(*) from public.notifications where user_id = u and kind = 'health') = 1, '재진 하루 전 알림 1번 (3일 뒤 재진은 없음)';
  assert (select count(*) from public.notifications where user_id = u and kind = 'hatch' and dedupe_key like 'hatch-due:%') = 1, '부화 D-7 알림 1번 (D-6은 없음)';
  assert (select count(*) from public.notifications where user_id = u and kind = 'hatch' and dedupe_key like 'lay-due:%') = 1, '산란 D-3 알림 1번';
end $$;

rollback;
