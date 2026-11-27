// 계정과 기록 삭제 확인 시트: '삭제'를 입력해야 버튼이 켜진다
import { useState } from 'react'
import { useMe } from '../app/auth'
import { useUI } from '../app/ui'
import { deleteMyAccount } from '../lib/account'
import { errMsg } from '../lib/supabase'
import { Sheet } from '../ui/kit'

const WORD = '삭제'

export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { uid } = useMe()
  const ui = useUI()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = typed.trim() === WORD

  const run = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      await deleteMyAccount(uid)
      ui.toast('계정과 기록을 모두 삭제했어요')
    } catch (e) {
      setBusy(false)
      ui.toast(errMsg(e, '삭제하지 못했어요 — 다시 시도해 주세요'), 'warn')
    }
  }

  return (
    <Sheet title="계정과 기록 삭제" onClose={busy ? () => undefined : onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
          이 기기의 게스트 계정과 아래 기록이 모두 지워지고 <b>되돌릴 수 없어요.</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>개체·체중·급여·건강·번식·할 일 기록</li>
            <li>올린 사진과 동영상</li>
            <li>내가 쓴 글·댓글(다른 사람 글에 단 댓글 포함)과 좋아요</li>
            <li>채팅 대화와 운영자 문의 (상대방 화면에서도 사라져요)</li>
            <li>분양 코드·알림·의견</li>
          </ul>
        </div>
        <div>
          <div className="label">확인을 위해 ‘{WORD}’를 입력해 주세요</div>
          <input
            data-test="delete-confirm-input"
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={WORD}
            disabled={busy}
          />
        </div>
        <button
          type="button"
          data-test="delete-account"
          className="btn"
          style={{ background: ok ? 'var(--warn)' : 'var(--disabled)', color: '#fff' }}
          onClick={run}
          disabled={!ok || busy}
        >
          {busy ? '지우는 중…' : '계정과 기록 삭제'}
        </button>
      </div>
    </Sheet>
  )
}
