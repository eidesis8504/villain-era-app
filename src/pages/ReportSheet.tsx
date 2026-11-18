// 글·댓글 '⋯' 메뉴: 신고, 작성자 신고, 작성자 차단 (내 글이면 삭제)
import { useState } from 'react'
import { useUI } from '../app/ui'
import { useRefresh } from '../data/keeper'
import { blockUser, REPORT_REASONS, reportContent, type ReportKind, type ReportReason } from '../data/safety'
import { errMsg } from '../lib/supabase'
import { Chips, Sheet } from '../ui/kit'

type Target = { kind: 'post' | 'comment'; id: string; authorId: string; authorName: string }

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
  const refresh = useRefresh()
  const [step, setStep] = useState<'menu' | 'report' | 'report-user' | 'block'>('menu')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const what = target.kind === 'post' ? '글' : '댓글'

  const report = async (kind: ReportKind, id: string) => {
    if (!reason || busy) return
    setBusy(true)
    try {
      await reportContent(kind, id, reason, note.trim())
      ui.toast('신고했어요 · 운영자가 24시간 안에 확인해요')
      onClose()
    } catch (e) {
      setBusy(false)
      ui.toast(errMsg(e, '신고하지 못했어요'), 'warn')
    }
  }

  const block = async () => {
    if (busy) return
    setBusy(true)
    try {
      await blockUser(target.authorId)
      await refresh('posts', 'post', 'comments', 'blocks')
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
          <div className="hint">서로 다른 회원 3명이 신고한 글·댓글은 운영자가 확인하기 전까지 자동으로 숨겨져요.</div>
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
            차단하면 이 회원의 글과 댓글이 보이지 않고 알림도 오지 않아요. 전체 › 차단 관리에서 풀 수 있어요.
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
        {!mine && item(`${what} 신고`, () => setStep('report'), 'menu-report')}
        {!mine && item('작성자 신고', () => setStep('report-user'), 'menu-report-user')}
        {!mine && item('작성자 차단', () => setStep('block'), 'menu-block', true)}
        {canDelete && onDelete && item(`${what} 삭제`, () => (onClose(), onDelete()), 'menu-delete', true)}
      </div>
    </Sheet>
  )
}
