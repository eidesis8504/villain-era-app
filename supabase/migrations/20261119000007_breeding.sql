-- VILLAIN ERA · 번식 사이클 트래커 (2026-11-19, 리서치 2순위)
-- 메이팅 기록, 그라비드 확인·산란 예정일, 인큐 온도·부화 예정 범위, 알 상태 기록.

create table public.matings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  female_id uuid not null,
  male_id uuid,
  paired_on date not null,
  locked boolean not null default false,
  note text not null default '' check (char_length(note) <= 100),
  created_at timestamptz not null default now(),
  foreign key (owner_id, female_id) references public.animals (owner_id, id) on delete cascade,
  foreign key (owner_id, male_id) references public.animals (owner_id, id) on delete set null (male_id)
);
create index matings_owner_female_idx on public.matings (owner_id, female_id, paired_on desc);
create index matings_owner_male_idx on public.matings (owner_id, male_id);

alter table public.breeders
  add column gravid_on date,
  add column lay_expected_on date;

alter table public.clutches
  add column incubation_temp numeric(4, 1) check (incubation_temp is null or incubation_temp between 15 and 40),
  add column expected_from date,
  add column expected_to date,
  add constraint clutches_expected_range_check check (expected_to is null or expected_from is null or expected_to >= expected_from);

create table public.egg_checks (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  clutch_id uuid not null,
  checked_on date not null,
  status text not null check (status in ('normal', 'dented', 'moldy', 'sweating', 'infertile', 'pipping')),
  count int not null default 1 check (count between 1 and 200),
  photo_path text,
  note text not null default '' check (char_length(note) <= 100),
  created_at timestamptz not null default now(),
  foreign key (owner_id, clutch_id) references public.clutches (owner_id, id) on delete cascade
);
create index egg_checks_owner_clutch_idx on public.egg_checks (owner_id, clutch_id, checked_on desc);

revoke all on public.matings, public.egg_checks from anon;
alter table public.matings enable row level security;
alter table public.egg_checks enable row level security;

create policy "matings_select_own" on public.matings for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "matings_insert_own" on public.matings for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "matings_update_own" on public.matings for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "matings_delete_own" on public.matings for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

create policy "egg_checks_select_own" on public.egg_checks for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "egg_checks_insert_own" on public.egg_checks for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "egg_checks_update_own" on public.egg_checks for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "egg_checks_delete_own" on public.egg_checks for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
