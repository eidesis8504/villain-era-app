-- VILLAIN ERA · 앱 안 계정 삭제 (2026-11-19)
-- 사진·동영상 파일은 Storage API로만 지울 수 있어서, 앱이 사용자 세션으로 본인 폴더 파일을 먼저 지운 뒤 이 함수를 부른다.
-- 파일이 하나라도 남아 있으면 계정을 지우지 않는다(공개 주소로 열리는 파일이 남지 않도록).
-- 계정을 지우면 profiles 이하 모든 기록(개체·체중·급여·건강·번식·글·댓글·좋아요·알림 등)이 연쇄 삭제된다.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception '로그인이 필요해요';
  end if;
  if exists (
    select 1 from storage.objects o
     where o.bucket_id in ('avatars', 'animal-photos', 'post-media', 'health-photos')
       and (storage.foldername(o.name))[1] = me::text
  ) then
    raise exception '사진 삭제가 끝나지 않았어요 — 다시 시도해 주세요';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
