// 2주 차 설문 카드 (홈): 추천 의향 0~10, 가장 쓸모 있는 기능, 아쉬운 점
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useMe } from '../app/auth'
import { useUI } from '../app/ui'
import { errMsg, supabase } from '../lib/supabase'
import { SURVEY_SNOOZE_DAYS, SURVEY_SNOOZE_KEY, surveyDue } from '../lib/survey'
import { Chips } from '../ui/kit'

const FEATURES = ['개체', '체중', '급여', '건강', '번식', '할 일', '커뮤니티', 'QR', '분양'] as const

function snoozeUntil(): number | null {
  try {
    const v = Number(localStorage.getItem(SURVEY_SNOOZE_KEY))
    return v > 0 ? v : null
  } catch {
    return null
  }
}

export function SurveyCard() {
  const { profile, uid } = useMe()
  const ui = useUI()
  const qc = useQueryClient()
  const [nps, setNps] = useState<number | null>(null)
  const [best, setBest] = useState<string>('')
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [later, setLater] = useState(false)
  const answered = useQuery({
    queryKey: ['survey', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('survey_responses').select('survey').eq('survey', 'd14').maybeSingle()
      if (error) throw error
      return !!data
    },
  })

  if (later || answered.isLoading || answered.isError) return null
  if (!surveyDue(profile.created_at, new Date(), answered.data ?? false, snoozeUntil())) return null

  const snooze = () => {
    try {
      localStorage.setItem(SURVEY_SNOOZE_KEY, String(Date.now() + SURVEY_SNOOZE_DAYS * 864e5))
    } catch {
      /* 저장 불가 */
    }
    setLater(true)
  }

  const send = async () => {
    if (nps === null || busy) return
    setBusy(true)
    const { error } = await supabase.from('survey_responses').insert({ nps, best_feature: best, wish: wish.trim().slice(0, 1000) })
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '설문을 보내지 못했어요'), 'warn')
    ui.toast('답해 주셔서 고마워요!')
    qc.setQueryData(['survey', uid], true)
  }

  return (
    <div className="span-all card" data-test="survey-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>VILLAIN ERA, 2주 써 보니 어떠세요?</div>
        <div className="hint" style={{ fontSize: 13 }}>
          30초면 끝나요 · 답은 앱을 다듬는 데만 써요
        </div>
      </div>
      <div>
        <div className="label">친구에게 추천할 의향 (0 전혀 없음 ~ 10 매우 높음)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4 }}>
          {Array.from({ length: 11 }, (_, i) => (
            <button
              type="button"
              key={i}
              className="mono"
              onClick={() => setNps(i)}
              style={{
                height: 36,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid ' + (nps === i ? 'var(--blue)' : 'var(--input)'),
                background: nps === i ? 'var(--blue)' : '#fff',
                color: nps === i ? 'var(--cream)' : 'var(--ink)',
              }}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="label">가장 쓸모 있는 기능 (선택)</div>
        <Chips wrap small items={FEATURES.map((f) => [f as string, f] as const)} value={best} onChange={(f) => setBest(best === f ? '' : f)} />
      </div>
      <div>
        <div className="label">아쉬운 점이나 바라는 점 (선택)</div>
        <textarea
          className="input"
          style={{ height: 80, fontSize: 15, lineHeight: 1.5, padding: 10 }}
          value={wish}
          maxLength={1000}
          onChange={(e) => setWish(e.target.value.slice(0, 1000))}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-plain" style={{ flex: 1 }} onClick={snooze}>
          나중에
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={send} disabled={nps === null || busy}>
          {busy ? '보내는 중…' : '보내기'}
        </button>
      </div>
    </div>
  )
}
