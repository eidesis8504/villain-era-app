-- 번식 사이클 검사 (마이그레이션 breeding): 메이팅·알 상태·예정일 컬럼, 기존 부화 기록 호환. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
update public.profiles set status = 'active' where id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid);

-- u2 수컷 (다른 사람 개체)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.animals (code, name, sex) values ('VE-BRDOTHER1', '남의수컷', 'M');
reset role;
select set_config('t.other', (select id::text from public.animals where owner_id = current_setting('t.u2')::uuid and code = 'VE-BRDOTHER1'), true);

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.animals (code, name, sex) values ('VE-BRDFEMAL1', '암컷', 'F'), ('VE-BRDMALE01', '수컷', 'M');
reset role;
select set_config('t.f', (select id::text from public.animals where owner_id = current_setting('t.u1')::uuid and code = 'VE-BRDFEMAL1'), true);
select set_config('t.m', (select id::text from public.animals where owner_id = current_setting('t.u1')::uuid and code = 'VE-BRDMALE01'), true);
set local role authenticated;
insert into public.breeders (female_id, male_id) values (current_setting('t.f')::uuid, current_setting('t.m')::uuid);
insert into public.matings (female_id, male_id, paired_on, locked) values (current_setting('t.f')::uuid, current_setting('t.m')::uuid, '2026-09-01', true);
update public.breeders set gravid_on = '2026-09-20', lay_expected_on = '2026-10-04' where female_id = current_setting('t.f')::uuid;
do $$ begin
  begin
    insert into public.matings (female_id, male_id, paired_on) values (current_setting('t.f')::uuid, current_setting('t.other')::uuid, '2026-09-02');
    raise exception 'SENTINEL 다른 사람 수컷과 메이팅 기록이 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;

-- 산란 + 인큐 온도·예정 범위
insert into public.clutches (dam_id, sire_id, seq, laid_on, eggs, fertile, incubation_temp, expected_from, expected_to)
values (current_setting('t.f')::uuid, current_setting('t.m')::uuid, 1, '2026-10-05', 2, 2, 23.0, '2026-12-09', '2027-01-03');
reset role;
select set_config('t.c', (select id::text from public.clutches where dam_id = current_setting('t.f')::uuid and seq = 1), true);
set local role authenticated;
do $$ begin
  begin
    update public.clutches set expected_from = '2027-01-10', expected_to = '2027-01-01' where id = current_setting('t.c')::uuid;
    raise exception 'SENTINEL 예정 범위가 뒤집히면 막혀야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    insert into public.egg_checks (clutch_id, checked_on, status, count) values (current_setting('t.c')::uuid, '2026-11-01', 'broken', 1);
    raise exception 'SENTINEL 정해진 알 상태만 허용해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
insert into public.egg_checks (clutch_id, checked_on, status, count, note) values (current_setting('t.c')::uuid, '2026-11-01', 'dented', 1, '살짝 함몰');

-- 기존 부화 기록 함수가 그대로 동작
do $$ begin
  assert (select count(*) from public.record_hatch(current_setting('t.c')::uuid, 1, 0, '2026-12-20', '')) = 1, 'record_hatch 1마리 자동 등록';
end $$;
reset role;

-- 다른 사용자는 볼 수 없다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.matings) = 0, '다른 사용자의 메이팅 기록이 보이면 안 돼요';
  assert (select count(*) from public.egg_checks) = 0, '다른 사용자의 알 상태 기록이 보이면 안 돼요';
end $$;
reset role;

rollback;
