import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { badgeOf, displayName, useAuth, useMe } from '../app/auth'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useToggleLike } from '../data/actions'
import { badgeColor, CATS, useComments, useLiked, usePost, usePosts, type Attach, type MediaItem } from '../data/community'
import { useKeeper, useRefresh, type Keeper } from '../data/keeper'
import { isoDay, yd } from '../lib/date'
import { fd, fw, nm } from '../lib/format'
import { fmtDur, prepareImage, prepareVideo, removeFiles, upload, videoExt, type MediaDraft } from '../lib/media'
import { errMsg, publicUrl, supabase } from '../lib/supabase'
import { Chips, ErrorBox, Seg, Sheet, Sparkline, Spinner, Toggle } from '../ui/kit'
import { PostCard } from './shared'

export function CommunityPage() {
  const nav = useNavigate()
  const [cat, setCat] = useState('전체')
  const q = usePosts(cat)
  return (
    <Screen title="커뮤니티" right={{ label: '글쓰기', onClick: () => nav('/community/new'), test: 'write' }} wide>
      <div className="page-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))' }}>
        <Chips style={{ gridColumn: '1 / -1' }} items={['전체', ...CATS].map((c) => [c, c] as const)} value={cat} onChange={setCat} />
        {q.isLoading && (
          <div className="span-all">
            <Spinner center />
          </div>
        )}
        {q.error && (
          <div className="span-all">
            <ErrorBox error={q.error} onRetry={() => q.refetch()} />
          </div>
        )}
        {q.data && !q.data.length && (
          <div className="empty-card span-all">
            <div style={{ fontSize: 15, fontWeight: 700 }}>아직 글이 없어요</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>사육 경험이나 궁금한 점을 첫 글로 남겨보세요</div>
            <button type="button" className="btn btn-primary btn-sm" style={{ padding: '0 18px' }} onClick={() => nav('/community/new')}>
              글쓰기
            </button>
          </div>
        )}
        {(q.data ?? []).map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
    </Screen>
  )
}

function AttachView({ at }: { at: Attach }) {
  const kindLbl = { weight: '체중 기록', clutch: '산란 기록', line: '혈통 정보' }[at.kind]
  return (
    <div className="card" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{kindLbl}</span>
        <span className="mono" style={{ color: 'var(--muted)' }}>
          {at.label}
        </span>
      </div>
      {at.kind === 'weight' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 'none' }}>
            <div className="mono" style={{ fontWeight: 600, fontSize: 20 }}>
              {at.last}
            </div>
            <div className="mono" style={{ fontWeight: 600, fontSize: 12, color: at.diff.startsWith('−') ? 'var(--warn)' : 'var(--blue)' }}>
              {at.diff} · {at.count}회
            </div>
          </div>
          <Sparkline pts={at.pts} />
        </div>
      )}
      {at.kind === 'clutch' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>
          {(
            [
              [at.n, '산란', 'var(--ink)'],
              [at.eggs, '알', 'var(--ink)'],
              [at.hatched, '부화', 'var(--blue)'],
              [at.dead, '폐사', 'var(--warn)'],
            ] as const
          ).map(([v, l, c]) => (
            <div key={l}>
              <div className="mono" style={{ fontWeight: 600, fontSize: 17, color: c }}>
                {v}
              </div>
              {l}
            </div>
          ))}
        </div>
      )}
      {at.kind === 'line' && (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          부 {at.sire}
          <br />모 {at.dam}
          <br />
          <span className="mono">COI {at.coi}</span>
        </div>
      )}
    </div>
  )
}

export function PostPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const ui = useUI()
  const refresh = useRefresh()
  const { uid, isAdmin } = useAuth()
  const q = usePost(id)
  const comments = useComments(id)
  const liked = useLiked(id).data ?? false
  const like = useToggleLike(id)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  if (q.isLoading) return <Screen title="게시글" back="/community"><Spinner center /></Screen>
  if (q.error) return <Screen title="게시글" back="/community"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></Screen>
  const p = q.data
  if (!p) return <Screen title="게시글" back="/community"><div className="empty">삭제됐거나 없는 글이에요</div></Screen>

  const mine = p.author_id === uid
  const qa = p.cat === 'Q&A'
  const list = comments.data ?? []
  const badge = badgeOf(p.author)

  const send = async () => {
    const t = comment.trim()
    if (!t) return ui.toast('내용을 입력해 주세요', 'warn')
    setBusy(true)
    const { error } = await supabase.from('comments').insert({ post_id: p.id, body: t })
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '댓글을 등록하지 못했어요'), 'warn')
    setComment('')
    await refresh('comments', 'post', 'posts')
  }

  const adopt = async (cid: string) => {
    const { error } = await supabase.rpc('adopt_comment', { p_comment: cid })
    if (error) return ui.toast(errMsg(error, '채택하지 못했어요'), 'warn')
    await refresh('comments', 'post', 'posts')
    ui.toast('답변을 채택했어요 · 채택은 변경할 수 없어요')
  }

  const del = async () => {
    setBusy(true)
    await removeFiles('post-media', p.media.flatMap((m) => [m.path, m.thumb]))
    const { error } = await supabase.from('posts').delete().eq('id', p.id)
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '삭제하지 못했어요'), 'warn')
    await refresh('posts')
    ui.toast('게시물을 삭제했어요')
    nav('/community', { replace: true })
  }

  return (
    <Screen title="게시글" back="/community">
      <div className="page">
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="tag">{p.cat}</span>
          {p.has_adopted && <span className="tag solid">채택 완료</span>}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, marginTop: -6 }}>{p.title}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--muted)' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{displayName(p.author)}</span>
          {badge && (
            <span className="tag dark" style={{ background: badgeColor(badge) }}>
              {badge}
            </span>
          )}
          <span className="mono">· {yd(isoDay(p.created_at))}</span>
        </div>
        {p.body.trim() && <div style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.body}</div>}

        {p.media.length > 0 && (
          <div data-test="post-media" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {p.media.map((m, i) => (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: m.t === 'vid' ? 'var(--ink)' : 'var(--seg)' }}>
                {m.t === 'img' ? (
                  <img src={publicUrl('post-media', m.path)} alt="" loading="lazy" style={{ width: '100%', maxHeight: 560, objectFit: 'contain', display: 'block' }} />
                ) : (
                  <video
                    src={publicUrl('post-media', m.path)}
                    poster={m.thumb ? publicUrl('post-media', m.thumb) : undefined}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', maxHeight: 560, display: 'block', background: 'var(--ink)' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {p.attach && <AttachView at={p.attach} />}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="mono"
            onClick={() => like.mutate(liked)}
            style={{
              height: 38,
              padding: '0 16px',
              borderRadius: 999,
              border: '1px solid var(--blue)',
              background: liked ? 'var(--blue)' : '#fff',
              color: liked ? 'var(--cream)' : 'var(--blue)',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            ♡ {p.like_count}
          </button>
          {(mine || isAdmin) && (
            <button
              type="button"
              data-test="post-delete"
              onClick={() => setConfirm(true)}
              style={{ marginLeft: 'auto', height: 38, padding: '0 16px', borderRadius: 999, border: '1px solid var(--warn)', color: 'var(--warn)', fontSize: 13, fontWeight: 600 }}
            >
              삭제
            </button>
          )}
        </div>

        {mine && qa && !p.has_adopted && list.length > 0 && (
          <div style={{ background: 'var(--blue-soft)', borderRadius: 12, padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>
            도움이 된 답변을 채택해 주세요 · 채택 후에는 바꿀 수 없어요
          </div>
        )}

        <div style={{ fontSize: 15, fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          {qa ? '답변' : '댓글'} {p.comment_count}
        </div>

        {list.map((c) => {
          const cb = badgeOf(c.author)
          return (
            <div
              key={c.id}
              style={{
                background: c.adopted ? 'var(--blue-soft)' : '#fff',
                border: `1px solid ${c.adopted ? 'var(--blue)' : 'var(--line)'}`,
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{displayName(c.author)}</span>
                {cb && (
                  <span className="tag dark" style={{ background: badgeColor(cb) }}>
                    {cb}
                  </span>
                )}
                {c.adopted && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>✓ 채택된 답변</span>}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</div>
              {mine && qa && !p.has_adopted && c.author_id !== uid && (
                <button
                  type="button"
                  onClick={() => adopt(c.id)}
                  style={{ alignSelf: 'flex-start', height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--blue)', color: 'var(--blue)', fontSize: 12, fontWeight: 700 }}
                >
                  이 답변 채택
                </button>
              )}
            </div>
          )
        })}
        {comments.data && !list.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>첫 {qa ? '답변' : '댓글'}을 남겨보세요</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 0, fontSize: 14 }}
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
            placeholder={qa ? '답변을 입력하세요' : '댓글을 입력하세요'}
          />
          <button
            type="button"
            className={`btn btn-primary${comment.trim() ? '' : ' off'}`}
            style={{ width: 64, height: 46, fontSize: 14, flex: 'none' }}
            onClick={send}
            disabled={busy}
          >
            등록
          </button>
        </div>
      </div>
      {confirm && (
        <Sheet title="게시물 삭제" onClose={() => setConfirm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--sub)', overflowWrap: 'anywhere' }}>
              ‘{p.title}’ 글을 삭제할까요? 댓글 {p.comment_count}개{p.media.length ? `와 첨부한 사진·동영상 ${p.media.length}개` : ''}도 함께 지워지고 되돌릴 수 없어요.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-plain" style={{ flex: 1 }} onClick={() => setConfirm(false)}>
                취소
              </button>
              <button type="button" data-test="post-delete-confirm" className="btn" style={{ flex: 1, background: 'var(--warn)', color: '#fff' }} onClick={del} disabled={busy}>
                삭제
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}

function snap(k: Keeper, aid: string, type: 'weight' | 'clutch' | 'line'): Attach | null {
  const a = k.A(aid)
  if (!a) return null
  const label = `${nm(a)} ${a.code}`
  if (type === 'weight') {
    const w = k.ws(aid)
    const l = k.lastW(aid)
    if (!l) return null
    return { kind: 'weight', label, last: fw(l.g), diff: fd(l.diff), pts: w.slice(-8).map((x) => x.grams), count: w.length }
  }
  if (type === 'clutch') {
    const cs = k.clutches.filter((c) => c.dam_id === aid || c.sire_id === aid)
    if (!cs.length) return null
    return {
      kind: 'clutch',
      label,
      n: cs.length,
      eggs: cs.reduce((n, c) => n + c.eggs, 0),
      fert: cs.reduce((n, c) => n + c.fertile, 0),
      hatched: cs.reduce((n, c) => n + k.hatched(c).length, 0),
      dead: cs.reduce((n, c) => n + c.dead, 0),
    }
  }
  const s = k.A(a.sire_id)
  const d = k.A(a.dam_id)
  return {
    kind: 'line',
    label,
    sire: `${nm(s)} ${s?.code ?? '미상'}`,
    dam: `${nm(d)} ${d?.code ?? '미상'}`,
    coi: (k.lineage.F(aid) * 100).toFixed(2) + '%',
  }
}

export function WritePage() {
  const nav = useNavigate()
  const ui = useUI()
  const refresh = useRefresh()
  const { uid } = useMe()
  const k = useKeeper()
  const [cat, setCat] = useState<string>('자유')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<MediaDraft[]>([])
  const [mBusy, setMBusy] = useState(false)
  const [att, setAtt] = useState(false)
  const [aid, setAid] = useState('')
  const [attType, setAttType] = useState<'weight' | 'clutch' | 'line'>('weight')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState<string>('')

  const nImg = media.filter((m) => m.t === 'img').length
  const nVid = media.filter((m) => m.t === 'vid').length
  const sn = att && aid ? snap(k, aid, attType) : null
  const titleErr = tried && title.trim().length < 2
  const bodyErr = tried && !body.trim() && !media.length

  const addFiles = async (files: FileList | null, kind: 'img' | 'vid') => {
    let list = Array.from(files ?? [])
    if (!list.length) return
    if (kind === 'vid') {
      if (nVid) return ui.toast('동영상은 1개만 첨부할 수 있어요', 'warn')
      list = list.slice(0, 1)
    } else {
      const room = 10 - nImg
      if (room <= 0) return ui.toast('사진은 최대 10장까지예요', 'warn')
      if (list.length > room) ui.toast(`사진은 최대 10장 — ${room}장만 추가해요`, 'warn')
      list = list.slice(0, room)
    }
    setMBusy(true)
    for (const f of list) {
      try {
        const d = kind === 'vid' ? await prepareVideo(f) : await prepareImage(f)
        setMedia((s) => [...s, d])
      } catch (e) {
        ui.toast(errMsg(e, '파일을 처리하지 못했어요'), 'warn')
      }
    }
    setMBusy(false)
  }

  const submit = async () => {
    if (busy || mBusy) return
    if (title.trim().length < 2 || (!body.trim() && !media.length)) {
      setTried(true)
      return ui.toast('제목과 내용을 확인해 주세요', 'warn')
    }
    if (att && !sn) return ui.toast('첨부할 기록이 없어요 — 다른 항목을 선택하세요', 'warn')
    const uploaded: string[] = []
    const folder = crypto.randomUUID()
    try {
      const items: MediaItem[] = []
      for (let i = 0; i < media.length; i++) {
        setBusy(`업로드 중… ${i + 1}/${media.length}`)
        const m = media[i]
        const path = await upload('post-media', uid, m.file, m.t === 'img' ? 'jpg' : videoExt(m.file), folder)
        uploaded.push(path)
        let thumb: string | undefined
        if (m.thumb.size) {
          thumb = await upload('post-media', uid, m.thumb, 'jpg', folder)
          uploaded.push(thumb)
        }
        items.push({ t: m.t, path, thumb, dur: m.dur })
      }
      setBusy('등록 중…')
      const { data, error } = await supabase
        .from('posts')
        .insert({ cat, title: title.trim(), body: body.trim(), attach: sn, media: items })
        .select('id')
        .single()
      if (error) throw error
      media.forEach((m) => m.preview && URL.revokeObjectURL(m.preview))
      await refresh('posts')
      ui.toast('게시글을 등록했어요')
      nav(`/community/${data.id}`, { replace: true })
    } catch (e) {
      await removeFiles('post-media', uploaded)
      setBusy('')
      ui.toast(errMsg(e, '게시글을 등록하지 못했어요 — 네트워크를 확인해 주세요'), 'warn')
    }
  }

  return (
    <Screen title="글쓰기" back="/community">
      <div style={{ padding: '8px 18px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Seg items={CATS.map((c) => [c, c] as const)} value={cat} onChange={setCat} />
        {cat === 'Q&A' && <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, marginTop: -6 }}>Q&amp;A 글은 받은 답변 중 하나를 채택할 수 있어요</div>}
        <div>
          <input
            className={`input${titleErr ? ' bad' : ''}`}
            style={{ height: 48, fontSize: 16, fontWeight: 600, border: titleErr ? undefined : '1.5px solid var(--input)' }}
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (2자 이상)"
          />
          {titleErr && (
            <div className="err" style={{ marginTop: 6 }}>
              제목을 2자 이상 입력해 주세요
            </div>
          )}
        </div>
        <div>
          <textarea
            className={`input${bodyErr ? ' bad' : ''}`}
            style={{ height: 170, fontSize: 15, border: bodyErr ? undefined : '1.5px solid var(--input)' }}
            value={body}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="사육 경험이나 궁금한 점을 적어주세요"
          />
          {bodyErr && (
            <div className="err" style={{ marginTop: 6 }}>
              내용을 입력해 주세요
            </div>
          )}
        </div>

        <div data-test="write-media" className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>사진 · 동영상</span>
            <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>
              사진 {nImg}/10 · 동영상 {nVid}/1
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {media.map((m, i) => (
              <div key={i} style={{ position: 'relative', width: 76, height: 76, borderRadius: 12, overflow: 'hidden', background: 'var(--seg)', flex: 'none' }}>
                {m.preview && <img src={m.preview} alt="" className="cover" />}
                {m.t === 'vid' && (
                  <span className="mono" style={{ position: 'absolute', left: 5, bottom: 5, fontSize: 10, fontWeight: 600, color: '#fff', background: 'rgba(22,24,29,.75)', padding: '2px 5px', borderRadius: 5 }}>
                    ▶ {fmtDur(m.dur)}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="삭제"
                  onClick={() => setMedia((s) => s.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 3, right: 3, width: 28, height: 28, borderRadius: 14, background: 'rgba(22,24,29,.75)', color: '#fff', fontSize: 16, lineHeight: '28px' }}
                >
                  ×
                </button>
              </div>
            ))}
            {nImg < 10 && !mBusy && (
              <label data-test="write-add-photo" style={pickBox}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>사진</span>
                <input type="file" accept="image/*" multiple onChange={(e) => (addFiles(e.target.files, 'img'), (e.target.value = ''))} style={hiddenInput} />
              </label>
            )}
            {!nVid && !mBusy && (
              <label data-test="write-add-video" style={pickBox}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>동영상</span>
                <input type="file" accept="video/*" onChange={(e) => (addFiles(e.target.files, 'vid'), (e.target.value = ''))} style={hiddenInput} />
              </label>
            )}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: mBusy ? 'var(--blue)' : 'var(--muted)' }}>
            {mBusy ? '파일을 처리하는 중이에요…' : '사진은 긴 변 1600px로 줄여 올려요 · 동영상은 3분 · 50MB 이하'}
          </div>
        </div>

        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>내 개체 기록 첨부</span>
            <Toggle
              label="기록 첨부"
              on={att}
              onClick={() => {
                setAtt(!att)
                if (!aid && k.owned[0]) setAid(k.owned[0].id)
              }}
            />
          </div>
          {att && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select className="input" value={aid} onChange={(e) => setAid(e.target.value)}>
                <option value="">개체 선택</option>
                {k.owned.map((a) => (
                  <option key={a.id} value={a.id}>
                    {nm(a)} · {a.code}
                  </option>
                ))}
              </select>
              <Seg
                height={34}
                items={[
                  ['weight', '체중'],
                  ['clutch', '산란'],
                  ['line', '혈통'],
                ]}
                value={attType}
                onChange={setAttType}
              />
              <div style={{ fontSize: 12, fontWeight: 600, color: sn ? 'var(--blue)' : 'var(--warn)' }}>
                {!aid ? '첨부할 개체를 선택해 주세요' : sn ? `첨부됨 · ${sn.label} ${{ weight: '체중 기록', clutch: '산란 기록', line: '혈통 정보' }[sn.kind]}` : '이 개체에는 해당 기록이 없어요'}
              </div>
            </div>
          )}
        </div>

        <button type="button" data-test="write-submit" className={`btn btn-primary${busy || mBusy ? ' off' : ''}`} onClick={submit}>
          {busy || (mBusy ? '파일 처리 중…' : '등록')}
        </button>
      </div>
    </Screen>
  )
}

const pickBox = {
  position: 'relative',
  width: 76,
  height: 76,
  borderRadius: 12,
  border: '1.5px dashed #9FB6D9',
  background: '#F5F8FC',
  color: 'var(--blue)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  cursor: 'pointer',
  flex: 'none',
} as const

const hiddenInput = { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' } as const
