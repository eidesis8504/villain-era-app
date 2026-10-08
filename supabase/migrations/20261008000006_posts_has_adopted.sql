-- 커뮤니티 목록에서 '채택 완료 / 답변 대기'를 바로 표시하기 위한 플래그
alter table public.posts add column has_adopted boolean not null default false;

create or replace function public.adopt_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cm public.comments;
  p public.posts;
begin
  select * into cm from public.comments where id = p_comment;
  if not found then
    raise exception '답변을 찾을 수 없어요';
  end if;
  select * into p from public.posts where id = cm.post_id for update;
  if p.author_id <> auth.uid() then
    raise exception '질문 작성자만 채택할 수 있어요';
  end if;
  if p.cat <> 'Q&A' then
    raise exception 'Q&A 글에서만 채택할 수 있어요';
  end if;
  if cm.author_id = auth.uid() then
    raise exception '내 답변은 채택할 수 없어요';
  end if;
  if p.has_adopted or exists (select 1 from public.comments where post_id = p.id and adopted) then
    raise exception '이미 채택한 답변이 있어요';
  end if;
  update public.comments set adopted = true where id = cm.id;
  update public.posts set has_adopted = true where id = p.id;
  perform private.notify(cm.author_id, 'comment', '내 답변이 채택됐어요', left(p.title, 60), '/community/' || p.id);
end;
$$;
