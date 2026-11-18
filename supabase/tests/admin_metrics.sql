-- 검증 현황 집계 검사 (마이그레이션 admin_metrics): 손으로 계산한 값과 비교. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
select set_config('t.u3', (select id::text from public.profiles where is_test order by created_at offset 2 limit 1), true);
select set_config('t.first', ((now() at time zone 'Asia/Seoul')::date - 10)::text, true);
-- 시험 데이터: u1 운영자(집계 제외), u2·u3 일반 사용자, 모두 10일 전 시작
update public.profiles set is_test = false, status = 'active', tz = 'Asia/Seoul', role = 'member', source = null, first_platform = null,
       created_at = (current_setting('t.first') || ' 12:00:00+09')::timestamptz
 where id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid);
update public.profiles set role = 'admin' where id = current_setting('t.u1')::uuid;
update public.profiles set source = 'instagram', first_platform = 'ios' where id = current_setting('t.u2')::uuid;
update public.profiles set first_platform = 'android' where id = current_setting('t.u3')::uuid;
update public.app_config set value = to_jsonb(((now() at time zone 'Asia/Seoul')::date - 20)::text) where key = 'launch_on';
delete from public.usage_events where user_id in (current_setting('t.u2')::uuid, current_setting('t.u3')::uuid);
-- u2: 첫날 + 3일째 다시 열고, 개체 1마리 등록 / u3: 첫날만
insert into public.usage_events (user_id, day, name) values
  (current_setting('t.u2')::uuid, current_setting('t.first')::date, 'open'),
  (current_setting('t.u2')::uuid, current_setting('t.first')::date + 3, 'open'),
  (current_setting('t.u2')::uuid, current_setting('t.first')::date + 3, 'open_pwa'),
  (current_setting('t.u3')::uuid, current_setting('t.first')::date, 'open');
insert into public.animals (owner_id, code, name) values (current_setting('t.u2')::uuid, 'VE-METRIC001', '집계');

-- 일반 회원은 볼 수 없다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.admin_metrics();
    raise exception 'SENTINEL 일반 회원은 볼 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare m jsonb := public.admin_metrics();
begin
  assert (m #>> '{funnel,started}')::int = 2, '시작한 사람 2명 (운영자 제외): ' || (m -> 'funnel')::text;
  assert (m #>> '{funnel,activated}')::int = 1, '첫 개체 등록 1명';
  assert (m #>> '{funnel,activation_rate}')::numeric = 50, '활성화율 50%';
  assert (m #>> '{retention,d7,eligible}')::int = 2, 'D7 대상 2명';
  assert (m #>> '{retention,d7,returned}')::int = 1, 'D7 재방문 1명';
  assert (m #>> '{retention,d7,rate}')::numeric = 50, 'D7 재방문율 50%';
  assert (m #>> '{retention,d30,eligible}')::int = 0, 'D30 대상 없음';
  assert (select (x ->> 'users')::int from jsonb_array_elements(m -> 'sources') x where x ->> 'source' = 'instagram') = 1, '유입 경로 instagram 1명';
  assert (select (x ->> 'standalone_users')::int from jsonb_array_elements(m -> 'platforms') x where x ->> 'platform' = 'ios') = 1, '홈 화면 앱 사용 1명';
  assert jsonb_array_length(m -> 'daily') = 14, '최근 14일';
  assert (m #>> '{targets,activation}')::int = 40, '기준값';
end $$;
reset role;

rollback;
