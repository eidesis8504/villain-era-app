-- VILLAIN ERA · 할 일 사전 알림 + 웹 푸시 예약 발송
-- 1분마다: (1) 알림 시각이 된 할 일을 알림함에 넣고 (2) 푸시 대기 건이 있으면 push-dispatch 함수를 깨운다.
-- 비밀값(project_url, push_dispatch_secret, VAPID 키)은 Vault에만 저장한다 — 이 파일에는 없다.

create or replace function private.enqueue_due_todo_alarms()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key, push_state)
  select
    t.owner_id,
    'todo',
    '할 일 알림 · ' || t.title,
    case when d.day > (now() at time zone p.tz)::date then '내일 ' else '' end
      || to_char(t.time_of_day, 'HH24:MI') || ' 예정 · '
      || case t.alarm_minutes when 10 then '10분 전' when 30 then '30분 전' else '1일 전' end || ' 알림',
    '/todo',
    'todo:' || t.id || ':' || d.day || ':' || to_char(t.time_of_day, 'HH24MI') || ':' || t.alarm_minutes,
    case when exists (select 1 from public.push_subscriptions s where s.user_id = t.owner_id)
         then 'pending' else 'none' end
  from public.todos t
  join public.profiles p on p.id = t.owner_id and p.status = 'active' and p.todo_alarm
  cross join lateral (
    select ((now() at time zone p.tz)::date + k) as day from generate_series(0, 1) k
  ) d
  where t.alarm_minutes > 0
    and (
      (t.mode = 'once' and t.once_date = d.day)
      or (t.mode = 'days' and extract(dow from d.day)::smallint = any (t.days))
    )
    and not exists (select 1 from public.todo_checks c where c.todo_id = t.id and c.day = d.day)
    and ((d.day + t.time_of_day) at time zone p.tz) - make_interval(mins => t.alarm_minutes) <= now()
    and ((d.day + t.time_of_day) at time zone p.tz) - make_interval(mins => t.alarm_minutes) > now() - interval '15 minutes'
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function private.kick_push_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  -- 발송 중 멈춘 건(함수 오류 등)은 실패로 정리해 무한 재시도를 막는다
  update public.notifications
     set push_state = 'failed'
   where push_state = 'sending' and created_at < now() - interval '10 minutes';

  if not exists (select 1 from public.notifications where push_state = 'pending') then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret' limit 1;
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/push-dispatch',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 20000
  );
end;
$$;

create or replace function private.run_minutely()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_due_todo_alarms();
  perform private.kick_push_dispatch();
end;
$$;

revoke all on function private.enqueue_due_todo_alarms(), private.kick_push_dispatch(), private.run_minutely()
  from public, anon, authenticated;

select cron.schedule('villain-era-minutely', '* * * * *', $$ select private.run_minutely(); $$);
