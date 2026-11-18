-- VILLAIN ERA · 운영자 검증 현황 집계 (2026-11-19)
-- 대상: 운영자·시험 계정을 뺀, 검증 시작일(app_config.launch_on) 이후 시작한 게스트 계정.
-- 첫날 = 계정 생성 시각을 사용자 시간대로 바꾼 날짜. 재방문 = 첫날 이후 N일 안에 'open'이 있음.

create or replace function private.to_local_date(p_ts timestamptz, p_tz text)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  return (p_ts at time zone coalesce(nullif(p_tz, ''), 'Asia/Seoul'))::date;
exception when others then
  return (p_ts at time zone 'Asia/Seoul')::date;
end;
$$;

create or replace function private.pct(p_part bigint, p_whole bigint)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_whole, 0) = 0 then null else round(100.0 * p_part / p_whole, 1) end;
$$;

create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_launch date;
  v_targets jsonb;
  v_users uuid[];
  v_mau uuid[];
  v_funnel jsonb;
  v_active jsonb;
  v_ret jsonb;
  v_features jsonb;
  v_sources jsonb;
  v_platforms jsonb;
  v_research jsonb;
  v_daily jsonb;
  v_feedback jsonb;
  v_survey jsonb;
  v_errors jsonb;
  v_reports jsonb;
  n_act bigint;
begin
  if not private.is_admin() then
    raise exception '운영자만 볼 수 있어요';
  end if;

  select (value #>> '{}')::date into v_launch from public.app_config where key = 'launch_on';
  v_launch := coalesce(v_launch, '2026-11-19'::date);
  select value into v_targets from public.app_config where key = 'targets';

  select coalesce(array_agg(p.id), '{}') into v_users
    from public.profiles p
   where p.role <> 'admin' and not p.is_test and private.to_local_date(p.created_at, 'Asia/Seoul') >= v_launch;

  select coalesce(array_agg(distinct e.user_id), '{}') into v_mau
    from public.usage_events e
   where e.name = 'open' and e.day > v_today - 30 and e.user_id = any (v_users);

  -- 방문 → 시작 → 첫 개체
  select count(distinct a.owner_id) into n_act from public.animals a where a.owner_id = any (v_users);
  v_funnel := jsonb_build_object(
    'landing', (select count(*) from public.landing_views where day >= v_launch),
    'started', cardinality(v_users),
    'activated', n_act,
    'activation_rate', private.pct(n_act, cardinality(v_users))
  );

  v_active := jsonb_build_object(
    'd1', (select count(distinct user_id) from public.usage_events where name = 'open' and day = v_today and user_id = any (v_users)),
    'd7', (select count(distinct user_id) from public.usage_events where name = 'open' and day > v_today - 7 and user_id = any (v_users)),
    'd30', cardinality(v_mau)
  );

  -- 재방문 D1·D7·D30
  select jsonb_object_agg('d' || t.n, jsonb_build_object('eligible', s.el, 'returned', s.rt, 'rate', private.pct(s.rt, s.el)))
    into v_ret
    from (values (1), (7), (30)) t (n)
    cross join lateral (
      select count(*) filter (where x.first_day <= v_today - t.n) as el,
             count(*) filter (
               where x.first_day <= v_today - t.n
                 and exists (
                   select 1 from public.usage_events e
                    where e.user_id = x.id and e.name = 'open' and e.day > x.first_day and e.day <= x.first_day + t.n
                 )
             ) as rt
        from (select p.id, private.to_local_date(p.created_at, p.tz) as first_day from public.profiles p where p.id = any (v_users)) x
    ) s;

  -- 기능별 최근 30일 사용률 (분모: 최근 30일에 앱을 연 사용자)
  with f as (
    select 'animal' as key, owner_id as id from public.animals where created_at > now() - interval '30 days'
    union select 'weight', owner_id from public.weights where created_at > now() - interval '30 days'
    union select 'feeding', owner_id from public.feedings where created_at > now() - interval '30 days'
    union select 'health', owner_id from public.health_logs where created_at > now() - interval '30 days'
    union select 'health', owner_id from public.vet_visits where created_at > now() - interval '30 days'
    union select 'breeding', owner_id from public.matings where created_at > now() - interval '30 days'
    union select 'breeding', owner_id from public.egg_checks where created_at > now() - interval '30 days'
    union select 'breeding', owner_id from public.clutches where created_at > now() - interval '30 days'
    union select 'todo', owner_id from public.todo_checks where created_at > now() - interval '30 days'
    union select 'community_write', author_id from public.posts where created_at > now() - interval '30 days'
    union select 'community_write', author_id from public.comments where created_at > now() - interval '30 days'
    union select 'transfer', owner_id from public.transfers where created_at > now() - interval '30 days'
    union select case name when 'view:community' then 'community_read' when 'view:scan' then 'scan'
                           when 'view:lineage' then 'lineage' else 'consult' end, user_id
            from public.usage_events
           where name in ('view:community', 'view:scan', 'view:lineage', 'view:consult') and day > v_today - 30
  )
  select jsonb_agg(
           jsonb_build_object('key', k.key, 'label', k.label, 'users', coalesce(c.n, 0), 'rate', private.pct(coalesce(c.n, 0), cardinality(v_mau)))
           order by k.ord)
    into v_features
    from (values ('animal', '개체 등록', 1), ('weight', '체중', 2), ('feeding', '급여', 3), ('health', '건강', 4),
                 ('breeding', '번식', 5), ('todo', '할 일', 6), ('community_write', '커뮤니티 글·댓글', 7),
                 ('community_read', '커뮤니티 읽기', 8), ('scan', 'QR 스캔', 9), ('lineage', '혈통', 10),
                 ('transfer', '분양 이전', 11), ('consult', '상담 카드', 12)) k (key, label, ord)
    left join (select key, count(distinct id) as n from f where id = any (v_mau) group by key) c on c.key = k.key;

  -- 유입 경로별
  select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'users', s.users, 'activated', s.act, 'd7_rate', private.pct(s.rt7, s.el7))
                            order by s.users desc, s.source), '[]'::jsonb)
    into v_sources
    from (
      select coalesce(p.source, 'direct') as source,
             count(*) as users,
             count(*) filter (where exists (select 1 from public.animals a where a.owner_id = p.id)) as act,
             count(*) filter (where private.to_local_date(p.created_at, p.tz) <= v_today - 7) as el7,
             count(*) filter (
               where private.to_local_date(p.created_at, p.tz) <= v_today - 7
                 and exists (
                   select 1 from public.usage_events e
                    where e.user_id = p.id and e.name = 'open'
                      and e.day > private.to_local_date(p.created_at, p.tz)
                      and e.day <= private.to_local_date(p.created_at, p.tz) + 7
                 )
             ) as rt7
        from public.profiles p
       where p.id = any (v_users)
       group by 1
    ) s;

  -- 기기별 (홈 화면 앱으로 연 적이 있는 사용자 수 포함)
  select coalesce(jsonb_agg(jsonb_build_object('platform', s.platform, 'users', s.users, 'standalone_users', s.pwa) order by s.users desc), '[]'::jsonb)
    into v_platforms
    from (
      select coalesce(p.first_platform, 'other') as platform,
             count(*) as users,
             count(*) filter (where exists (select 1 from public.usage_events e where e.user_id = p.id and e.name = 'open_pwa')) as pwa
        from public.profiles p
       where p.id = any (v_users)
       group by 1
    ) s;

  -- 리서치 기능 지표
  v_research := jsonb_build_object(
    'feeding', (
      select jsonb_build_object(
               'users30', u30, 'rate30', private.pct(u30, cardinality(v_mau)),
               'reuse_rate', private.pct(reused, feeders))
        from (
          select (select count(distinct owner_id) from public.feedings where created_at > now() - interval '30 days' and owner_id = any (v_users)) as u30,
                 count(*) as feeders,
                 count(*) filter (where days >= 2) as reused
            from (
              select f.owner_id, count(distinct f.created_at::date) filter (where f.created_at::date <= first_d + 30) as days
                from public.feedings f
                join (select owner_id, min(created_at::date) as first_d from public.feedings where owner_id = any (v_users) group by owner_id) m
                  on m.owner_id = f.owner_id
               group by f.owner_id
            ) per
        ) x
    ),
    'breeding', (
      select jsonb_build_object('breeder_users', b, 'recorded_users', r, 'rate', private.pct(r, b))
        from (
          select count(distinct br.owner_id) as b,
                 count(distinct br.owner_id) filter (
                   where exists (select 1 from public.matings m where m.owner_id = br.owner_id)
                      or exists (select 1 from public.egg_checks e where e.owner_id = br.owner_id)
                 ) as r
            from public.breeders br
           where br.owner_id = any (v_users)
        ) x
    ),
    'health', (
      select jsonb_build_object('users30', n, 'rate30', private.pct(n, cardinality(v_mau)))
        from (
          select count(distinct id) as n from (
            select owner_id as id from public.health_logs where created_at > now() - interval '30 days' and owner_id = any (v_users)
            union
            select owner_id from public.vet_visits where created_at > now() - interval '30 days' and owner_id = any (v_users)
          ) h
        ) x
    ),
    'consult', (
      select jsonb_build_object(
               'qa_with_card', count(*) filter (where p.attach ->> 'kind' = 'health'),
               'adopted_with_card', count(*) filter (where p.attach ->> 'kind' = 'health' and p.has_adopted),
               'qa_without_card', count(*) filter (where coalesce(p.attach ->> 'kind', '') <> 'health'),
               'adopted_without_card', count(*) filter (where coalesce(p.attach ->> 'kind', '') <> 'health' and p.has_adopted))
        from public.posts p
       where p.cat = 'Q&A' and p.author_id = any (v_users)
    )
  );

  -- 최근 14일 신규·활성
  select jsonb_agg(
           jsonb_build_object(
             'day', d::date,
             'new_users', (select count(*) from public.profiles p where p.id = any (v_users) and private.to_local_date(p.created_at, p.tz) = d::date),
             'active_users', (select count(distinct e.user_id) from public.usage_events e where e.user_id = any (v_users) and e.name = 'open' and e.day = d::date))
           order by d)
    into v_daily
    from generate_series(v_today - 13, v_today, interval '1 day') d;

  v_feedback := jsonb_build_object(
    'new', (select count(*) from public.feedback where status = 'new'),
    'total', (select count(*) from public.feedback where private.to_local_date(created_at, 'Asia/Seoul') >= v_launch)
  );

  select jsonb_build_object(
           'responses', count(*),
           'promoters', count(*) filter (where nps >= 9),
           'passives', count(*) filter (where nps between 7 and 8),
           'detractors', count(*) filter (where nps <= 6),
           'nps', case when count(*) = 0 then null
                       else round(100.0 * (count(*) filter (where nps >= 9) - count(*) filter (where nps <= 6)) / count(*)) end)
    into v_survey
    from public.survey_responses
   where user_id = any (v_users);

  v_errors := jsonb_build_object(
    'last7', (select count(*) from public.client_errors where created_at > now() - interval '7 days'),
    'top', (
      select coalesce(jsonb_agg(jsonb_build_object('message', message, 'count', n) order by n desc), '[]'::jsonb)
        from (
          select message, count(*) as n from public.client_errors
           where created_at > now() - interval '7 days'
           group by message order by n desc limit 5
        ) t
    )
  );

  v_reports := jsonb_build_object('open', (select count(*) from public.reports where status = 'open'));

  return jsonb_build_object(
    'launch_on', v_launch,
    'today', v_today,
    'targets', v_targets,
    'funnel', v_funnel,
    'active', v_active,
    'retention', v_ret,
    'features', v_features,
    'sources', v_sources,
    'platforms', v_platforms,
    'research', v_research,
    'daily', v_daily,
    'feedback', v_feedback,
    'survey', v_survey,
    'errors', v_errors,
    'reports', v_reports
  );
end;
$$;

-- 운영 설정 바꾸기 (검증 시작일·기준)
create or replace function public.admin_set_config(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception '운영자만 바꿀 수 있어요';
  end if;
  if p_key not in ('launch_on', 'targets') then
    raise exception '바꿀 수 없는 설정이에요';
  end if;
  insert into public.app_config (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

revoke all on function private.to_local_date(timestamptz, text), private.pct(bigint, bigint) from public, anon, authenticated;
revoke all on function public.admin_metrics(), public.admin_set_config(text, jsonb) from public, anon;
grant execute on function public.admin_metrics(), public.admin_set_config(text, jsonb) to authenticated;
