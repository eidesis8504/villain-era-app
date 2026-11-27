// 글·댓글·대화의 메뉴: 채팅 보내기, 신고, 작성자 신고, 차단 (내 글이면 삭제)
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useUI } from '../app/ui'
import { openDm, reportChat } from '../data/chat'
import { useRefresh } from '../data/keeper'
import { blockUser, REPORT_REASONS, reportContent, type ReportKind, type ReportReason } from '../data/safety'
import { errMsg } from '../lib/supabase'
import { Chips, Sheet } from '../ui/kit'

// postId: 글·댓글 메뉴에서 대화를 시작할 때 대화 위에 붙일 글
type Target = { kind: 'post' | 'comment' | 'chat'; id: string; authorId: string; authorName: string; postId?: string }

export function ContentMenu({
  target,
  mine,
  canDelete,
  onDelete,
  onBlocked,
  onClose,
}: {
  target: Target
  mine: boolean
  canDelete: boolean
  onDelete?: () => void
  onBlocked?: () => void
  onClose: () => void
}) {
  const ui = useUI()
  const nav = useNavigate()
  const refresh = useRefresh()
  const [step, setStep] = useState<'menu' | 'report' | 'report-user' | 'block'>('menu')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const chat = target.kind === 'chat'
  const what = target.kind === 'post' ? '글' : chat ? '대화' : '댓글'

  const report = async (kind: ReportKind | 'chat', id: string) => {
    if (!reason || busy) return
    setBusy(true)
    try {
      if (kind === 'chat') await reportChat(id, reason, note.trim())
      else await reportContent(kind, id, reason, note.trim())
      ui.toast('신고했어요 · 운영자가 24시간 안에 확인해요')
      onClose()
    } catch (e) {
      setBusy(false)
      ui.toast(errMsg(e, '신고하지 못했어요'), 'warn')
    }
  }

  const startChat = async () => {
    if (busy) return
    setBusy(true)
    try {
      const roomId = await openDm(target.authorId, target.postId)
      onClose()
      nav(`/chat/${roomId}`)
    } catch (e) {
      setBusy(false)
      ui.toast(errMsg(e, '대화를 시작하지 못했어요'), 'warn')
    }
  }

  const block = async () => {
    if (busy) return
    setBusy(true)
    try {
      await blockUser(target.authorId)
      await refresh('posts', 'post', 'comments', 'blocks', 'chat-rooms')
      ui.toast(`${target.authorName}님을 차단했어요`)
      onClose()
      onBlocked?.()
    } catch (e) {
      setBusy(false)
      ui.toast(errMsg(e, '차단하지 못했어요'), 'warn')
    }
  }

  if (step === 'report' || step === 'report-user') {
    const isUser = step === 'report-user'
    return (
      <Sheet title={isUser ? `회원 신고 · ${target.authorName}` : `${what} 신고`} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="label">신고 이유</div>
          <Chips wrap items={REPORT_REASONS} value={reason ?? ('' as ReportReason)} onChange={setReason} />
          <textarea
            className="input"
            style={{ height: 80, fontSize: 15, lineHeight: 1.5, padding: 10 }}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="자세한 내용 (선택)"
          />
          <div className="hint" data-test="report-hint">
            {chat && !isUser
              ? '신고하면 운영자가 이 대화의 내용을 확인해요. 신고가 처리된 뒤에는 운영자가 다시 볼 수 없어요.'
              : '가입한 지 하루가 지난 서로 다른 회원 3명이 신고한 글·댓글은 운영자가 확인하기 전까지 자동으로 숨겨져요.'}
          </div>
          <button
            type="button"
            data-test="report-send"
            className="btn btn-primary"
            disabled={!reason || busy}
            onClick={() => report(isUser ? 'user' : target.kind, isUser ? target.authorId : target.id)}
          >
            {busy ? '보내는 중…' : '신고하기'}
          </button>
        </div>
      </Sheet>
    )
  }

  if (step === 'block') {
    return (
      <Sheet title={`${target.authorName}님 차단`} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--sub)' }}>
            차단하면 이 회원의 글·댓글·대화가 보이지 않고 서로 메시지를 보낼 수 없어요. 알림도 오지 않아요. 전체 › 차단 관리에서 풀 수 있어요.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-plain" style={{ flex: 1 }} onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              data-test="block-confirm"
              className="btn"
              style={{ flex: 1, background: 'var(--warn)', color: '#fff' }}
              onClick={block}
              disabled={busy}
            >
              차단
            </button>
          </div>
        </div>
      </Sheet>
    )
  }

  const item = (label: string, onClick: () => void, test: string, warn?: boolean) => (
    <button
      type="button"
      data-test={test}
      className="list-row"
      onClick={onClick}
      style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 600, color: warn ? 'var(--warn)' : 'var(--ink)' }}
    >
      {label}
    </button>
  )

  return (
    <Sheet title={`${what} 메뉴`} onClose={onClose}>
      <div className="list-card" style={{ padding: '0 16px' }}>
        {!mine && !chat && item('채팅 보내기', startChat, 'menu-chat')}
        {!mine && item(`${what} 신고`, () => setStep('report'), 'menu-report')}
        {!mine && !chat && item('작성자 신고', () => setStep('report-user'), 'menu-report-user')}
        {!mine && item(chat ? '상대 차단' : '작성자 차단', () => setStep('block'), 'menu-block', true)}
        {canDelete && onDelete && item(`${what} 삭제`, () => (onClose(), onDelete()), 'menu-delete', true)}
      </div>
    </Sheet>
  )
}
