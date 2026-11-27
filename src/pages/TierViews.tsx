// 등급의 순수 표시 부품: 닉네임 옆 배지, 등급표, 점수 내역.
// 서버를 부르지 않는다 — 점수와 내역은 바깥에서 넘긴다.
import { groupParts, hzText, PART_INFO, partLine, tierOf, TIERS, type TierPart } from '../lib/tier'

// 닉네임 옆에 붙는 등급 이름
export function TierBadge({ hz }: { hz: number | null | undefined }) {
  const t = tierOf(hz)
  return (
    <span className={`tier-badge tier-${t.key}`} data-test="tier-badge">
      {t.name}
    </span>
  )
}

// 등급 다섯 개와 기준 점수. 내 등급 줄에 표시를 붙인다
export function TierTable({ hz }: { hz: number }) {
  const mine = tierOf(hz).key
  return (
    <div className="tier-table" data-test="tier-table">
      {TIERS.map((t, i) => {
        const next = TIERS[i + 1]
        const on = t.key === mine
        return (
          <div key={t.key} className={`tier-row${on ? ' on' : ''}`} data-test="tier-row" data-on={on ? '1' : '0'}>
            <span className={`tier-badge tier-${t.key}`}>{t.name}</span>
            <span className="mono tier-range">{next ? `${t.min} ~ ${next.min - 1} Hz` : `${t.min} Hz 이상`}</span>
            {on && <span className="tier-me">내 등급</span>}
          </div>
        )
      })}
    </div>
  )
}

// 기준별 점수 내역: 항목 이름, 계산 줄, 세는 방법
export function TierParts({ parts }: { parts: TierPart[] }) {
  const groups = groupParts(parts)
  if (!groups.length) {
    return (
      <div className="hint" data-test="tier-parts-empty">
        아직 점수 내역이 없어요
      </div>
    )
  }
  return (
    <div className="tier-parts" data-test="tier-parts">
      {groups.map((g) => (
        <div key={g.group} className="tier-group">
          <div className="tier-group-head">
            <span>{g.group}</span>
            <span className="mono">{hzText(g.hz)}</span>
          </div>
          {g.items.map((p) => (
            <div key={p.k} className={`tier-part${p.hz < 0 ? ' minus' : ''}`} data-test="tier-part">
              <div className="tier-part-label">{PART_INFO[p.k].label}</div>
              <div className="mono tier-part-line">{partLine(p)}</div>
              <div className="hint">{PART_INFO[p.k].hint}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
