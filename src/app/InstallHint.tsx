// 홈 상단 안내: 아이폰 사파리에서 아직 기록이 없을 때만 '홈 화면에 추가'를 권한다.
// 홈 화면 앱은 사파리와 저장소가 따로라, 기록이 생긴 뒤에 옮기면 기록이 이어지지 않기 때문.
import { useState } from 'react'
import { currentEnv } from '../lib/env'

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
  if (closed || hasRecords || !currentEnv().iosSafari) return null
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
        <div className="welcome-card-title">홈 화면에 추가해서 쓰면 기록이 안전해요</div>
        <button type="button" aria-label="닫기" onClick={close} style={{ fontSize: 16, color: 'var(--muted)', flex: 'none' }}>
          ✕
        </button>
      </div>
      <div>
        공유 버튼(□↑) → ‘홈 화면에 추가’ → 홈 화면 아이콘으로 열기. 홈 화면 앱은 사파리와 기록이 따로라, 아직 기록이 없는 지금
        옮기면 좋아요.
      </div>
    </div>
  )
}
