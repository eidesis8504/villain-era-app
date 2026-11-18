-- 건강 일지·진료 기록 검사 (마이그레이션 health): 본인만 접근, 입력 검증, 비공개 사진 저장소. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
update public.profiles set status = 'active' where id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid);

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.animals (code, name) values ('VE-HEALTH001', '건강테스트');
reset role;
select set_config('t.a1', (select id::text from public.animals where owner_id = current_setting('t.u1')::uuid and code = 'VE-HEALTH001'), true);

set local role authenticated;
insert into public.health_logs (animal_id, logged_on, area, level, note, photos)
values (current_setting('t.a1')::uuid, '2026-11-18', '피부·비늘', 2, '뒷다리 딱지', '["u/a.jpg"]'::jsonb);
insert into public.vet_visits (animal_id, visited_on, clinic, diagnosis, treatment, cost, next_visit)
values (current_setting('t.a1')::uuid, '2026-11-18', '테스트 동물병원', '피부염', '연고', 30000, '2026-11-25');
do $$ begin
  begin
    insert into public.health_logs (animal_id, logged_on, area, level, photos)
    values (current_setting('t.a1')::uuid, '2026-11-18', '눈', 1, '["1","2","3","4"]'::jsonb);
    raise exception 'SENTINEL 사진 4장이 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    insert into public.health_logs (animal_id, logged_on, area, level) values (current_setting('t.a1')::uuid, '2026-11-18', '머리', 1);
    raise exception 'SENTINEL 정해진 부위만 허용해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

-- 다른 사용자는 볼 수 없다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.health_logs) = 0, '다른 사용자의 증상 기록이 보이면 안 돼요';
  assert (select count(*) from public.vet_visits) = 0, '다른 사용자의 진료 기록이 보이면 안 돼요';
end $$;
reset role;

-- 증상 사진 저장소는 비공개이고, 본인 폴더만 볼 수 있다
insert into storage.objects (bucket_id, name, owner_id) values ('health-photos', current_setting('t.u1') || '/s.jpg', current_setting('t.u1'));
do $$ begin
  assert (select public from storage.buckets where id = 'health-photos') = false, 'health-photos는 비공개 버킷';
end $$;
set local role authenticated;
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'health-photos') = 0, '다른 사용자의 증상 사진이 보이면 안 돼요';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'health-photos') = 1, '본인 증상 사진은 보여야 해요';
end $$;
reset role;

rollback;
