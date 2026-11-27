// 내 등급(티어표): 내 점수와 등급, 다음 등급까지, 항목별 내역, 등급표
import { useEffect, useRef } from 'react'
import { useAuth, useMe } from '../app/auth'
import { Screen } from '../app/Screen'
import { useMyTier } from '../data/tier'
import { nextTier, TIER_NOTE, tierOf, tierProgress } from '../lib/tier'
import { ErrorBox, Spinner } from '../ui/kit'
import { TierParts, TierTable } from './TierViews'

export function TierPage() {
  const { profile } = useMe()
  const { refreshProfile } = useAuth()
  const q = useMyTier()
  // 방금 다시 계산한 값이 있으면 그 값, 없으면 프로필에 저장된 값
  const hz = q.data?.hz ?? profile.hz
  const cur = tierOf(hz)
  const next = nextTier(hz)

  // 다시 계산한 점수가 프로필과 다르면 프로필을 한 번 새로 받는다 (닉네임 옆 배지가 같은 값을 보게)
  const synced = useRef<number | null>(null)
  useEffect(() => {
    if (!q.data || q.data.hz === profile.hz || synced.current === q.data.hz) return
    synced.current = q.data.hz
    void refreshProfile()
  }, [q.data, profile.hz, refreshProfile])

  return (
    <Screen title="내 등급" back="/more">
      <div className="page">
        <div className="card card-pad tier-hero" data-test="tier-hero">
          <div className="tier-hero-top">
            <span className={`tier-name tier-${cur.key}`} data-test="tier-name">
              {cur.name}
            </span>
            <span className="mono tier-hz" data-test="tier-hz">
              {hz}
              <small> Hz</small>
            </span>
          </div>
          <div className="tier-bar" role="img" aria-label="다음 등급까지의 진행">
            <div style={{ width: `${Math.round(tierProgress(hz) * 100)}%` }} />
          </div>
          <div className="hint" data-test="tier-next">
            {next ? `다음 등급 ${next.tier.name}까지 ${next.left} Hz` : '가장 높은 등급이에요'}
          </div>
        </div>

        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>
            점수 내역
          </div>
          {q.isLoading && <Spinner center />}
          {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
          {q.data && <TierParts parts={q.data.parts} />}
        </div>

        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>
            등급표
          </div>
          <TierTable hz={hz} />
        </div>

        <div className="hint" data-test="tier-note">
          {TIER_NOTE} 점수는 하루에 한 번 다시 계산하고, 이 화면을 열면 내 점수는 바로 다시 계산해요. 운영정책을 어겨 운영자가
          조치한 신고가 있으면 점수가 깎여요.
        </div>
      </div>
    </Screen>
  )
}
