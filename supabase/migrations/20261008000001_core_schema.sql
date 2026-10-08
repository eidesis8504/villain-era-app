-- VILLAIN ERA · 핵심 스키마
-- 모든 사육 데이터는 소유자(owner_id)별로 격리되고, 클로즈드 베타 회원(status = 'active')만 접근할 수 있다.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;

-- ─────────────────────────────────────────────────────────────
-- 회원 프로필
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) between 2 and 12),
  bio text not null default '' check (char_length(bio) <= 60),
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  badge text check (badge in ('브리더', '전문가')),
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
  coi_limit numeric(6, 3) not null default 6.25 check (coi_limit > 0 and coi_limit <= 50),
  todo_alarm boolean not null default true,
  tz text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

-- 회원 여부·관리자 여부 (RLS에서 사용, SECURITY DEFINER로 profiles RLS 재귀를 피한다)
create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active'
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active' and role = 'admin'
  );
$$;

revoke all on function private.is_member(), private.is_admin() from public;
grant execute on function private.is_member(), private.is_admin() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 초대 코드 (클로즈드 베타)
-- ─────────────────────────────────────────────────────────────
create table public.invite_codes (
  code text primary key check (code ~ '^[A-Z0-9]{4,16}$'),
  role text not null default 'member' check (role in ('admin', 'member')),
  max_uses int not null default 1 check (max_uses between 1 and 1000),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz,
  note text not null default '' check (char_length(note) <= 60),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invite_codes_created_by_idx on public.invite_codes (created_by);

create table public.invite_redemptions (
  code text not null references public.invite_codes (code) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
create index invite_redemptions_user_idx on public.invite_redemptions (user_id);

-- ─────────────────────────────────────────────────────────────
-- 개체 · 체중 · 산란 · 혈통
-- (owner_id, X) 복합 외래키로 "같은 사육자의 개체끼리만" 연결되도록 DB가 보장한다.
-- ─────────────────────────────────────────────────────────────
create table public.animals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  species text not null default '크레스티드게코' check (char_length(species) between 1 and 30),
  name text not null default '' check (char_length(name) <= 30),
  sex text not null default 'U' check (sex in ('F', 'M', 'U')),
  morph text not null default '' check (char_length(morph) <= 60),
  hatch_date date,
  status text not null default 'keeping' check (status in ('keeping', 'sold', 'dead', 'external')),
  sire_id uuid,
  dam_id uuid,
  clutch_id uuid,
  photo_path text,
  origin jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code),
  unique (owner_id, id),
  check (sire_id is distinct from id and dam_id is distinct from id),
  foreign key (owner_id, sire_id) references public.animals (owner_id, id) on delete set null (sire_id),
  foreign key (owner_id, dam_id) references public.animals (owner_id, id) on delete set null (dam_id)
);
create index animals_owner_sire_idx on public.animals (owner_id, sire_id);
create index animals_owner_dam_idx on public.animals (owner_id, dam_id);
create index animals_owner_clutch_idx on public.animals (owner_id, clutch_id);

create table public.weights (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  animal_id uuid not null,
  measured_on date not null,
  grams numeric(8, 1) not null check (grams > 0 and grams < 100000),
  created_at timestamptz not null default now(),
  unique (animal_id, measured_on),
  foreign key (owner_id, animal_id) references public.animals (owner_id, id) on delete cascade
);
create index weights_owner_animal_idx on public.weights (owner_id, animal_id);

create table public.breeders (
  female_id uuid primary key,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  male_id uuid,
  created_at timestamptz not null default now(),
  foreign key (owner_id, female_id) references public.animals (owner_id, id) on delete cascade,
  foreign key (owner_id, male_id) references public.animals (owner_id, id) on delete set null (male_id)
);
create index breeders_owner_female_idx on public.breeders (owner_id, female_id);
create index breeders_owner_male_idx on public.breeders (owner_id, male_id);

create table public.clutches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  dam_id uuid not null,
  sire_id uuid,
  seq int not null check (seq between 1 and 999),
  laid_on date not null,
  eggs int not null check (eggs between 1 and 200),
  fertile int not null check (fertile >= 0 and fertile <= eggs),
  dead int not null default 0 check (dead >= 0),
  dead_on date,
  dead_note text not null default '' check (char_length(dead_note) <= 100),
  created_at timestamptz not null default now(),
  unique (dam_id, seq),
  unique (owner_id, id),
  foreign key (owner_id, dam_id) references public.animals (owner_id, id) on delete cascade,
  foreign key (owner_id, sire_id) references public.animals (owner_id, id) on delete set null (sire_id)
);
create index clutches_owner_dam_idx on public.clutches (owner_id, dam_id);
create index clutches_owner_sire_idx on public.clutches (owner_id, sire_id);

alter table public.animals
  add constraint animals_clutch_fkey foreign key (owner_id, clutch_id)
  references public.clutches (owner_id, id) on delete set null (clutch_id);

-- ─────────────────────────────────────────────────────────────
-- 오늘의 할 일
-- ─────────────────────────────────────────────────────────────
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  time_of_day time not null,
  mode text not null check (mode in ('days', 'once')),
  days smallint[] not null default '{}',
  once_date date,
  alarm_minutes int not null default 10 check (alarm_minutes in (0, 10, 30, 1440)),
  tag text not null default '기타' check (tag in ('급여', '분무', '청소', '체중', '점검', '기타')),
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  check (
    (mode = 'days' and cardinality(days) > 0 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    or (mode = 'once' and once_date is not null)
  )
);
create index todos_owner_idx on public.todos (owner_id);

create table public.todo_checks (
  todo_id uuid not null,
  day date not null,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (todo_id, day),
  foreign key (owner_id, todo_id) references public.todos (owner_id, id) on delete cascade
);
create index todo_checks_owner_todo_idx on public.todo_checks (owner_id, todo_id);
create index todo_checks_owner_day_idx on public.todo_checks (owner_id, day);

-- ─────────────────────────────────────────────────────────────
-- 분양 이전
-- ─────────────────────────────────────────────────────────────
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  animal_id uuid,
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  recipient_label text not null default '' check (char_length(recipient_label) <= 30),
  include_weights boolean not null default true,
  include_lineage boolean not null default true,
  include_clutches boolean not null default true,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  claimed_animal_id uuid,
  canceled_at timestamptz,
  foreign key (owner_id, animal_id) references public.animals (owner_id, id) on delete set null (animal_id)
);
create index transfers_owner_animal_idx on public.transfers (owner_id, animal_id);
create index transfers_claimed_by_idx on public.transfers (claimed_by);

-- ─────────────────────────────────────────────────────────────
-- 알림 · 웹 푸시 구독
-- ─────────────────────────────────────────────────────────────
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('todo', 'weight', 'comment', 'hatch', 'notice', 'transfer', 'system')),
  title text not null,
  body text not null default '',
  link text,
  dedupe_key text,
  push_state text not null default 'none' check (push_state in ('none', 'pending', 'sending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, dedupe_key)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_push_pending_idx on public.notifications (id) where push_state in ('pending', 'sending');

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  ua text not null default '',
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ─────────────────────────────────────────────────────────────
-- 커뮤니티 · 공지
-- ─────────────────────────────────────────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  cat text not null default '자유' check (cat in ('자유', 'Q&A', '정보', '사육일지')),
  title text not null check (char_length(title) between 2 and 120),
  body text not null default '' check (char_length(body) <= 5000),
  attach jsonb,
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  like_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);
create index posts_author_idx on public.posts (author_id);
create index posts_created_idx on public.posts (created_at desc);
create index posts_popular_idx on public.posts (like_count desc, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  adopted boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_created_idx on public.comments (post_id, created_at);
create index comments_author_idx on public.comments (author_id);
create unique index comments_one_adopted_per_post on public.comments (post_id) where adopted;

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  body text not null default '' check (char_length(body) <= 5000),
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notices_created_idx on public.notices (created_at desc);
create index notices_author_idx on public.notices (author_id);

-- ─────────────────────────────────────────────────────────────
-- 컬럼 권한: 클라이언트가 직접 바꿀 수 없는 값(역할·상태·카운터·채택 등)을 막는다.
-- ─────────────────────────────────────────────────────────────
revoke insert, update on public.profiles from anon, authenticated;
grant update (nickname, bio, avatar_url, coi_limit, todo_alarm, tz) on public.profiles to authenticated;

revoke insert, update, delete on public.invite_codes, public.invite_redemptions from anon, authenticated;
grant update (active) on public.invite_codes to authenticated;

revoke insert, update, delete on public.transfers from anon, authenticated;

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke insert, update on public.push_subscriptions from anon, authenticated;

revoke insert, update on public.posts from anon, authenticated;
grant insert (cat, title, body, attach, media) on public.posts to authenticated;

revoke insert, update on public.comments from anon, authenticated;
grant insert (post_id, body) on public.comments to authenticated;

revoke update on public.likes from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.animals enable row level security;
alter table public.weights enable row level security;
alter table public.breeders enable row level security;
alter table public.clutches enable row level security;
alter table public.todos enable row level security;
alter table public.todo_checks enable row level security;
alter table public.transfers enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.notices enable row level security;

-- 프로필: 본인은 항상, 회원은 다른 회원의 공개 프로필(닉네임·뱃지)을 읽을 수 있다
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_member()));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 초대 코드: 관리자만
create policy "invite_codes_admin_select" on public.invite_codes for select to authenticated
  using ((select private.is_admin()));
create policy "invite_codes_admin_update" on public.invite_codes for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "invite_redemptions_admin_select" on public.invite_redemptions for select to authenticated
  using ((select private.is_admin()));

-- 사육 데이터: 본인 소유 + 회원
create policy "animals_select_own" on public.animals for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "animals_insert_own" on public.animals for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "animals_update_own" on public.animals for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "animals_delete_own" on public.animals for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

create policy "weights_select_own" on public.weights for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "weights_insert_own" on public.weights for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "weights_update_own" on public.weights for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "weights_delete_own" on public.weights for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

create policy "breeders_select_own" on public.breeders for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "breeders_insert_own" on public.breeders for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "breeders_update_own" on public.breeders for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "breeders_delete_own" on public.breeders for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

create policy "clutches_select_own" on public.clutches for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "clutches_insert_own" on public.clutches for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "clutches_update_own" on public.clutches for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "clutches_delete_own" on public.clutches for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

create policy "todos_select_own" on public.todos for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "todos_insert_own" on public.todos for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "todos_update_own" on public.todos for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "todos_delete_own" on public.todos for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

create policy "todo_checks_select_own" on public.todo_checks for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "todo_checks_insert_own" on public.todo_checks for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "todo_checks_delete_own" on public.todo_checks for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

-- 분양 이전: 보낸 사람·받은 사람만 조회 (생성·인수는 RPC로만)
create policy "transfers_select_party" on public.transfers for select to authenticated
  using ((owner_id = (select auth.uid()) or claimed_by = (select auth.uid())) and (select private.is_member()));

-- 알림: 본인 것만
create policy "notifications_select_own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications_update_own" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications_delete_own" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- 푸시 구독: 본인 것만 (등록은 RPC로)
create policy "push_subscriptions_select_own" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_subscriptions_delete_own" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- 커뮤니티: 회원은 모두 읽기, 본인 글만 쓰기·삭제 (관리자는 삭제 가능)
create policy "posts_select_member" on public.posts for select to authenticated
  using ((select private.is_member()));
create policy "posts_insert_own" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.is_member()));
create policy "posts_delete_own_or_admin" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

create policy "comments_select_member" on public.comments for select to authenticated
  using ((select private.is_member()));
create policy "comments_insert_own" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.is_member()));
create policy "comments_delete_own_or_admin" on public.comments for delete to authenticated
  using ((author_id = (select auth.uid()) and not adopted) or (select private.is_admin()));

create policy "likes_select_member" on public.likes for select to authenticated
  using ((select private.is_member()));
create policy "likes_insert_own" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member()));
create policy "likes_delete_own" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "notices_select_member" on public.notices for select to authenticated
  using ((select private.is_member()));
create policy "notices_insert_admin" on public.notices for insert to authenticated
  with check ((select private.is_admin()));
create policy "notices_update_admin" on public.notices for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "notices_delete_admin" on public.notices for delete to authenticated
  using ((select private.is_admin()));
