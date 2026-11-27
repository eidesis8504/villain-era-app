// 최근 30일 급여 띠 (급여 화면·체중 화면·분양 이력서가 함께 쓴다)
import { addD, today, yd } from '../lib/date'
import { FEED_RESULT_LABEL, type FeedResult } from '../lib/feeding'

export const RESULT_COLOR: Record<FeedResult, string> = {
  ate: 'var(--blue)',
  partial: '#5B8BD0',
  refused: 'var(--warn)',
  unknown: 'var(--muted-2)',
}

// 최근 30일 급여 띠: 하루 한 칸, 그날의 마지막 결과 색
export function FeedStrip({ list, days = 30, now }: { list: { fed_on: string; result: FeedResult }[]; days?: number; now?: string }) {
  const T = now ?? today()
  const byDay = new Map<string, FeedResult>()
  for (const x of list) byDay.set(x.fed_on, x.result)
  const cells = Array.from({ length: days }, (_, i) => addD(T, i - days + 1))
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days}, 1fr)`, gap: 2 }} aria-label="최근 30일 급여 기록">
        {cells.map((d) => {
          const r = byDay.get(d)
          return (
            <span
              key={d}
              title={r ? `${yd(d)} ${FEED_RESULT_LABEL[r]}` : yd(d)}
              style={{ height: 14, borderRadius: 3, background: r ? RESULT_COLOR[r] : 'var(--seg)' }}
            />
          )
        })}
      </div>
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted-2)', marginTop: 4 }}>
        <span>{yd(cells[0])}</span>
        <span>
          <span style={{ color: RESULT_COLOR.ate }}>■</span> 먹음 <span style={{ color: RESULT_COLOR.refused }}>■</span> 거부{' '}
          <span style={{ color: RESULT_COLOR.unknown }}>■</span> 확인 못함
        </span>
        <span>오늘</span>
      </div>
    </div>
  )
}
