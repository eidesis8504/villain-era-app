-- 앱 안 계정 삭제 검사 (마이그레이션 delete_account). 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);

-- 남은 사진 파일이 있으면 계정을 지우지 않는다 (파일은 Storage API로 먼저 지워야 함)
insert into storage.objects (bucket_id, name, owner_id) values ('avatars', current_setting('t.u2') || '/left.jpg', current_setting('t.u2'));
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.delete_my_account();
    raise exception 'SENTINEL 파일이 남아 있으면 삭제를 거부해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%사진 삭제가 끝나지 않았어요%', '파일이 남았다는 안내여야 해요: ' || sqlerrm;
  end;
end $$;
reset role;

-- 파일이 없으면 계정과 모든 기록이 지워진다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.animals (code, name) values ('VE-TESTDEL01', '삭제 테스트');
insert into public.posts (cat, title, body, attach, media) values ('자유', '삭제 테스트 글', '본문', null, '[]'::jsonb);
select public.delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = current_setting('t.u1')::uuid), 'auth.users 삭제';
  assert not exists (select 1 from public.profiles where id = current_setting('t.u1')::uuid), 'profiles 연쇄 삭제';
  assert not exists (select 1 from public.animals where owner_id = current_setting('t.u1')::uuid), 'animals 연쇄 삭제';
  assert not exists (select 1 from public.posts where author_id = current_setting('t.u1')::uuid), 'posts 연쇄 삭제';
end $$;

-- 로그인하지 않은 호출은 거부
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
do $$ begin
  begin
    perform public.delete_my_account();
    raise exception 'SENTINEL 로그인 없이 삭제가 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

rollback;
