import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../app/auth'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useNotices, useNotifications } from '../data/community'
import { useRefresh } from '../data/keeper'
import { isoDay, md, yd } from '../lib/date'
import { errMsg, supabase } from '../lib/supabase'
import { ErrorBox, Sheet, Spinner } from '../ui/kit'

function NoticeSheet({ onClose }: { onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (title.trim().length < 2) return ui.toast('제목을 2자 이상 입력해 주세요', 'warn')
    setBusy(true)
    const { error } = await supabase.from('notices').insert({ title: title.trim(), body: body.trim() })
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '공지를 등록하지 못했어요'), 'warn')
    await refresh('notices')
    ui.toast('공지를 등록했어요 · 회원 알림함에 전달돼요')
    onClose()
  }
  return (
    <Sheet title="공지 작성" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input className="input" style={{ fontWeight: 600 }} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" />
        <textarea className="input" style={{ height: 160, fontSize: 15 }} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder="공지 내용" />
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? '등록 중…' : '공지 등록'}
        </button>
      </div>
    </Sheet>
  )
}

export function NoticesPage() {
  const { isAdmin } = useAuth()
  const ui = useUI()
  const refresh = useRefresh()
  const q = useNotices()
  const [sheet, setSheet] = useState(false)
  const [cfm, setCfm] = useState('')

  const del = async (id: string) => {
    if (cfm !== id) return setCfm(id)
    const { error } = await supabase.from('notices').delete().eq('id', id)
    setCfm('')
    if (error) return ui.toast(errMsg(error, '삭제하지 못했어요'), 'warn')
    await refresh('notices')
    ui.toast('공지를 삭제했어요')
  }

  return (
    <Screen title="공지사항" back="/more" right={isAdmin ? { label: '+ 작성', onClick: () => setSheet(true) } : undefined}>
      <div className="page" style={{ gap: 10 }}>
        {q.isLoading && <Spinner center />}
        {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
        {q.data && !q.data.length && <div className="empty">아직 공지가 없어요</div>}
        {(q.data ?? []).map((n) => (
          <div key={n.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>
                {yd(isoDay(n.created_at))}
              </span>
              {isAdmin && (
                <button type="button" onClick={() => del(n.id)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)' }}>
                  {cfm === n.id ? '한 번 더 누르면 삭제' : '삭제'}
                </button>
              )}
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{n.title}</span>
            {n.body && <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--sub)', whiteSpace: 'pre-wrap' }}>{n.body}</span>}
          </div>
        ))}
      </div>
      {sheet && <NoticeSheet onClose={() => setSheet(false)} />}
    </Screen>
  )
}

export function AlertsPage() {
  const nav = useNavigate()
  const { uid } = useAuth()
  const refresh = useRefresh()
  const q = useNotifications()
  const marked = useRef(false)

  // 알림 화면을 열면 모두 읽음 처리 (프로토타입과 동일)
  useEffect(() => {
    if (marked.current || !q.data?.some((n) => !n.read_at)) return
    marked.current = true
    supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', uid!)
      .is('read_at', null)
      .then(() => refresh('notifications'))
  }, [q.data, uid, refresh])

  return (
    <Screen title="알림" back="/">
      <div className="page" style={{ gap: 8 }}>
        {q.isLoading && <Spinner center />}
        {q.data && !q.data.length && <div className="empty">아직 알림이 없어요</div>}
        {(q.data ?? []).map((n) => (
          <div
            key={n.id}
            className="card"
            onClick={() => n.link && nav(n.link)}
            style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: n.link ? 'pointer' : 'default' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: n.read_at ? '#D6D2C8' : 'var(--warn)', marginTop: 6, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{n.body}</div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>
              {md(isoDay(n.created_at))}
            </span>
          </div>
        ))}
      </div>
    </Screen>
  )
}

export function NotFound() {
  const nav = useNavigate()
  return (
    <Screen title="페이지 없음" back="/">
      <div className="empty-card" style={{ margin: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>없는 화면이에요</div>
        <button type="button" className="btn btn-primary btn-sm" style={{ padding: '0 18px' }} onClick={() => nav('/', { replace: true })}>
          홈으로
        </button>
      </div>
    </Screen>
  )
}
