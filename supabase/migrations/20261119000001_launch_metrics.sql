-- VILLAIN ERA · 검증용 측정 (2026-11-19)
-- 외부 분석 도구 없이 우리 DB에만 최소한으로 기록한다.
-- 환영 화면 방문, 하루 단위 사용 흔적, 첫 유입 경로, 의견, 2주 차 설문, 앱 오류, 운영 설정.

-- ─────────────────────────────────────────────────────────────
-- 프로필: 첫 유입 경로·첫 접속 기기·시험 계정 표시 (클라이언트가 직접 바꿀 수 없음)
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column source text check (source is null or char_length(source) <= 40),
  add column first_platform text check (first_platform is null or first_platform in ('ios', 'android', 'desktop', 'other')),
  add column is_test boolean not null default false;

-- 검증 시작 전에 만들어진 게스트(개발 중 시험 계정)는 집계에서 뺀다
update public.profiles set is_test = true where created_at < '2026-11-19';

-- ─────────────────────────────────────────────────────────────
-- 운영 설정 (검증 시작일, 검증 기준)
-- ─────────────────────────────────────────────────────────────
create table public.app_config (
  key text primary key check (char_length(key) <= 40),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values
  ('launch_on', 'null'::jsonb),
  ('targets', '{"activation": 40, "d7": 25, "feeding30": 35}'::jsonb);

-- ─────────────────────────────────────────────────────────────
-- 환영 화면 방문 (계정 없이 기록)
-- ─────────────────────────────────────────────────────────────
create table public.landing_views (
  id bigint generated always as identity primary key,
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  src text not null default 'direct' check (char_length(src) between 1 and 40),
  platform text not null check (platform in ('ios', 'android', 'desktop', 'other')),
  inapp text check (inapp is null or char_length(inapp) <= 20),
  created_at timestamptz not null default now()
);
create index landing_views_day_idx on public.landing_views (day);

-- ─────────────────────────────────────────────────────────────
-- 하루 단위 사용 흔적: open(앱 열기), open_pwa(홈 화면 앱), view:<화면>
-- ─────────────────────────────────────────────────────────────
create table public.usage_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  name text not null check (name ~ '^[a-z_:]{2,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, day, name)
);
create index usage_events_name_day_idx on public.usage_events (name, day);

-- ─────────────────────────────────────────────────────────────
-- 의견 · 설문 · 앱 오류
-- ─────────────────────────────────────────────────────────────
create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('불편해요', '제안', '좋아요', '기타')),
  body text not null check (char_length(body) between 1 and 1000),
  path text not null default '' check (char_length(path) <= 200),
  app_version text not null default '' check (char_length(app_version) <= 30),
  ua text not null default '' check (char_length(ua) <= 300),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);
create index feedback_user_idx on public.feedback (user_id);
create index feedback_created_idx on public.feedback (created_at desc);

create table public.survey_responses (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  survey text not null default 'd14' check (survey in ('d14')),
  nps smallint not null check (nps between 0 and 10),
  best_feature text not null default '' check (char_length(best_feature) <= 30),
  wish text not null default '' check (char_length(wish) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, survey)
);

create table public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 500),
  stack text not null default '' check (char_length(stack) <= 4000),
  path text not null default '' check (char_length(path) <= 200),
  app_version text not null default '' check (char_length(app_version) <= 30),
  ua text not null default '' check (char_length(ua) <= 300),
  created_at timestamptz not null default now()
);
create index client_errors_user_created_idx on public.client_errors (user_id, created_at);
create index client_errors_created_idx on public.client_errors (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 권한: 측정 테이블은 RPC로만 쓰고, 의견·설문은 본인 것만 쓴다
-- ─────────────────────────────────────────────────────────────
revoke all on public.app_config, public.landing_views, public.usage_events, public.client_errors from anon;
revoke insert, update, delete on public.landing_views, public.usage_events, public.client_errors from authenticated;
revoke all on public.feedback, public.survey_responses from anon;
revoke insert, update on public.feedback from authenticated;
grant insert (kind, body, path, app_version, ua) on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;
revoke insert, update on public.survey_responses from authenticated;
grant insert (nps, best_feature, wish) on public.survey_responses to authenticated;

alter table public.app_config enable row level security;
alter table public.landing_views enable row level security;
alter table public.usage_events enable row level security;
alter table public.feedback enable row level security;
alter table public.survey_responses enable row level security;
alter table public.client_errors enable row level security;

create policy "app_config_admin_select" on public.app_config for select to authenticated
  using ((select private.is_admin()));
create policy "app_config_admin_insert" on public.app_config for insert to authenticated
  with check ((select private.is_admin()));
create policy "app_config_admin_update" on public.app_config for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "feedback_insert_own" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "feedback_admin_select" on public.feedback for select to authenticated
  using ((select private.is_admin()));
create policy "feedback_admin_update" on public.feedback for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "survey_insert_own" on public.survey_responses for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "survey_select_own_or_admin" on public.survey_responses for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "client_errors_admin_select" on public.client_errors for select to authenticated
  using ((select private.is_admin()));

-- ─────────────────────────────────────────────────────────────
-- RPC
-- ─────────────────────────────────────────────────────────────

-- 환영 화면 방문 (로그인 전에도 호출)
create or replace function public.log_landing(p_src text, p_platform text, p_inapp text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.landing_views (src, platform, inapp)
  values (
    coalesce(nullif(left(regexp_replace(lower(coalesce(p_src, '')), '[^a-z0-9-]', '', 'g'), 40), ''), 'direct'),
    case when p_platform in ('ios', 'android', 'desktop', 'other') then p_platform else 'other' end,
    nullif(left(regexp_replace(lower(coalesce(p_inapp, '')), '[^a-z0-9-]', '', 'g'), 20), '')
  );
end;
$$;

-- 첫 유입 경로·기기 (이미 있으면 유지)
create or replace function public.set_first_touch(p_source text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles
     set source = coalesce(source, nullif(left(regexp_replace(lower(coalesce(p_source, '')), '[^a-z0-9-]', '', 'g'), 40), '')),
         first_platform = coalesce(first_platform,
           case when p_platform in ('ios', 'android', 'desktop', 'other') then p_platform end)
   where id = auth.uid();
end;
$$;

-- 하루 단위 사용 흔적 (날짜는 사용자 시간대 기준, 같은 날 같은 이름은 1행)
create or replace function public.track(p_names text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_day date;
begin
  if auth.uid() is null or p_names is null then
    return;
  end if;
  select tz into v_tz from public.profiles where id = auth.uid();
  if not found then
    return;
  end if;
  begin
    v_day := (now() at time zone coalesce(v_tz, 'Asia/Seoul'))::date;
  exception when others then
    v_day := (now() at time zone 'Asia/Seoul')::date;
  end;
  insert into public.usage_events (user_id, day, name)
  select auth.uid(), v_day, n
    from (select distinct unnest(p_names[1:20]) as n) s
   where n ~ '^[a-z_:]{2,40}$'
  on conflict do nothing;
end;
$$;

-- 앱 오류 (사용자당 하루 50건까지)
create or replace function public.log_client_error(p_message text, p_stack text, p_path text, p_version text, p_ua text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if (select count(*) from public.client_errors
       where user_id = auth.uid() and created_at > now() - interval '1 day') >= 50 then
    return;
  end if;
  insert into public.client_errors (user_id, message, stack, path, app_version, ua)
  values (auth.uid(), left(coalesce(p_message, ''), 500), left(coalesce(p_stack, ''), 4000),
          left(coalesce(p_path, ''), 200), left(coalesce(p_version, ''), 30), left(coalesce(p_ua, ''), 300));
end;
$$;

revoke all on function public.log_landing(text, text, text) from public;
revoke all on function public.set_first_touch(text, text) from public, anon;
revoke all on function public.track(text[]) from public, anon;
revoke all on function public.log_client_error(text, text, text, text, text) from public, anon;
grant execute on function public.log_landing(text, text, text) to anon, authenticated;
grant execute on function public.set_first_touch(text, text) to authenticated;
grant execute on function public.track(text[]) to authenticated;
grant execute on function public.log_client_error(text, text, text, text, text) to authenticated;
