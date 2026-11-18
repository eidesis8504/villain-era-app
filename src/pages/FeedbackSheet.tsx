// 의견 보내기: 베타 기간 사용자 의견을 운영자에게 전달한다 (현재 화면·앱 버전 자동 첨부)
import { useState } from 'react'
import { useUI } from '../app/ui'
import { errMsg, supabase } from '../lib/supabase'
import { APP_VERSION } from '../lib/version'
import { Chips, Sheet } from '../ui/kit'

const KINDS = ['불편해요', '제안', '좋아요', '기타'] as const
type Kind = (typeof KINDS)[number]
const MAX = 1000

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const ui = useUI()
  const [kind, setKind] = useState<Kind>('제안')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = body.trim().length > 0

  const send = async () => {
    if (!ok || busy) return
    setBusy(true)
    const { error } = await supabase.from('feedback').insert({
      kind,
      body: body.trim().slice(0, MAX),
      path: location.pathname.slice(0, 200),
      app_version: APP_VERSION,
      ua: navigator.userAgent.slice(0, 300),
    })
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '의견을 보내지 못했어요'), 'warn')
    ui.toast('의견 고마워요! 운영자가 꼭 읽어 볼게요')
    onClose()
  }

  return (
    <Sheet title="의견 보내기" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hint" style={{ fontSize: 13 }}>
          VILLAIN ERA는 베타 기간이에요. 불편한 점, 있었으면 하는 기능, 좋았던 점을 편하게 알려 주세요.
        </div>
        <Chips wrap items={KINDS.map((k) => [k, k] as const)} value={kind} onChange={setKind} />
        <div>
          <textarea
            data-test="feedback-body"
            className="input"
            style={{ height: 140, fontSize: 15, lineHeight: 1.5, padding: 12 }}
            value={body}
            maxLength={MAX}
            onChange={(e) => setBody(e.target.value.slice(0, MAX))}
            placeholder="예: 급여 기록을 여러 마리 한 번에 하고 싶어요"
          />
          <div className="hint" style={{ textAlign: 'right' }}>
            {body.length}/{MAX}
          </div>
        </div>
        <button type="button" data-test="feedback-send" className="btn btn-primary" onClick={send} disabled={!ok || busy}>
          {busy ? '보내는 중…' : '보내기'}
        </button>
      </div>
    </Sheet>
  )
}
