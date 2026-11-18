-- VILLAIN ERA · 건강 일지 + 진료 기록 (2026-11-19, 리서치 3순위)
-- 증상 기록(부위·정도·사진 최대 3장·해결일), 진료 기록(병원·진단·처치·비용·재진일).
-- 증상 사진은 비공개 버킷(health-photos)에 두고 서명된 임시 주소로만 보여 준다.

create table public.health_logs (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  animal_id uuid not null,
  logged_on date not null,
  area text not null check (area in ('변·요산', '호흡', '피부·비늘', '눈', '꼬리', '탈피', '행동', '기타')),
  level smallint not null default 1 check (level between 1 and 3),
  note text not null default '' check (char_length(note) <= 300),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 3),
  resolved_on date,
  created_at timestamptz not null default now(),
  foreign key (owner_id, animal_id) references public.animals (owner_id, id) on delete cascade
);
create index health_logs_owner_animal_idx on public.health_logs (owner_id, animal_id, logged_on desc);

create table public.vet_visits (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  animal_id uuid not null,
  visited_on date not null,
  clinic text not null default '' check (char_length(clinic) <= 40),
  diagnosis text not null default '' check (char_length(diagnosis) <= 200),
  treatment text not null default '' check (char_length(treatment) <= 200),
  cost int check (cost is null or cost >= 0),
  next_visit date,
  created_at timestamptz not null default now(),
  foreign key (owner_id, animal_id) references public.animals (owner_id, id) on delete cascade
);
create index vet_visits_owner_animal_idx on public.vet_visits (owner_id, animal_id, visited_on desc);
create index vet_visits_next_idx on public.vet_visits (next_visit) where next_visit is not null;

revoke all on public.health_logs, public.vet_visits from anon;
alter table public.health_logs enable row level security;
alter table public.vet_visits enable row level security;

create policy "health_logs_select_own" on public.health_logs for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "health_logs_insert_own" on public.health_logs for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "health_logs_update_own" on public.health_logs for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "health_logs_delete_own" on public.health_logs for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

create policy "vet_visits_select_own" on public.vet_visits for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "vet_visits_insert_own" on public.vet_visits for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_member()));
create policy "vet_visits_update_own" on public.vet_visits for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()))
  with check (owner_id = (select auth.uid()));
create policy "vet_visits_delete_own" on public.vet_visits for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_member()));

-- 비공개 증상 사진 저장소 (본인 폴더만 올리고·보고·지울 수 있음)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('health-photos', 'health-photos', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "health_photos_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'health-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_member())
  );
create policy "health_photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'health-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "health_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'health-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
