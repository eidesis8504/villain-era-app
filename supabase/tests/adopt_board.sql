-- 분양·홍보 게시판과 분양 이력서 검사 (마이그레이션 adopt_board)
-- 실행: Supabase MCP execute_sql. 항상 rollback.
begin;
select set_config('t.u1', (select id::text from public.profiles where is_test order by created_at limit 1), true);
select set_config('t.u2', (select id::text from public.profiles where is_test order by created_at offset 1 limit 1), true);
select set_config('t.u3', (select id::text from public.profiles where is_test order by created_at offset 2 limit 1), true);
-- u1: 3일 된 계정 + 개체 있음(분양자) / u2: 3일 된 계정 + 개체 없음 / u3: 1시간 된 계정 + 개체 있음
delete from public.animals where owner_id in (current_setting('t.u1')::uuid, current_setting('t.u2')::uuid, current_setting('t.u3')::uuid);
update public.profiles set status = 'active', role = 'member', badge = null, nickname = '분양자', created_at = now() - interval '3 days'
 where id = current_setting('t.u1')::uuid;
update public.profiles set status = 'active', role = 'member', badge = null, nickname = '구경꾼', created_at = now() - interval '3 days'
 where id = current_setting('t.u2')::uuid;
update public.profiles set status = 'active', role = 'member', badge = null, nickname = '새내기', created_at = now() - interval '1 hour'
 where id = current_setting('t.u3')::uuid;
insert into public.animals (owner_id, code, name, species, sex, morph, hatch_date) values
  (current_setting('t.u1')::uuid, 'VE-ADOPTSIRE1', '아빠', '크레스티드게코', 'M', '할리퀸', '2024-05-01'),
  (current_setting('t.u1')::uuid, 'VE-ADOPTDAM01', '엄마', '크레스티드게코', 'F', '릴리화이트', '2024-06-01'),
  (current_setting('t.u3')::uuid, 'VE-ADOPTNEW01', '새 개체', '크레스티드게코', 'U', '노멀', '2026-09-01');
insert into public.animals (owner_id, code, name, species, sex, morph, hatch_date, sire_id, dam_id) values
  (current_setting('t.u1')::uuid, 'VE-ADOPT00001', '릴리', '크레스티드게코', 'F', '릴리화이트', '2026-03-01',
   (select id from public.animals where code = 'VE-ADOPTSIRE1' and owner_id = current_setting('t.u1')::uuid),
   (select id from public.animals where code = 'VE-ADOPTDAM01' and owner_id = current_setting('t.u1')::uuid));
select set_config('t.a1', (select id::text from public.animals where code = 'VE-ADOPT00001' and owner_id = current_setting('t.u1')::uuid), true);
select set_config('t.a3', (select id::text from public.animals where code = 'VE-ADOPTNEW01' and owner_id = current_setting('t.u3')::uuid), true);
insert into public.weights (owner_id, animal_id, measured_on, grams) values
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, current_date - 30, 12.5),
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, current_date - 2, 15.0);
insert into public.feedings (owner_id, animal_id, fed_on, result, food, amount, note) values
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, current_date - 200, 'ate', '오래된 먹이', '', ''),
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, current_date - 3, 'ate', '와구와구 Signature', '비밀양', '비밀메모'),
  (current_setting('t.u1')::uuid, current_setting('t.a1')::uuid, current_date - 1, 'refused', '귀뚜라미', '', '');

-- ── 1. 새 계정 제한 ─────────────────────────────────────────────
-- u3: 만든 지 1시간 → 못 쓴다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.posts (cat, title, body, attach, media)
    values ('분양·홍보', '새 계정 홍보 글', '본문', '{"kind":"adopt","mode":"show","seller":{"type":"person"}}', '[]');
    raise exception 'SENTINEL 만든 지 24시간이 안 된 계정은 쓸 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%24시간%', '새 계정 안내 문구가 아니에요: ' || sqlerrm;
  end;
end $$;
reset role;
-- u2: 개체가 없음 → 못 쓴다
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u2'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.posts (cat, title, body, attach, media)
    values ('분양·홍보', '개체 없는 홍보 글', '본문', '{"kind":"adopt","mode":"show","seller":{"type":"person"}}', '[]');
    raise exception 'SENTINEL 개체가 없는 계정은 쓸 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%24시간%', '새 계정 안내 문구가 아니에요: ' || sqlerrm;
  end;
end $$;
-- 옛 분류의 글은 새 계정도 그대로 쓴다 (지금 운영 중인 화면의 저장 방식)
insert into public.posts (cat, title, body, attach, media) values ('자유', '옛 방식 글', '본문', null, '[]');
insert into public.posts (cat, title, body, attach, media) values ('자유', '기록 첨부 글', '본문', '{"kind":"weight","label":"x","last":"1g","diff":"+1","pts":[1],"count":1}', '[]');
reset role;

-- ── 2. 분양 카드의 모양 ─────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare bad jsonb;
begin
  -- 분양·홍보인데 카드가 없거나 틀림
  foreach bad in array array['null'::jsonb, '{"kind":"weight"}'::jsonb, '{"kind":"adopt"}'::jsonb, '{"kind":"adopt","mode":"x"}'::jsonb, '[]'::jsonb]
  loop
    begin
      insert into public.posts (cat, title, body, attach, media) values ('분양·홍보', '틀린 카드', '본문', nullif(bad, 'null'::jsonb), '[]');
      raise exception 'SENTINEL 틀린 분양 카드가 저장되면 안 돼요: %', bad;
    exception when others then
      if sqlerrm like 'SENTINEL%' then raise; end if;
    end;
  end loop;
  -- 다른 분류에 분양 카드
  begin
    insert into public.posts (cat, title, body, attach, media) values ('자유', '자유 글에 분양 카드', '본문', '{"kind":"adopt","mode":"sale"}', '[]');
    raise exception 'SENTINEL 다른 분류에 분양 카드를 붙일 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  -- 판매자 구분이 틀림 / 사업자 정보가 빠짐 / 번호 형식이 틀림
  foreach bad in array array[
    '{"type":"x"}'::jsonb,
    '{"type":"biz","name":"","rep":"홍길동","brn":"101-01-01013","tel":"010"}'::jsonb,
    '{"type":"biz","name":"가게","rep":"","brn":"101-01-01013","tel":"010"}'::jsonb,
    '{"type":"biz","name":"가게","rep":"홍길동","brn":"1010101013","tel":"010"}'::jsonb,
    '{"type":"biz","name":"가게","rep":"홍길동","brn":"101-01-01013","tel":" "}'::jsonb]
  loop
    begin
      insert into public.posts (cat, title, body, attach, media)
      values ('분양·홍보', '틀린 판매자', '본문', jsonb_build_object('kind', 'adopt', 'mode', 'sale', 'seller', bad), '[]');
      raise exception 'SENTINEL 틀린 판매자 정보가 저장되면 안 돼요: %', bad;
    exception when others then
      if sqlerrm like 'SENTINEL%' then raise; end if;
    end;
  end loop;
end $$;

-- ── 3. 이력서 토큰 ─────────────────────────────────────────────
select set_config('t.t1', public.share_animal(current_setting('t.a1')::uuid), true);
do $$ begin
  assert current_setting('t.t1') ~ '^[A-Z0-9]{16}$', '토큰은 영문 대문자·숫자 16자: ' || current_setting('t.t1');
  assert public.share_animal(current_setting('t.a1')::uuid) = current_setting('t.t1'), '두 번 불러도 같은 토큰';
  assert (select count(*) from public.animal_shares) = 1, '내 토큰은 보여요';
  begin
    perform public.share_animal(current_setting('t.a3')::uuid);
    raise exception 'SENTINEL 남의 개체는 공유할 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;

-- ── 4. 서버가 채우는 개체 카드 ──────────────────────────────────
insert into public.posts (cat, title, body, attach, media) values (
  '분양·홍보', '릴리 분양해요', '본문',
  jsonb_build_object('kind', 'adopt', 'mode', 'sale', 'status', 'done', 'price', '  30만 원  ', 'region', '서울',
                     'seller', '{"type":"person"}'::jsonb, 'resume', current_setting('t.t1'),
                     'animal', '{"code":"FAKE","name":"가짜"}'::jsonb, 'extra', 'x'),
  '[]');
insert into public.posts (cat, title, body, attach, media) values (
  '분양·홍보', '우리 가게 홍보', '본문',
  '{"kind":"adopt","mode":"show","price":"무시됨?","seller":{"type":"biz","name":" 게코 가게 ","rep":"홍길동","brn":"101-01-01013","tel":"010-0000-0000","permit":""},"animal":{"name":"가짜"}}',
  '[]');
reset role;
select set_config('t.p_sale', (select id::text from public.posts where title = '릴리 분양해요' and author_id = current_setting('t.u1')::uuid), true);
select set_config('t.p_show', (select id::text from public.posts where title = '우리 가게 홍보' and author_id = current_setting('t.u1')::uuid), true);
do $$
declare s jsonb := (select attach from public.posts where id = current_setting('t.p_sale')::uuid);
        h jsonb := (select attach from public.posts where id = current_setting('t.p_show')::uuid);
begin
  assert s #>> '{animal,name}' = '릴리' and s #>> '{animal,code}' = 'VE-ADOPT00001', '개체 카드는 서버가 실제 개체로 채워요: ' || s::text;
  assert s #>> '{animal,morph}' = '릴리화이트' and s #>> '{animal,hatch_date}' = '2026-03-01', '개체 카드의 모프·해칭일';
  assert s ->> 'status' = 'open', '분양 글은 분양 중으로 시작해요(보낸 값은 무시)';
  assert s ->> 'price' = '30만 원' and s ->> 'region' = '서울', '분양가·지역은 앞뒤 공백을 지워 저장';
  assert s ->> 'resume' = current_setting('t.t1') and not s ? 'extra', '허용한 키만 남겨요';
  assert s #>> '{seller,type}' = 'person', '개인 판매자';
  assert h -> 'animal' = 'null'::jsonb and h -> 'status' = 'null'::jsonb and h -> 'resume' = 'null'::jsonb, '홍보 글: 개체·상태·이력서 없음: ' || h::text;
  assert h #>> '{seller,name}' = '게코 가게' and h #>> '{seller,brn}' = '101-01-01013', '사업자 정보 저장';
end $$;
-- 남의 토큰으로는 붙일 수 없다 (u3을 조건에 맞는 계정으로 바꾼 뒤)
update public.profiles set created_at = now() - interval '3 days' where id = current_setting('t.u3')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u3'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.posts (cat, title, body, attach, media)
    values ('분양·홍보', '남의 개체 분양', '본문', jsonb_build_object('kind', 'adopt', 'mode', 'sale', 'seller', '{"type":"person"}'::jsonb, 'resume', current_setting('t.t1')), '[]');
    raise exception 'SENTINEL 남의 이력서 토큰을 붙일 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
    assert sqlerrm like '%이력서%', '이력서 안내 문구가 아니에요: ' || sqlerrm;
  end;
  assert (select count(*) from public.animal_shares) = 0, '남의 토큰은 보이지 않아요';
  -- ── 5. 분양 상태: 다른 회원은 못 바꾼다 ──
  begin
    perform public.set_adopt_status(current_setting('t.p_sale')::uuid, 'done');
    raise exception 'SENTINEL 다른 회원은 분양 상태를 바꿀 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.set_adopt_status(current_setting('t.p_sale')::uuid, 'hold');
do $$ begin
  assert (select attach ->> 'status' from public.posts where id = current_setting('t.p_sale')::uuid) = 'hold', '글쓴이는 분양 상태를 바꿔요';
  begin
    perform public.set_adopt_status(current_setting('t.p_sale')::uuid, 'sold');
    raise exception 'SENTINEL 틀린 상태 값은 거절해야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  begin
    perform public.set_adopt_status(current_setting('t.p_show')::uuid, 'done');
    raise exception 'SENTINEL 홍보 글에는 분양 상태가 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

-- ── 6. 이력서 보기 (계정 없이) ─────────────────────────────────
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$
declare r jsonb := public.get_resume(lower(current_setting('t.t1')));
begin
  assert r #>> '{animal,name}' = '릴리' and r #>> '{animal,status}' = 'keeping', '개체 정보: ' || coalesce(r::text, 'null');
  assert r #>> '{owner,nickname}' = '분양자' and r #>> '{owner,since}' is not null, '분양자 정보';
  assert jsonb_array_length(r -> 'weights') = 2 and (r #>> '{weights,1,g}')::numeric = 15.0, '체중은 날짜순';
  assert jsonb_array_length(r -> 'feedings') = 2, '급여는 최근 90일만: ' || (r -> 'feedings')::text;
  assert r #>> '{feedings,0,f}' = '와구와구 Signature' and r #>> '{feedings,1,r}' = 'refused', '급여는 날짜순, 먹이 이름 포함';
  assert r #>> '{sire,name}' = '아빠' and r #>> '{dam,name}' = '엄마', '부모 정보';
  assert r::text not like '%비밀메모%' and r::text not like '%비밀양%', '메모와 급여량은 넣지 않아요';
  assert not (r::text like '%"health"%' or r::text like '%"note"%' or r::text like '%"amount"%'), '건강 기록·메모·양 키가 없어요';
  assert public.get_resume('NOPE') is null and public.get_resume(null) is null, '없는 토큰은 null';
  begin
    perform count(*) from public.animal_shares;
    raise exception 'SENTINEL 계정 없이 토큰 표를 읽을 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
end $$;
reset role;

-- ── 7. 링크 끄기 ──────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.u1'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.unshare_animal(current_setting('t.a1')::uuid);
do $$ begin
  assert public.get_resume(current_setting('t.t1')) is null, '끈 링크로는 아무것도 보이지 않아요';
  begin
    insert into public.posts (cat, title, body, attach, media)
    values ('분양·홍보', '끈 토큰', '본문', jsonb_build_object('kind', 'adopt', 'mode', 'sale', 'seller', '{"type":"person"}'::jsonb, 'resume', current_setting('t.t1')), '[]');
    raise exception 'SENTINEL 끈 토큰을 붙일 수 없어야 해요';
  exception when others then
    if sqlerrm like 'SENTINEL%' then raise; end if;
  end;
  assert public.share_animal(current_setting('t.a1')::uuid) <> current_setting('t.t1'), '다시 만들면 새 토큰';
end $$;
reset role;

-- 이용이 제한된 계정의 이력서는 보여 주지 않는다
select set_config('t.t2', (select token from public.animal_shares where animal_id = current_setting('t.a1')::uuid and revoked_at is null), true);
update public.profiles set status = 'blocked' where id = current_setting('t.u1')::uuid;
do $$ begin
  assert public.get_resume(current_setting('t.t2')) is null, '이용 제한 계정의 이력서는 숨겨요';
end $$;

rollback;
