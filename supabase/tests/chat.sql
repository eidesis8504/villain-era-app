-- 채팅 검사 (마이그레이션 chat): 1:1 대화, 운영자 문의, 차단, 신고, 속도 제한
-- 실행: Supabase MCP execute_sql. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
select set_config('t.u3', (select id::text from public.profiles where is_test order by created_at offset 2 limit 1), true);
select set_config('t.u4', (select id::text from public.profiles where is_test order by created_at offset 3 limit 1), true);
-- u1 철수·u2 영희: 3일 된 계정 + 개체 있음 / u3 새내기: 1시간 된 계정 + 개체 있음 / u4: 운영자
delete from public.animals where owner_id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);
delete from public.blocks where blocker_id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);
delete from public.notifications where user_id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);
update public.profiles set role = 'member' where role = 'admin' and not is_test;
update public.profiles set status = 'active', role = 'member', nickname = '철수', created_at = now() - interval '3 days' where id = current_setting('t.u1')::uuid;
update public.profiles set status = 'active', role = 'member', nickname = '영희', created_at = now() - interval '3 days' where id = current_setting('t.u2')::uuid;
update public.profiles set status = 'active', role = 'member', nickname = '새내기', created_at = now() - interval '1 hour' where id = current_setting('t.u3')::uuid;
update public.profiles set status = 'active', role = 'admin', nickname = '운영자', created_at = now() - interval '3 days' where id = current_setting('t.u4')::uuid;
insert into public.animals (owner_id, code, name) values
  (current_setting('t.u1')::uuid, 'VE-CHATTEST01', '철수 개체'),
  (current_setting('t.u2')::uuid, 'VE-CHATTEST02', '영희 개체'),
  (current_setting('t.u3')::uuid, 'VE-CHATTEST03', '새내기 개체');

-- ── 1. 대화 시작 조건 ──────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.open_dm(current_setting('t.u1')::uuid);
    raise exception 'SENTINEL 새 계정은 대화를 시작할 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%24시간%', '새 계정 안내 문구가 아니에요: ' || sqlerrm;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.open_dm(current_setting('t.u1')::uuid);
    raise exception 'SENTINEL 나 자신과는 대화할 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform public.open_dm(gen_random_uuid());
    raise exception 'SENTINEL 없는 회원과는 대화할 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;

-- ── 2. 같은 두 사람의 방은 하나 ─────────────────────────────────
select set_config('t.r1', public.open_dm(current_setting('t.u2')::uuid)::text, true);
do $$ begin
  assert public.open_dm(current_setting('t.u2')::uuid)::text = current_setting('t.r1'), '다시 열어도 같은 방';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert public.open_dm(current_setting('t.u1')::uuid)::text = current_setting('t.r1'), '상대가 열어도 같은 방';
end $$;
reset role;
do $$
declare r public.chat_rooms;
begin
  select * into r from public.chat_rooms where id = current_setting('t.r1')::uuid;
  assert (select count(*) from public.chat_rooms where kind = 'dm') = 1, '방은 하나';
  assert r.user_a < r.user_b and r.created_by = current_setting('t.u1')::uuid, '작은 id가 a, 만든 사람은 철수';
end $$;
-- 읽음 시각을 과거로 돌려 두고(한 트랜잭션 안에서는 now()가 같다) 메시지 뒤의 변화를 본다
update public.chat_rooms set a_read_at = now() - interval '1 hour', b_read_at = now() - interval '1 hour' where id = current_setting('t.r1')::uuid;

-- ── 2-1. 글에서 연 대화는 그 글을 기억한다 (다른 글에서 다시 열면 그 글로 바뀐다) ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.posts (cat, title, body, attach, media) values ('자유', '채팅 시험 글', '본문', null, '[]');
reset role;
select set_config('t.p1', (select id::text from public.posts where author_id = current_setting('t.u2')::uuid and title = '채팅 시험 글'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert public.open_dm(current_setting('t.u2')::uuid, current_setting('t.p1')::uuid)::text = current_setting('t.r1'), '글에서 열어도 같은 방';
  perform public.open_dm(current_setting('t.u2')::uuid);
  perform public.open_dm(current_setting('t.u2')::uuid, gen_random_uuid());
end $$;
reset role;
do $$ begin
  assert (select post_id from public.chat_rooms where id = current_setting('t.r1')::uuid) = current_setting('t.p1')::uuid,
         '글에서 다시 열면 그 글이 방에 붙고, 글 없이 열거나 없는 글로 열면 그대로예요';
end $$;

-- ── 3. 메시지 보내기 ───────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare m public.chat_messages;
begin
  m := public.send_message(current_setting('t.r1')::uuid, '  안녕하세요  ');
  assert m.body = '안녕하세요' and m.sender_id = current_setting('t.u1')::uuid, '앞뒤 공백을 지워 저장';
  perform public.send_message(current_setting('t.r1')::uuid, '분양 글 보고 연락드려요');
  -- ── 5. 보낼 수 없는 글 ──
  begin
    perform public.send_message(current_setting('t.r1')::uuid, '   ');
    raise exception 'SENTINEL 빈 메시지는 거절해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform public.send_message(current_setting('t.r1')::uuid, repeat('가', 1001));
    raise exception 'SENTINEL 1000자를 넘는 메시지는 거절해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform public.send_message(current_setting('t.r1')::uuid, '이 씨발');
    raise exception 'SENTINEL 금칙어는 거절해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%사용할 수 없는 표현%', '금칙어 안내 문구가 아니에요: ' || sqlerrm;
  end;
  assert (select count(*) from public.chat_messages where room_id = current_setting('t.r1')::uuid) = 2, '참여자는 메시지를 읽어요';
end $$;
reset role;
do $$
declare r public.chat_rooms;
        mine timestamptz; theirs timestamptz;
begin
  select * into r from public.chat_rooms where id = current_setting('t.r1')::uuid;
  assert r.last_message = '분양 글 보고 연락드려요' and r.last_sender = current_setting('t.u1')::uuid, '방의 마지막 메시지와 보낸 사람';
  mine := case when r.user_a = current_setting('t.u1')::uuid then r.a_read_at else r.b_read_at end;
  theirs := case when r.user_a = current_setting('t.u1')::uuid then r.b_read_at else r.a_read_at end;
  assert mine = r.last_message_at, '보낸 쪽은 읽은 것으로';
  assert theirs < r.last_message_at, '받는 쪽은 안 읽음';
  assert (select count(*) from public.notifications
           where user_id = current_setting('t.u2')::uuid and kind = 'chat' and link = '/chat/' || current_setting('t.r1')) = 1,
         '상대에게 알림은 10분에 한 번(메시지 2개에 1개)';
  assert (select body from public.notifications where user_id = current_setting('t.u2')::uuid and kind = 'chat' limit 1) not like '%안녕하세요%',
         '알림에 메시지 내용을 넣지 않아요';
end $$;

-- ── 4. 참여자가 아닌 회원 ──────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.chat_rooms) = 0, '남의 방은 보이지 않아요';
  assert (select count(*) from public.chat_messages) = 0, '남의 메시지는 보이지 않아요';
  begin
    perform public.send_message(current_setting('t.r1')::uuid, '끼어들기');
    raise exception 'SENTINEL 참여자가 아니면 보낼 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    insert into public.chat_messages (room_id, sender_id, body) values (current_setting('t.r1')::uuid, current_setting('t.u3')::uuid, '직접 쓰기');
    raise exception 'SENTINEL 표에 직접 쓸 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform public.report_chat(current_setting('t.r1')::uuid, 'abuse');
    raise exception 'SENTINEL 참여자가 아니면 신고할 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$ begin
  begin
    perform count(*) from public.chat_messages;
    raise exception 'SENTINEL 계정 없이 메시지 표를 읽을 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;
-- 운영자도 신고가 없는 1:1 대화는 읽지 못한다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u4'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.chat_messages where room_id = current_setting('t.r1')::uuid) = 0, '운영자도 신고 없는 1:1 대화는 읽지 못해요';
end $$;
reset role;

-- ── 6. 읽음 처리 ──────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.mark_room_read(current_setting('t.r1')::uuid);
reset role;
do $$
declare r public.chat_rooms;
begin
  select * into r from public.chat_rooms where id = current_setting('t.r1')::uuid;
  assert (case when r.user_a = current_setting('t.u2')::uuid then r.a_read_at else r.b_read_at end) >= r.last_message_at, '읽음 처리 뒤에는 안 읽음이 아니에요';
end $$;

-- ── 7. 차단 ───────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.blocks (blocked_id) values (current_setting('t.u1')::uuid);
do $$ begin
  assert (select count(*) from public.chat_rooms) = 0, '차단한 쪽에는 방이 보이지 않아요';
  assert (select count(*) from public.chat_messages) = 0, '차단한 쪽에는 메시지도 보이지 않아요';
  begin
    perform public.send_message(current_setting('t.r1')::uuid, '차단한 쪽의 메시지');
    raise exception 'SENTINEL 차단한 쪽도 보낼 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.chat_rooms) = 1, '차단당한 쪽에는 방이 그대로 보여요';
  begin
    perform public.send_message(current_setting('t.r1')::uuid, '차단당한 쪽의 메시지');
    raise exception 'SENTINEL 차단당한 쪽은 보낼 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%보낼 수 없어요%', '차단 안내 문구가 아니에요: ' || sqlerrm;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
delete from public.blocks where blocked_id = current_setting('t.u1')::uuid;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.send_message(current_setting('t.r1')::uuid, '차단이 풀린 뒤의 메시지');
insert into public.blocks (blocked_id) values (current_setting('t.u2')::uuid);
do $$ begin
  begin
    perform public.open_dm(current_setting('t.u2')::uuid);
    raise exception 'SENTINEL 내가 차단한 회원과는 대화를 열 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%차단한 회원%', '차단 안내 문구가 아니에요: ' || sqlerrm;
  end;
end $$;
delete from public.blocks where blocked_id = current_setting('t.u2')::uuid;
reset role;

-- ── 8. 1분에 20개 (새내기가 자기 문의방에 보낸다: 문의에는 시작 제한이 없다) ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('t.s3', public.open_support()::text, true);
do $$
declare i int;
begin
  for i in 1..20 loop
    perform public.send_message(current_setting('t.s3')::uuid, '메시지 ' || i);
  end loop;
  begin
    perform public.send_message(current_setting('t.s3')::uuid, '스물한 번째');
    raise exception 'SENTINEL 1분에 20개를 넘으면 거절해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%빠르게%', '속도 제한 안내 문구가 아니에요: ' || sqlerrm;
  end;
end $$;
reset role;

-- ── 9. 하루에 새 대화 10개 ─────────────────────────────────────
do $$
declare i int; nid uuid;
begin
  for i in 1..10 loop
    nid := gen_random_uuid();
    insert into auth.users (id, aud, role, is_anonymous) values (nid, 'authenticated', 'authenticated', true);
    update public.profiles set status = 'active' where id = nid;
    perform set_config('t.x' || i, nid::text, true);
  end loop;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare i int;
begin
  for i in 1..9 loop
    perform public.open_dm(current_setting('t.x' || i)::uuid);
  end loop;
  begin
    perform public.open_dm(current_setting('t.x10')::uuid);
    raise exception 'SENTINEL 하루 10개를 넘는 새 대화는 거절해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%10개%', '하루 제한 안내 문구가 아니에요: ' || sqlerrm;
  end;
  assert public.open_dm(current_setting('t.u2')::uuid)::text = current_setting('t.r1'), '이미 있는 방은 제한과 상관없이 열려요';
end $$;
reset role;

-- ── 10. 운영자 문의 ────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('t.s1', public.open_support()::text, true);
do $$ begin
  assert public.open_support()::text = current_setting('t.s1'), '문의방은 회원마다 하나';
end $$;
reset role;
update public.chat_rooms set a_read_at = now() - interval '1 hour', b_read_at = now() - interval '1 hour' where id = current_setting('t.s1')::uuid;
set local role authenticated;
select public.send_message(current_setting('t.s1')::uuid, '문의드려요');
reset role;
do $$ begin
  assert (select count(*) from public.notifications
           where user_id = current_setting('t.u4')::uuid and kind = 'chat' and link = '/admin/inquiry/' || current_setting('t.s1')) = 1,
         '문의가 오면 운영자에게 알림';
end $$;
-- 회원이 보낸 뒤 시간이 흐른 것처럼 회원 쪽 읽음 시각을 과거로 돌린다 (한 트랜잭션 안에서는 now()가 같다)
update public.chat_rooms set a_read_at = now() - interval '30 minutes' where id = current_setting('t.s1')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.chat_rooms where kind = 'support') = 0, '다른 회원은 남의 문의방을 보지 못해요';
  begin
    perform public.send_message(current_setting('t.s1')::uuid, '남의 문의에 쓰기');
    raise exception 'SENTINEL 다른 회원은 남의 문의에 쓸 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u4'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.chat_messages where room_id = current_setting('t.s1')::uuid) = 1, '운영자는 문의를 읽어요';
end $$;
select public.send_message(current_setting('t.s1')::uuid, '답변드려요');
select public.mark_room_read(current_setting('t.s1')::uuid);
reset role;
do $$
declare r public.chat_rooms;
begin
  select * into r from public.chat_rooms where id = current_setting('t.s1')::uuid;
  assert r.last_sender = current_setting('t.u4')::uuid and r.b_read_at = r.last_message_at, '운영자 쪽 읽음 표시는 b';
  assert r.a_read_at < r.last_message_at, '회원 쪽은 답변을 아직 안 읽음';
  assert (select count(*) from public.notifications
           where user_id = current_setting('t.u2')::uuid and kind = 'chat' and link = '/inquiry') = 1, '운영자가 답하면 회원에게 알림';
end $$;

-- ── 11. 대화 신고 ─────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.report_chat(current_setting('t.r1')::uuid, 'abuse', '욕설');
select public.report_chat(current_setting('t.r1')::uuid, 'abuse', '욕설');
reset role;
do $$ begin
  assert (select count(*) from public.reports
           where target_kind = 'chat' and target_id = current_setting('t.r1')::uuid
             and target_user = current_setting('t.u1')::uuid and status = 'open') = 1, '대화 신고는 한 번만, 대상은 상대 회원';
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u4'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.chat_messages where room_id = current_setting('t.r1')::uuid) > 0, '신고가 열려 있으면 운영자가 그 대화를 읽어요';
  assert (select count(*) from public.chat_rooms where id = current_setting('t.r1')::uuid) = 1, '신고된 방도 보여요';
  perform public.admin_moderate((select id from public.reports where target_kind = 'chat' and target_id = current_setting('t.r1')::uuid), 'dismiss');
  assert (select count(*) from public.chat_messages where room_id = current_setting('t.r1')::uuid) = 0, '신고를 닫으면 운영자는 다시 읽지 못해요';
end $$;
reset role;

-- ── 12. 실시간 발행 · 기존 알림 ────────────────────────────────
do $$ begin
  assert exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'),
         'chat_messages가 실시간 발행에 들어 있어요';
  perform private.notify(current_setting('t.u1')::uuid, 'comment', '기존 알림', '', '/community', 'chat-test-legacy');
  assert exists (select 1 from public.notifications where dedupe_key = 'chat-test-legacy'), '기존 종류의 알림은 그대로 동작해요';
end $$;

rollback;
