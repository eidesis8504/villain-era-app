-- 측정용 테이블·함수 검사 (마이그레이션 launch_metrics)
-- 실행: Supabase MCP execute_sql 로 이 파일 전체를 실행. 항상 rollback 하므로 운영 DB에 흔적이 남지 않는다.
-- 통과 = 오류 없이 끝남, 실패 = assert 메시지가 담긴 오류.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);

-- u1: 사용 기록 (같은 이름은 하루 1행, 형식이 틀린 이름은 무시)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.track(array['open', 'open', 'view:scan', 'BAD NAME']);
reset role;
do $$ begin
  assert (select count(*) from public.usage_events
           where user_id = current_setting('t.u1')::uuid
             and day = (now() at time zone (select tz from public.profiles where id = current_setting('t.u1')::uuid))::date) = 2,
    'track: 오늘 2행(open, view:scan)이어야 해요';
end $$;

-- track_uses_profile_tz: 날짜는 사용자 시간대 기준
update public.profiles set tz = 'Pacific/Kiritimati' where id = current_setting('t.u1')::uuid;
delete from public.usage_events where user_id = current_setting('t.u1')::uuid;
set local role authenticated;
select public.track(array['open']);
reset role;
do $$ begin
  assert (select day from public.usage_events where user_id = current_setting('t.u1')::uuid and name = 'open')
       = (now() at time zone 'Pacific/Kiritimati')::date,
    'track: 사용자 시간대 날짜여야 해요';
end $$;

-- 사용 기록은 일반 사용자가 직접 볼 수 없다
set local role authenticated;
do $$ begin
  assert (select count(*) from public.usage_events) = 0, 'usage_events: 일반 사용자에게 보이면 안 돼요';
end $$;

-- 첫 유입 정보는 처음 값을 유지
select public.set_first_touch('instagram', 'ios');
select public.set_first_touch('naver', 'android');
reset role;
do $$ begin
  assert (select source || '/' || first_platform from public.profiles where id = current_setting('t.u1')::uuid) = 'instagram/ios',
    'set_first_touch: 처음 값을 유지해야 해요';
end $$;

-- is_test·source는 클라이언트가 직접 바꿀 수 없다
set local role authenticated;
do $$ begin
  begin
    update public.profiles set is_test = false where id = current_setting('t.u1')::uuid;
    raise exception 'is_test 직접 수정이 막혀야 해요';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 의견: 본인은 보낼 수 있고, 다른 사용자는 볼 수 없다
insert into public.feedback (kind, body, path, app_version, ua) values ('제안', '테스트 의견', '/more', '0.9.0-beta', 'test');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.feedback) = 0, 'feedback: 다른 사용자 의견이 보이면 안 돼요';
end $$;

-- 설문: 본인 응답 저장·조회
insert into public.survey_responses (nps, best_feature, wish) values (9, '급여', '');
do $$ begin
  assert (select count(*) from public.survey_responses) = 1, 'survey: 본인 응답이 보여야 해요';
end $$;

-- 오류 기록: 사용자당 하루 50건까지
do $$ begin
  for i in 1..51 loop
    perform public.log_client_error('err ' || i, '', '/x', '0.9.0-beta', 'ua');
  end loop;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.client_errors where user_id = current_setting('t.u2')::uuid) = 50,
    'client_errors: 하루 50건으로 제한돼야 해요';
end $$;

-- 환영 화면 방문: 로그인 전(anon)에도 기록, 잘못된 기기 값은 other
set local role anon;
select public.log_landing('t-x', 'ios', null);
select public.log_landing('t-y', 'weird', null);
reset role;
do $$ begin
  assert (select count(*) from public.landing_views where src in ('t-x', 't-y')) = 2, 'log_landing: anon도 기록돼야 해요';
  assert (select platform from public.landing_views where src = 't-y') = 'other', 'log_landing: 잘못된 platform은 other';
end $$;

-- 운영 설정은 일반 사용자에게 안 보인다
set local role authenticated;
do $$ begin
  assert (select count(*) from public.app_config) = 0, 'app_config: 일반 사용자에게 보이면 안 돼요';
end $$;
reset role;

rollback;
