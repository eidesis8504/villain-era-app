// 홈 상단 안내: 아이폰 사파리에서 '홈 화면에 추가'를 권한다.
// 홈 화면 앱은 사파리와 저장소가 따로라, 기록이 이미 있으면 연결 코드로 옮기는 순서를 안내한다.
import { useState } from 'react'
import { X } from 'lucide-react'
import { currentEnv } from '../lib/env'
import { DeviceLinkSheet } from '../pages/DeviceLinkSheets'

const KEY = 've-install-hint-until'
const SNOOZE_MS = 3 * 864e5

function hidden() {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}

export function InstallHint({ hasRecords }: { hasRecords: boolean }) {
  const [closed, setClosed] = useState(hidden)
  const [linkOpen, setLinkOpen] = useState(false)
  if (closed || !currentEnv().iosSafari) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + SNOOZE_MS))
    } catch {
      /* 저장 불가 */
    }
    setClosed(true)
  }
  return (
    <div className="span-all welcome-card" data-test="install-hint">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div className="welcome-card-title">
          {hasRecords ? '홈 화면 앱으로 옮기면 기록이 더 안전해요' : '홈 화면에 추가해서 쓰면 기록이 안전해요'}
        </div>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={close} style={{ margin: '-10px -10px -10px 0', color: 'var(--muted)' }}>
          <X size={18} />
        </button>
      </div>
      {hasRecords ? (
        <>
          <ol className="welcome-steps">
            <li>공유(□↑) › 홈 화면에 추가</li>
            <li>홈 화면 앱에서 ‘이미 쓰던 기록이 있어요’</li>
            <li>여기서 받은 코드 입력</li>
          </ol>
          <button type="button" data-test="install-hint-link" className="btn btn-outline" onClick={() => setLinkOpen(true)}>
            코드 받기
          </button>
        </>
      ) : (
        <div>
          공유 버튼(□↑) → ‘홈 화면에 추가’ → 홈 화면 아이콘으로 열기. 홈 화면 앱은 사파리와 기록이 따로라, 아직 기록이 없는 지금
          옮기면 좋아요.
        </div>
      )}
      {linkOpen && <DeviceLinkSheet onClose={() => setLinkOpen(false)} />}
    </div>
  )
}
