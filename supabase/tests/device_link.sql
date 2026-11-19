-- 다른 기기에서 이어 쓰기(연결 코드) 검사 (마이그레이션 device_link). 항상 rollback.
-- 실행: Supabase MCP execute_sql 로 이 파일 전체를 실행. 통과 = 오류 없이 끝남.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);

-- 발급: 8자·글자 집합·600초, DB에는 해시만
select set_config('t.c1', (select code from private.device_link_issue(current_setting('t.u1')::uuid)), true);
do $$ begin
  assert current_setting('t.c1') ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$', '코드 형식: ' || current_setting('t.c1');
  assert not exists (select 1 from private.device_link_codes where code_hash = current_setting('t.c1')), '평문 저장 금지';
  assert exists (select 1 from private.device_link_codes
                  where code_hash = encode(sha256(convert_to(current_setting('t.c1'), 'UTF8')), 'hex')
                    and user_id = current_setting('t.u1')::uuid), '해시로 저장';
  assert (select expires_in from private.device_link_issue(current_setting('t.u2')::uuid)) = 600, '유효 600초';
end $$;

-- 새 코드를 받으면 이전 코드는 무효, 소문자·하이픈·공백도 같은 코드, 한 번만 사용, 없는 코드는 invalid
select set_config('t.c2', (select code from private.device_link_issue(current_setting('t.u1')::uuid)), true);
do $$ begin
  assert (select error from private.device_link_consume(current_setting('t.c1'), 'ip-a')) = 'expired', '이전 코드는 무효';
  assert (select user_id from private.device_link_consume(
            lower(substr(current_setting('t.c2'), 1, 4)) || '- ' || lower(substr(current_setting('t.c2'), 5)), 'ip-a'))
         = current_setting('t.u1')::uuid, '정규화 후 성공';
  assert (select error from private.device_link_consume(current_setting('t.c2'), 'ip-a')) = 'expired', '한 번만 사용';
  assert (select error from private.device_link_consume('ZZZZZZZZ', 'ip-b')) = 'invalid', '없는 코드는 invalid';
  assert (select error from private.device_link_consume(null, 'ip-b')) = 'invalid', 'null 코드는 invalid';
end $$;

-- 같은 IP에서 10분에 실패 10번이면 맞는 코드도 잠금, 다른 IP는 성공
select set_config('t.c3', (select code from private.device_link_issue(current_setting('t.u1')::uuid)), true);
do $$ begin
  for i in 1..10 loop
    perform private.device_link_consume('WRONG' || i, 'ip-c');
  end loop;
  assert (select error from private.device_link_consume(current_setting('t.c3'), 'ip-c')) = 'rate_limited', 'IP 잠금';
  assert (select user_id from private.device_link_consume(current_setting('t.c3'), 'ip-d')) = current_setting('t.u1')::uuid,
    '다른 IP는 잠기지 않음';
end $$;

-- 만료된 코드
select set_config('t.c4', (select code from private.device_link_issue(current_setting('t.u1')::uuid)), true);
update private.device_link_codes set expires_at = now() - interval '1 second'
 where code_hash = encode(sha256(convert_to(current_setting('t.c4'), 'UTF8')), 'hex');
do $$ begin
  assert (select error from private.device_link_consume(current_setting('t.c4'), 'ip-e')) = 'expired', '만료된 코드';
end $$;

-- 연결 끊기: 쓰지 않은 코드 무효
select set_config('t.c5', (select code from private.device_link_issue(current_setting('t.u1')::uuid)), true);
select private.device_link_revoke(current_setting('t.u1')::uuid);
do $$ begin
  assert (select error from private.device_link_consume(current_setting('t.c5'), 'ip-e')) = 'expired', 'revoke 후 무효';
end $$;

-- 같은 사용자는 10분에 5번까지만 발급 (u1은 위에서 5번 받음)
do $$ begin
  begin
    perform private.device_link_issue(current_setting('t.u1')::uuid);
    raise exception 'SENTINEL 6번째 발급은 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm = 'rate_limited', '발급 제한 오류여야 해요: ' || sqlerrm;
  end;
end $$;

-- 일반 사용자·비로그인은 표와 함수에 접근할 수 없다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform 1 from private.device_link_codes limit 1;
    raise exception 'SENTINEL 회원이 코드 표를 읽으면 안 돼요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform private.device_link_issue(current_setting('t.u1')::uuid);
    raise exception 'SENTINEL 회원이 발급 함수를 직접 부르면 안 돼요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform private.device_link_consume('ABCDEFGH', 'x');
    raise exception 'SENTINEL 회원이 사용 함수를 직접 부르면 안 돼요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
do $$ begin
  begin
    perform 1 from private.device_link_attempts limit 1;
    raise exception 'SENTINEL 비로그인이 시도 표를 읽으면 안 돼요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform public.my_account_is_empty();
    raise exception 'SENTINEL 비로그인은 빈 계정 확인을 못 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

-- 빈 계정 확인: 개체·글·댓글·할 일이 없고 운영자가 아니면 true
delete from public.comments where author_id = current_setting('t.u1')::uuid;
delete from public.posts where author_id = current_setting('t.u1')::uuid;
delete from public.todos where owner_id = current_setting('t.u1')::uuid;
delete from public.animals where owner_id = current_setting('t.u1')::uuid;
update public.profiles set role = 'member' where id = current_setting('t.u1')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert public.my_account_is_empty(), '기록이 없으면 빈 계정';
end $$;
insert into public.animals (code, name) values ('VE-TESTLNK01', '연결 테스트');
do $$ begin
  assert not public.my_account_is_empty(), '개체가 있으면 빈 계정 아님';
end $$;
delete from public.animals where code = 'VE-TESTLNK01';
insert into public.todos (title, time_of_day, mode, once_date) values ('연결 테스트', '09:00', 'once', current_date);
do $$ begin
  assert not public.my_account_is_empty(), '할 일만 있어도 빈 계정 아님';
end $$;
reset role;
delete from public.todos where owner_id = current_setting('t.u1')::uuid;
update public.profiles set role = 'admin' where id = current_setting('t.u1')::uuid;
set local role authenticated;
do $$ begin
  assert not public.my_account_is_empty(), '운영자는 빈 계정 아님';
end $$;
reset role;

-- 계정을 지우면 그 계정의 코드도 함께 지워진다
select set_config('t.c6', (select code from private.device_link_issue(current_setting('t.u2')::uuid)), true);
delete from auth.users where id = current_setting('t.u2')::uuid;
do $$ begin
  assert not exists (select 1 from private.device_link_codes where user_id = current_setting('t.u2')::uuid), '코드 연쇄 삭제';
end $$;

rollback;
