-- VILLAIN ERA · 커뮤니티 안전장치 (2026-11-19)
-- 신고(서로 다른 3명이면 자동 숨김), 회원 차단, 금칙어, 운영자 처리. 앱스토어 UGC 심사 요건(1.2)도 함께 충족한다.

-- ─────────────────────────────────────────────────────────────
-- 숨김 표시 (클라이언트는 직접 바꿀 수 없음: 기존 컬럼 권한에 포함되지 않음)
-- ─────────────────────────────────────────────────────────────
alter table public.posts add column hidden boolean not null default false;
alter table public.comments add column hidden boolean not null default false;

-- ─────────────────────────────────────────────────────────────
-- 차단
-- ─────────────────────────────────────────────────────────────
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ─────────────────────────────────────────────────────────────
-- 신고
-- ─────────────────────────────────────────────────────────────
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'comment', 'user')),
  target_id uuid not null,
  target_user uuid references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'sexual', 'illegal', 'privacy', 'other')),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_kind, target_id)
);
create index reports_target_idx on public.reports (target_kind, target_id);
create index reports_target_user_idx on public.reports (target_user);
create index reports_open_idx on public.reports (created_at desc) where status = 'open';

-- ─────────────────────────────────────────────────────────────
-- 금칙어 (운영자가 관리. 공백을 끼워 넣어도 찾는다)
-- ─────────────────────────────────────────────────────────────
create table public.banned_words (
  word text primary key check (char_length(word) between 1 and 30),
  created_at timestamptz not null default now()
);
insert into public.banned_words (word) values
  ('씨발'), ('씨팔'), ('시팔'), ('ㅅㅂ'), ('ㅆㅂ'), ('병신'), ('ㅂㅅ'), ('개새끼'), ('개새기'), ('좆같'),
  ('지랄'), ('염병'), ('미친놈'), ('미친년'), ('니애미'), ('느금마'), ('썅년'), ('썅놈'), ('씹새'), ('엠창');

-- ─────────────────────────────────────────────────────────────
-- 권한 · RLS
-- ─────────────────────────────────────────────────────────────
revoke all on public.blocks, public.reports, public.banned_words from anon;
revoke update on public.blocks from authenticated;
revoke insert, update, delete on public.reports from authenticated;

alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.banned_words enable row level security;

create policy "blocks_select_own" on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "blocks_insert_own" on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and (select private.is_member()));
create policy "blocks_delete_own" on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create policy "reports_admin_select" on public.reports for select to authenticated
  using ((select private.is_admin()));

create policy "banned_words_admin_select" on public.banned_words for select to authenticated
  using ((select private.is_admin()));
create policy "banned_words_admin_insert" on public.banned_words for insert to authenticated
  with check ((select private.is_admin()));
create policy "banned_words_admin_delete" on public.banned_words for delete to authenticated
  using ((select private.is_admin()));

-- 글·댓글을 볼 수 있는지: 숨김이 아니거나(작성자·운영자는 예외) + 내가 차단한 작성자가 아님
create or replace function private.can_see(p_author uuid, p_hidden boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (not p_hidden or p_author = (select auth.uid()) or private.is_admin())
     and not exists (
       select 1 from public.blocks b
        where b.blocker_id = (select auth.uid()) and b.blocked_id = p_author
     );
$$;
revoke all on function private.can_see(uuid, boolean) from public, anon;
grant execute on function private.can_see(uuid, boolean) to authenticated;

drop policy "posts_select_member" on public.posts;
create policy "posts_select_member" on public.posts for select to authenticated
  using ((select private.is_member()) and private.can_see(author_id, hidden));

drop policy "comments_select_member" on public.comments;
create policy "comments_select_member" on public.comments for select to authenticated
  using ((select private.is_member()) and private.can_see(author_id, hidden));

-- ─────────────────────────────────────────────────────────────
-- 금칙어 검사 트리거
-- ─────────────────────────────────────────────────────────────
create or replace function private.has_banned(p_text text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.banned_words w
     where position(lower(w.word) in regexp_replace(lower(coalesce(p_text, '')), '\s', '', 'g')) > 0
  );
$$;

create or replace function private.reject_banned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_table_name = 'posts' and (private.has_banned(new.title) or private.has_banned(new.body)))
     or (tg_table_name = 'comments' and private.has_banned(new.body))
     or (tg_table_name = 'profiles' and (private.has_banned(new.nickname) or private.has_banned(new.bio))) then
    raise exception '사용할 수 없는 표현이 들어 있어요 · 운영정책을 확인해 주세요';
  end if;
  return new;
end;
$$;

create trigger posts_reject_banned
  before insert or update of title, body on public.posts
  for each row execute function private.reject_banned();
create trigger comments_reject_banned
  before insert or update of body on public.comments
  for each row execute function private.reject_banned();
create trigger profiles_reject_banned
  before update of nickname, bio on public.profiles
  for each row execute function private.reject_banned();

-- ─────────────────────────────────────────────────────────────
-- 댓글 알림: 글쓴이가 차단한 회원의 댓글은 알리지 않는다
-- ─────────────────────────────────────────────────────────────
create or replace function private.on_comment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.posts;
  v_who text;
  v_badge text;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id returning * into p;
    if p.author_id <> new.author_id
       and not exists (select 1 from public.blocks b where b.blocker_id = p.author_id and b.blocked_id = new.author_id) then
      select pr.nickname, case when pr.role = 'admin' then '운영자' else pr.badge end
        into v_who, v_badge
        from public.profiles pr where pr.id = new.author_id;
      perform private.notify(
        p.author_id, 'comment',
        case when p.cat = 'Q&A' then '내 질문에 답변이 달렸어요' else '내 글에 댓글이 달렸어요' end,
        coalesce(v_who, '회원') || coalesce(' · ' || v_badge, '') || ' — ' || left(new.body, 40),
        '/community/' || p.id
      );
    end if;
    return new;
  else
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 신고 (같은 대상은 1번, 서로 다른 3명이면 글·댓글 자동 숨김, 운영자에게 알림)
-- ─────────────────────────────────────────────────────────────
create or replace function public.report_content(p_kind text, p_id uuid, p_reason text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_user uuid;
  n int;
  adm record;
begin
  if me is null or not private.is_member() then
    raise exception '회원만 신고할 수 있어요';
  end if;
  if p_reason is null or p_reason not in ('spam', 'abuse', 'sexual', 'illegal', 'privacy', 'other') then
    raise exception '신고 이유를 골라 주세요';
  end if;
  if p_kind = 'post' then
    select author_id into v_user from public.posts where id = p_id;
  elsif p_kind = 'comment' then
    select author_id into v_user from public.comments where id = p_id;
  elsif p_kind = 'user' then
    select id into v_user from public.profiles where id = p_id;
  else
    raise exception '신고 대상을 확인해 주세요';
  end if;
  if v_user is null then
    raise exception '신고할 대상을 찾을 수 없어요';
  end if;
  if v_user = me then
    raise exception '내 글이나 내 계정은 신고할 수 없어요';
  end if;

  insert into public.reports (reporter_id, target_kind, target_id, target_user, reason, note)
  values (me, p_kind, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (reporter_id, target_kind, target_id) do nothing;
  if not found then
    return;
  end if;

  if p_kind in ('post', 'comment') then
    select count(distinct reporter_id) into n
      from public.reports
     where target_kind = p_kind and target_id = p_id and status = 'open';
    if n >= 3 then
      if p_kind = 'post' then
        update public.posts set hidden = true where id = p_id;
      else
        update public.comments set hidden = true where id = p_id;
      end if;
    end if;
  end if;

  for adm in select id from public.profiles where role = 'admin' and status = 'active' loop
    perform private.notify(
      adm.id, 'system', '신고 접수',
      case p_kind when 'post' then '게시글' when 'comment' then '댓글' else '회원' end || ' 신고가 들어왔어요',
      '/admin?tab=reports', 'report:' || p_kind || ':' || p_id
    );
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 운영자 처리: hide / unhide / delete / dismiss / block_user
-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_moderate(p_report bigint, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  if not private.is_admin() then
    raise exception '운영자만 처리할 수 있어요';
  end if;
  select * into r from public.reports where id = p_report;
  if not found then
    raise exception '신고를 찾을 수 없어요';
  end if;

  if p_action in ('hide', 'unhide') then
    if r.target_kind = 'post' then
      update public.posts set hidden = (p_action = 'hide') where id = r.target_id;
    elsif r.target_kind = 'comment' then
      update public.comments set hidden = (p_action = 'hide') where id = r.target_id;
    else
      raise exception '회원 신고는 숨길 수 없어요 — 이용 제한을 써 주세요';
    end if;
  elsif p_action = 'delete' then
    if r.target_kind = 'post' then
      delete from public.posts where id = r.target_id;
    elsif r.target_kind = 'comment' then
      delete from public.comments where id = r.target_id;
    else
      raise exception '회원은 삭제할 수 없어요 — 이용 제한을 써 주세요';
    end if;
  elsif p_action = 'block_user' then
    update public.profiles set status = 'blocked' where id = r.target_user and role <> 'admin';
  elsif p_action <> 'dismiss' then
    raise exception '처리 방법을 확인해 주세요';
  end if;

  update public.reports
     set status = case when p_action in ('dismiss', 'unhide') then 'dismissed' else 'actioned' end
   where target_kind = r.target_kind and target_id = r.target_id and status = 'open';
end;
$$;

revoke all on function public.report_content(text, uuid, text, text) from public, anon;
revoke all on function public.admin_moderate(bigint, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;
grant execute on function public.admin_moderate(bigint, text) to authenticated;
revoke all on function private.has_banned(text), private.reject_banned() from public, anon, authenticated;
