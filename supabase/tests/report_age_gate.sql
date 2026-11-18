-- 자동 숨김 악용 방지 검사: 만든 지 24시간이 안 된 계정의 신고는 자동 숨김 인원에 세지 않는다 (신고 기록은 남음). 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
select set_config('t.u3', (select id::text from public.profiles where is_test order by created_at offset 2 limit 1), true);
select set_config('t.u4', (select id::text from public.profiles where is_test order by created_at offset 3 limit 1), true);
update public.profiles set status = 'active', role = 'member'
 where id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);
-- 신고자 3명을 방금 만든 계정처럼
update public.profiles set created_at = now() - interval '1 hour'
 where id in (current_setting('t.u2')::uuid, current_setting('t.u3')::uuid, current_setting('t.u4')::uuid);

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.posts (cat, title, body, attach, media) values ('자유', '자동 숨김 악용 시험', '본문', null, '[]'::jsonb);
reset role;
select set_config('t.p', (select id::text from public.posts where author_id = current_setting('t.u1')::uuid order by created_at desc limit 1), true);

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated; select public.report_content('post', current_setting('t.p')::uuid, 'spam', ''); reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated; select public.report_content('post', current_setting('t.p')::uuid, 'spam', ''); reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u4'), 'role', 'authenticated')::text, true);
set local role authenticated; select public.report_content('post', current_setting('t.p')::uuid, 'spam', ''); reset role;

do $$ begin
  assert (select count(*) from public.reports where target_id = current_setting('t.p')::uuid) = 3, '신고 3건은 기록돼요';
  assert not (select hidden from public.posts where id = current_setting('t.p')::uuid), '새 계정 3개의 신고로는 자동 숨김되지 않아야 해요';
end $$;

rollback;
