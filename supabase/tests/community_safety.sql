-- 커뮤니티 안전장치 검사 (마이그레이션 community_safety): 신고·자동 숨김·차단·금칙어·운영자 처리
-- 실행: Supabase MCP execute_sql. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
select set_config('t.u3', (select id::text from public.profiles where is_test order by created_at offset 2 limit 1), true);
select set_config('t.u4', (select id::text from public.profiles where is_test order by created_at offset 3 limit 1), true);
update public.profiles set status = 'active', role = 'member'
 where id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);

-- legacy_insert_paths: 지금 운영 중인 화면과 같은 방식의 글·댓글·좋아요 저장이 그대로 된다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.posts (cat, title, body, attach, media) values ('자유', '안전장치 테스트 글', '본문', null, '[]'::jsonb);
reset role;
select set_config('t.p1', (select id::text from public.posts where author_id = current_setting('t.u1')::uuid order by created_at desc limit 1), true);
set local role authenticated;
insert into public.comments (post_id, body) values (current_setting('t.p1')::uuid, '작성자 댓글');
insert into public.likes (post_id) values (current_setting('t.p1')::uuid);

-- 내 글은 신고할 수 없다
do $$ begin
  begin
    perform public.report_content('post', current_setting('t.p1')::uuid, 'spam', '');
    raise exception 'SENTINEL 자기 글 신고가 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

-- u2 신고: 같은 대상은 1번만
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.report_content('post', current_setting('t.p1')::uuid, 'spam', '');
select public.report_content('post', current_setting('t.p1')::uuid, 'spam', '');
do $$ begin
  assert (select count(*) from public.reports) = 0, 'reports: 일반 회원에게 보이면 안 돼요';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.reports where target_id = current_setting('t.p1')::uuid) = 1, '같은 신고는 1번만';
  assert not (select hidden from public.posts where id = current_setting('t.p1')::uuid), '1명 신고로는 숨기지 않아요';
end $$;

-- 서로 다른 3명이 신고하면 자동 숨김
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.report_content('post', current_setting('t.p1')::uuid, 'abuse', '');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u4'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.report_content('post', current_setting('t.p1')::uuid, 'sexual', '');
reset role;
do $$ begin
  assert (select hidden from public.posts where id = current_setting('t.p1')::uuid), '3명 신고 시 자동 숨김';
end $$;

-- 숨긴 글: 다른 회원에게 안 보이고, 작성자에게는 보인다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.posts where id = current_setting('t.p1')::uuid) = 0, '숨긴 글은 다른 회원에게 안 보여요';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.posts where id = current_setting('t.p1')::uuid) = 1, '작성자에게는 숨긴 글이 보여요';
end $$;
insert into public.posts (cat, title, body, attach, media) values ('자유', '두 번째 글', '본문', null, '[]'::jsonb);
reset role;

-- blocked_and_hidden_everywhere: u2가 u1을 차단하면 u1의 글·댓글이 어떤 조회에도 안 보인다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.blocks (blocked_id) values (current_setting('t.u1')::uuid);
do $$ begin
  assert (select count(*) from public.posts where author_id = current_setting('t.u1')::uuid) = 0, '차단한 회원의 글이 보이면 안 돼요';
  assert (select count(*) from (select author_id from public.posts order by like_count desc, created_at desc limit 50) x
           where x.author_id = current_setting('t.u1')::uuid) = 0, '인기글 조회에도 안 보여요';
  assert (select count(*) from public.comments where author_id = current_setting('t.u1')::uuid) = 0, '차단한 회원의 댓글이 보이면 안 돼요';
end $$;
-- u2 글에 u1이 댓글을 달아도 u2에게 알림이 가지 않는다
insert into public.posts (cat, title, body, attach, media) values ('Q&A', 'u2 질문', '본문', null, '[]'::jsonb);
reset role;
select set_config('t.p3', (select id::text from public.posts where author_id = current_setting('t.u2')::uuid order by created_at desc limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.comments (post_id, body) values (current_setting('t.p3')::uuid, '차단된 사람의 답변');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = current_setting('t.u2')::uuid and kind = 'comment'
            and link = '/community/' || current_setting('t.p3')) = 0, '차단한 회원의 댓글 알림이 오면 안 돼요';
end $$;
-- 차단하지 않은 u3의 댓글은 알림이 간다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.comments (post_id, body) values (current_setting('t.p3')::uuid, '일반 답변');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where user_id = current_setting('t.u2')::uuid and kind = 'comment'
            and link = '/community/' || current_setting('t.p3')) = 1, '일반 댓글 알림은 가야 해요';
end $$;

-- 금칙어: 글·댓글·닉네임 저장 거부
insert into public.banned_words (word) values ('테스트금칙어');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.posts (cat, title, body, attach, media) values ('자유', '제목', '이건 테스트 금칙어 포함', null, '[]'::jsonb);
    raise exception 'SENTINEL 금칙어 글이 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    update public.profiles set nickname = '테스트금칙어' where id = current_setting('t.u3')::uuid;
    raise exception 'SENTINEL 금칙어 닉네임이 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
-- 운영자가 아니면 처리 함수를 쓸 수 없다
do $$ begin
  begin
    perform public.admin_moderate((select min(id) from public.reports), 'dismiss');
    raise exception 'SENTINEL 일반 회원 처리가 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

-- 운영자 처리: 숨김 해제 → 열린 신고가 정리된다
update public.profiles set role = 'admin' where id = current_setting('t.u4')::uuid;
select set_config('t.r1', (select min(id)::text from public.reports where target_id = current_setting('t.p1')::uuid), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u4'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.admin_moderate(current_setting('t.r1')::bigint, 'unhide');
reset role;
do $$ begin
  assert not (select hidden from public.posts where id = current_setting('t.p1')::uuid), '숨김 해제';
  assert (select count(*) from public.reports where target_id = current_setting('t.p1')::uuid and status = 'open') = 0, '열린 신고 정리';
end $$;

rollback;
