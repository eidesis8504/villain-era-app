// 검증 기준 판정: 표본이 적으면 판정하지 않는다
export const MIN_SAMPLE = 20
export type Verdict = 'pass' | 'fail' | 'small'

export function judge(rate: number | null, target: number, sample: number): Verdict {
  if (rate === null || sample < MIN_SAMPLE) return 'small'
  return rate >= target ? 'pass' : 'fail'
}
