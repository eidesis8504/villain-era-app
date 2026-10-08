-- VILLAIN ERA · 사진·동영상 저장소
-- 파일 경로는 항상 "<user_id>/..." 형태이고, 본인 폴더에만 올리고 지울 수 있다.
-- 버킷은 공개 URL로 표시하되(무작위 경로), 목록 조회는 본인 폴더로 제한한다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('animal-photos', 'animal-photos', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', true, 50 * 1024 * 1024,
   array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "media_insert_own_folder" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'animal-photos', 'post-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_member())
  );

create policy "media_select_own_folder" on storage.objects for select to authenticated
  using (
    bucket_id in ('avatars', 'animal-photos', 'post-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "media_delete_own_folder" on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'animal-photos', 'post-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
