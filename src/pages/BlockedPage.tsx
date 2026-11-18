// 차단 관리: 내가 차단한 회원 목록과 해제
import { useState } from 'react'
import { useMe } from '../app/auth'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useRefresh } from '../data/keeper'
import { unblockUser, useBlocks } from '../data/safety'
import { isoDay, yd } from '../lib/date'
import { errMsg } from '../lib/supabase'
import { ErrorBox, Spinner } from '../ui/kit'

export default function BlockedPage() {
  const { uid } = useMe()
  const ui = useUI()
  const refresh = useRefresh()
  const q = useBlocks()
  const [busy, setBusy] = useState('')

  const unblock = async (id: string, name: string) => {
    setBusy(id)
    try {
      await unblockUser(uid, id)
      await refresh('blocks', 'posts', 'post', 'comments')
      ui.toast(`${name}님 차단을 풀었어요`)
    } catch (e) {
      ui.toast(errMsg(e, '차단을 풀지 못했어요'), 'warn')
    }
    setBusy('')
  }

  return (
    <Screen title="차단 관리" back="/more">
      <div className="page">
        <div className="hint" style={{ fontSize: 13 }}>
          차단한 회원의 글과 댓글은 보이지 않고, 그 회원의 댓글 알림도 오지 않아요.
        </div>
        {q.isLoading && <Spinner center />}
        {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
        {q.data && (
          <div className="list-card" style={{ padding: '0 16px' }}>
            {q.data.map((b) => {
              const name = b.nickname || '회원'
              return (
                <div key={b.blocked_id} className="list-row" style={{ padding: '12px 0' }}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{name}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--muted-2)' }}>
                    {yd(isoDay(b.created_at))}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    style={{ padding: '0 12px' }}
                    disabled={busy === b.blocked_id}
                    onClick={() => unblock(b.blocked_id, name)}
                  >
                    차단 해제
                  </button>
                </div>
              )
            })}
            {!q.data.length && <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>차단한 회원이 없어요</div>}
          </div>
        )}
      </div>
    </Screen>
  )
}
