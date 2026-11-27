-- VILLAIN ERA · 채팅 (2026-11-27)
-- 1:1 대화(dm)와 운영자 문의(support)를 대화방·메시지 표 두 개로 다룬다.
-- 메시지는 함수(send_message)로만 보낸다: 참여자 확인·차단·금칙어·속도 제한·알림을 한곳에서 처리한다.
-- 신고된 1:1 대화는 신고가 열려 있는 동안만 운영자가 읽을 수 있다.
-- 추가형 변경이다: 지금 운영 중인 화면은 그대로 동작한다.

-- ─────────────────────────────────────────────────────────────
-- 알림 종류 'chat' (푸시 대상) · 신고 대상 'chat'
-- ─────────────────────────────────────────────────────────────
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('todo', 'weight', 'comment', 'hatch', 'notice', 'transfer', 'system', 'feeding', 'health', 'chat'));

alter table public.reports drop constraint reports_target_kind_check;
alter table public.reports add constraint reports_target_kind_check
  check (target_kind in ('post', 'comment', 'user', 'chat'));

create or replace function private.notify(
  p_user uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_link text default null,
  p_dedupe text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key, push_state)
  values (
    p_user, p_kind, p_title, coalesce(p_body, ''), p_link, p_dedupe,
    case
      when p_kind in ('todo', 'comment', 'notice', 'transfer', 'feeding', 'hatch', 'health', 'chat')
           and exists (select 1 from public.push_subscriptions s where s.user_id = p_user)
      then 'pending' else 'none'
    end
  )
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 대화방과 메시지
--   dm:      user_a < user_b (같은 두 사람의 방은 하나)
--   support: user_a = 문의한 회원, user_b = null (운영자 쪽 읽음 표시는 b_read_at)
-- ─────────────────────────────────────────────────────────────
create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm', 'support')),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message text not null default '',
  last_sender uuid,
  a_read_at timestamptz not null default now(),
  b_read_at timestamptz not null default now(),
  check ((kind = 'dm' and user_b is not null and user_a < user_b) or (kind = 'support' and user_b is null))
);
create unique index chat_rooms_dm_idx on public.chat_rooms (user_a, user_b) where kind = 'dm';
create unique index chat_rooms_support_idx on public.chat_rooms (user_a) where kind = 'support';
create index chat_rooms_user_b_idx on public.chat_rooms (user_b);
create index chat_rooms_created_by_idx on public.chat_rooms (created_by, created_at);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index chat_messages_room_idx on public.chat_messages (room_id, id);
create index chat_messages_sender_idx on public.chat_messages (sender_id, created_at);

-- 읽기만 허용한다. 쓰기는 아래 함수로만
revoke all on public.chat_rooms, public.chat_messages from anon, authenticated;
grant select on public.chat_rooms, public.chat_messages to authenticated;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;

-- 이 방을 읽을 수 있는지:
--   1:1 대화의 참여자 (내가 상대를 차단했으면 보이지 않는다)
--   운영자 문의의 본인과 운영자
--   신고가 열려 있는 1:1 대화의 운영자
create or replace function private.can_read_room(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member() and exists (
    select 1 from public.chat_rooms r
     where r.id = p_room
       and (
         (r.kind = 'dm' and (select auth.uid()) in (r.user_a, r.user_b)
            and not exists (
              select 1 from public.blocks b
               where b.blocker_id = (select auth.uid())
                 and b.blocked_id = case when r.user_a = (select auth.uid()) then r.user_b else r.user_a end))
         or (r.kind = 'support' and (r.user_a = (select auth.uid()) or private.is_admin()))
         or (r.kind = 'dm' and private.is_admin() and exists (
              select 1 from public.reports rp
               where rp.target_kind = 'chat' and rp.target_id = r.id and rp.status = 'open'))
       )
  );
$$;
revoke all on function private.can_read_room(uuid) from public, anon;
grant execute on function private.can_read_room(uuid) to authenticated;

create policy "chat_rooms_select" on public.chat_rooms for select to authenticated
  using (private.can_read_room(id));
create policy "chat_messages_select" on public.chat_messages for select to authenticated
  using (private.can_read_room(room_id));

-- ─────────────────────────────────────────────────────────────
-- 1:1 대화 시작: 이미 있으면 그 방. 새로 만들 때는 새 계정 제한(분양·홍보 글과 같음)과 하루 10개 제한
-- ─────────────────────────────────────────────────────────────
create or replace function public.open_dm(p_user uuid, p_post uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  v_room uuid;
begin
  if me is null or not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  if p_user is null or p_user = me then
    raise exception '나에게는 메시지를 보낼 수 없어요';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'active') then
    raise exception '대화할 수 없는 회원이에요';
  end if;
  if exists (select 1 from public.blocks where blocker_id = me and blocked_id = p_user) then
    raise exception '차단한 회원이에요 · 전체 › 차단 관리에서 풀면 대화할 수 있어요';
  end if;
  a := least(me, p_user);
  b := greatest(me, p_user);
  select id into v_room from public.chat_rooms where kind = 'dm' and user_a = a and user_b = b;
  if v_room is not null then
    return v_room;
  end if;
  if exists (select 1 from public.blocks where blocker_id = p_user and blocked_id = me) then
    raise exception '대화할 수 없는 회원이에요';
  end if;
  if not private.can_trade(me) then
    raise exception '채팅은 앱을 시작한 지 24시간이 지나고 개체를 1마리 이상 등록한 뒤에 시작할 수 있어요';
  end if;
  if not private.is_admin()
     and (select count(*) from public.chat_rooms
           where created_by = me and kind = 'dm' and created_at > now() - interval '24 hours') >= 10 then
    raise exception '하루에 새로 시작할 수 있는 대화는 10개까지예요 · 내일 다시 시도해 주세요';
  end if;
  insert into public.chat_rooms (kind, user_a, user_b, post_id, created_by)
  values ('dm', a, b, (select id from public.posts where id = p_post), me)
  on conflict do nothing
  returning id into v_room;
  if v_room is null then
    select id into v_room from public.chat_rooms where kind = 'dm' and user_a = a and user_b = b;
  end if;
  return v_room;
end;
$$;

-- 운영자 문의방: 회원마다 하나 (시작 제한 없음)
create or replace function public.open_support()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_room uuid;
begin
  if me is null or not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  select id into v_room from public.chat_rooms where kind = 'support' and user_a = me;
  if v_room is not null then
    return v_room;
  end if;
  insert into public.chat_rooms (kind, user_a, created_by) values ('support', me, me)
  on conflict do nothing
  returning id into v_room;
  if v_room is null then
    select id into v_room from public.chat_rooms where kind = 'support' and user_a = me;
  end if;
  return v_room;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 메시지 보내기
-- ─────────────────────────────────────────────────────────────
create or replace function public.send_message(p_room uuid, p_body text)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r public.chat_rooms;
  v_body text := btrim(coalesce(p_body, ''));
  v_other uuid;
  v_operator boolean := false;
  v_name text;
  v_slot text := floor(extract(epoch from now()) / 600)::text;
  m public.chat_messages;
  adm record;
begin
  if me is null or not private.is_member() then
    raise exception '회원만 이용할 수 있어요';
  end if;
  if v_body = '' or char_length(v_body) > 1000 then
    raise exception '메시지는 1자 이상 1000자 이하로 써 주세요';
  end if;
  select * into r from public.chat_rooms where id = p_room for update;
  if not found then
    raise exception '대화를 찾을 수 없어요';
  end if;
  if r.kind = 'dm' then
    if me <> r.user_a and me <> r.user_b then
      raise exception '대화를 찾을 수 없어요';
    end if;
    v_other := case when r.user_a = me then r.user_b else r.user_a end;
    if exists (select 1 from public.blocks
                where (blocker_id = me and blocked_id = v_other) or (blocker_id = v_other and blocked_id = me))
       or not exists (select 1 from public.profiles where id = v_other and status = 'active') then
      raise exception '이 대화에는 메시지를 보낼 수 없어요';
    end if;
  elsif r.user_a <> me then
    if not private.is_admin() then
      raise exception '대화를 찾을 수 없어요';
    end if;
    v_operator := true;
  end if;
  if private.has_banned(v_body) then
    raise exception '사용할 수 없는 표현이 들어 있어요 · 운영정책을 확인해 주세요';
  end if;
  if (select count(*) from public.chat_messages
       where sender_id = me and created_at > now() - interval '1 minute') >= 20 then
    raise exception '메시지를 너무 빠르게 보내고 있어요 · 잠시 후 다시 보내 주세요';
  end if;

  insert into public.chat_messages (room_id, sender_id, body) values (r.id, me, v_body) returning * into m;
  -- 보낸 쪽은 방금 보낸 메시지까지 읽은 것으로 둔다
  update public.chat_rooms
     set last_message_at = m.created_at,
         last_message = left(v_body, 80),
         last_sender = me,
         a_read_at = case when (r.kind = 'dm' and r.user_a = me) or (r.kind = 'support' and not v_operator)
                          then m.created_at else a_read_at end,
         b_read_at = case when (r.kind = 'dm' and r.user_b = me) or (r.kind = 'support' and v_operator)
                          then m.created_at else b_read_at end
   where id = r.id;

  -- 알림: 같은 방은 10분에 한 번, 메시지 내용은 넣지 않는다
  select coalesce(nickname, '사육자') into v_name from public.profiles where id = me;
  if r.kind = 'dm' then
    perform private.notify(v_other, 'chat', v_name || '님의 메시지', '새 메시지가 왔어요', '/chat/' || r.id,
                           'chat:' || r.id || ':' || v_slot);
  elsif v_operator then
    perform private.notify(r.user_a, 'chat', '운영자가 답했어요', '문의에 답변이 왔어요', '/inquiry',
                           'inquiry:' || r.id || ':' || v_slot);
  else
    for adm in select id from public.profiles where role = 'admin' and status = 'active' and id <> me loop
      perform private.notify(adm.id, 'chat', '문의가 왔어요', v_name || '님이 문의를 남겼어요', '/admin/inquiry/' || r.id,
                             'inquiry-in:' || r.id || ':' || v_slot);
    end loop;
  end if;
  return m;
end;
$$;

-- 읽음 처리: 내 쪽 시각만 바꾼다 (운영자 문의에서 운영자는 b 쪽)
create or replace function public.mark_room_read(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  update public.chat_rooms
     set a_read_at = case when user_a = me then now() else a_read_at end,
         b_read_at = case when (kind = 'dm' and user_b = me) or (kind = 'support' and user_a <> me and private.is_admin())
                          then now() else b_read_at end
   where id = p_room
     and (user_a = me or user_b = me or (kind = 'support' and private.is_admin()));
end;
$$;

-- 대화 신고: 참여자만. 신고가 열려 있는 동안 운영자가 그 대화를 읽을 수 있다 (can_read_room)
create or replace function public.report_chat(p_room uuid, p_reason text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r public.chat_rooms;
  adm record;
begin
  if me is null or not private.is_member() then
    raise exception '회원만 신고할 수 있어요';
  end if;
  if p_reason is null or p_reason not in ('spam', 'abuse', 'sexual', 'illegal', 'privacy', 'other') then
    raise exception '신고 이유를 골라 주세요';
  end if;
  select * into r from public.chat_rooms where id = p_room and kind = 'dm' and (user_a = me or user_b = me);
  if not found then
    raise exception '신고할 대화를 찾을 수 없어요';
  end if;
  insert into public.reports (reporter_id, target_kind, target_id, target_user, reason, note)
  values (me, 'chat', r.id, case when r.user_a = me then r.user_b else r.user_a end, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (reporter_id, target_kind, target_id) do nothing;
  if not found then
    return;
  end if;
  for adm in select id from public.profiles where role = 'admin' and status = 'active' loop
    perform private.notify(adm.id, 'system', '신고 접수', '대화 신고가 들어왔어요', '/admin?tab=reports', 'report:chat:' || r.id);
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 실행 권한 · 실시간
-- ─────────────────────────────────────────────────────────────
revoke all on function public.open_dm(uuid, uuid) from public, anon;
revoke all on function public.open_support() from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.mark_room_read(uuid) from public, anon;
revoke all on function public.report_chat(uuid, text, text) from public, anon;
grant execute on function public.open_dm(uuid, uuid) to authenticated;
grant execute on function public.open_support() to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_room_read(uuid) to authenticated;
grant execute on function public.report_chat(uuid, text, text) to authenticated;

-- 열려 있는 대화가 새 메시지를 바로 받는다 (읽기 권한은 위 정책 그대로 적용된다)
alter publication supabase_realtime add table public.chat_messages;
