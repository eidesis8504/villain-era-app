-- VILLAIN ERA · 하루 점검 알림 (2026-11-19)
-- 매일 UTC 00:00(한국 09:00)에 사용자 시간대의 '오늘' 기준으로 점검하고, 같은 알림은 dedupe_key로 한 번만 보낸다.
-- ① 급여 공백(주기의 2배 초과, 공백 1번당 1번) ② 재진 하루 전 ③ 부화 예정 D-7·당일 ④ 산란 예정 D-3

create or replace function private.local_today(p_tz text)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  return (now() at time zone coalesce(p_tz, 'Asia/Seoul'))::date;
exception when others then
  return (now() at time zone 'Asia/Seoul')::date;
end;
$$;

create or replace function private.run_daily()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  t date;
  d int;
begin
  -- ① 급여 공백: 마지막 급여(없으면 개체 등록일) 후 주기의 2배를 넘김
  for r in
    select a.id, a.owner_id, a.code, a.name, a.feed_every_days, p.tz,
           coalesce((select max(f.fed_on) from public.feedings f where f.animal_id = a.id), a.created_at::date) as anchor
      from public.animals a
      join public.profiles p on p.id = a.owner_id and p.status = 'active'
     where a.status = 'keeping' and a.feed_every_days is not null
  loop
    t := private.local_today(r.tz);
    if t - r.anchor > r.feed_every_days * 2 then
      perform private.notify(
        r.owner_id, 'feeding',
        coalesce(nullif(r.name, ''), r.code) || ' 급여 기록이 ' || (t - r.anchor) || '일째 없어요',
        '급여 주기 ' || r.feed_every_days || '일 · 먹었다면 기록해 주세요',
        '/animals/' || r.id,
        'feed-gap:' || r.id || ':' || r.anchor
      );
    end if;
  end loop;

  -- ② 재진 하루 전
  for r in
    select v.id, v.owner_id, v.animal_id, v.clinic, v.next_visit, a.code, a.name, p.tz
      from public.vet_visits v
      join public.animals a on a.id = v.animal_id
      join public.profiles p on p.id = v.owner_id and p.status = 'active'
     where v.next_visit between current_date - 1 and current_date + 2
  loop
    if r.next_visit - private.local_today(r.tz) = 1 then
      perform private.notify(
        r.owner_id, 'health',
        '내일 ' || coalesce(nullif(r.name, ''), r.code) || ' 재진이에요',
        coalesce(nullif(r.clinic, ''), '병원'),
        '/animals/' || r.animal_id || '/health',
        'vet-next:' || r.id
      );
    end if;
  end loop;

  -- ③ 부화 예정 D-7 · 당일 (인큐 중인 알이 남은 차수만)
  for r in
    select c.id, c.owner_id, c.dam_id, c.seq, c.expected_from, c.fertile, c.dead, a.code, a.name, p.tz,
           (select count(*) from public.animals k where k.clutch_id = c.id) as hatched
      from public.clutches c
      join public.animals a on a.id = c.dam_id
      join public.profiles p on p.id = c.owner_id and p.status = 'active'
     where c.expected_from between current_date - 1 and current_date + 8
  loop
    if r.fertile - r.dead - r.hatched > 0 then
      d := r.expected_from - private.local_today(r.tz);
      if d = 7 then
        perform private.notify(
          r.owner_id, 'hatch',
          coalesce(nullif(r.name, ''), r.code) || ' ' || r.seq || '차 부화 예정 D-7',
          '부화 준비물을 확인해 주세요', '/clutch/' || r.dam_id, 'hatch-due:' || r.id || ':D7'
        );
      elsif d = 0 then
        perform private.notify(
          r.owner_id, 'hatch',
          coalesce(nullif(r.name, ''), r.code) || ' ' || r.seq || '차 부화 예정일이에요',
          '부화하면 부화 기록을 남겨 주세요', '/clutch/' || r.dam_id, 'hatch-due:' || r.id || ':D0'
        );
      end if;
    end if;
  end loop;

  -- ④ 산란 예정 D-3 (그라비드 확인 이후 아직 산란 기록이 없을 때)
  for r in
    select b.female_id, b.owner_id, b.gravid_on, b.lay_expected_on, a.code, a.name, p.tz
      from public.breeders b
      join public.animals a on a.id = b.female_id
      join public.profiles p on p.id = b.owner_id and p.status = 'active'
     where b.gravid_on is not null
       and b.lay_expected_on between current_date - 1 and current_date + 4
       and not exists (select 1 from public.clutches c where c.dam_id = b.female_id and c.laid_on >= b.gravid_on)
  loop
    if r.lay_expected_on - private.local_today(r.tz) = 3 then
      perform private.notify(
        r.owner_id, 'hatch',
        coalesce(nullif(r.name, ''), r.code) || ' 산란 예정 D-3',
        '산란통을 준비해 주세요', '/clutch/' || r.female_id,
        'lay-due:' || r.female_id || ':' || r.lay_expected_on
      );
    end if;
  end loop;
end;
$$;

revoke all on function private.local_today(text), private.run_daily() from public, anon, authenticated;

select cron.schedule('villain-era-daily', '0 0 * * *', $$ select private.run_daily(); $$);
