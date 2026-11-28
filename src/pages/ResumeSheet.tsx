// 분양 이력서 링크 만들기·끄기 (개체 상세에서 연다)
// 이력서: 분양 전에 관심 있는 사람에게 보여 주는 기록 요약. 계정 없이 열리고, 분양자가 언제든 끈다.
import { useState } from 'react'
import { useUI } from '../app/ui'
import { shareAnimal, unshareAnimal } from '../data/adopt'
import { useRefresh, type Animal } from '../data/keeper'
import { nm } from '../lib/format'
import { qrMatrix, resumeUrl } from '../lib/qr'
import { errMsg } from '../lib/supabase'
import { QrGrid, Sheet } from '../ui/kit'

export function ResumeSheet({ animal, token, onClose }: { animal: Animal; token: string | null; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const [tok, setTok] = useState(token)
  const [busy, setBusy] = useState(false)
  const [cfmOff, setCfmOff] = useState(false)
  const url = tok ? resumeUrl(tok) : ''
  const qr = tok ? qrMatrix(url) : null

  const make = async () => {
    setBusy(true)
    try {
      setTok(await shareAnimal(animal.id))
      await refresh('shares')
      ui.toast('이력서 링크를 만들었어요')
    } catch (e) {
      ui.toast(errMsg(e, '이력서 링크를 만들지 못했어요'), 'warn')
    }
    setBusy(false)
  }

  const off = async () => {
    if (!cfmOff) return setCfmOff(true)
    setBusy(true)
    try {
      await unshareAnimal(animal.id)
      await refresh('shares')
      setTok(null)
      setCfmOff(false)
      ui.toast('이력서 링크를 껐어요 · 이전 링크로는 더 이상 볼 수 없어요')
    } catch (e) {
      ui.toast(errMsg(e, '이력서 링크를 끄지 못했어요'), 'warn')
    }
    setBusy(false)
  }

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${nm(animal)} 분양 이력서`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      ui.toast('이력서 링크를 복사했어요')
    } catch {
      /* 사용자가 공유를 취소 */
    }
  }

  return (
    <Sheet title={`분양 이력서 · ${nm(animal)}`} onClose={onClose}>
      {qr ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ background: '#fff', padding: 12, borderRadius: 10 }}>
            <QrGrid n={qr.n} cells={qr.cells} size={168} />
          </div>
          <div className="code" data-test="resume-url" style={{ fontSize: 12, color: 'var(--sub)', overflowWrap: 'anywhere' }}>
            {url}
          </div>
          <div className="hint" style={{ maxWidth: 360 }}>
            이 링크를 가진 사람은 앱을 시작하지 않아도 이 개체의 기록을 볼 수 있어요. 기록을 더하면 이력서에도 바로 보여요.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
            <a className="btn btn-outline" href={url} target="_blank" rel="noreferrer">
              열어 보기
            </a>
            <button type="button" className="btn btn-primary" onClick={share}>
              {typeof navigator.share === 'function' ? '링크 공유' : '링크 복사'}
            </button>
          </div>
          <button type="button" data-test="resume-off" className={`btn btn-danger${cfmOff ? ' on' : ''}`} style={{ width: '100%' }} onClick={off} disabled={busy}>
            {cfmOff ? '한 번 더 누르면 꺼져요' : '링크 끄기'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
            분양하기 전에, 관심 있는 사람에게 이 개체의 기록을 링크 하나로 보여 줄 수 있어요.
          </div>
          <div className="card" style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.7 }}>
            <b>보이는 것</b> · 개체 정보와 사진, 체중 기록, 최근 급여 기록(먹이 이름 포함), 부모 정보, 내 닉네임
            <br />
            <b>보이지 않는 것</b> · 건강 기록(증상·진료), 급여량, 메모
          </div>
          <div className="hint" style={{ lineHeight: 1.6 }}>
            링크는 언제든 끌 수 있어요. 개체의 상태는 바뀌지 않아요. 분양이 정해지면 '분양 이전'으로 기록을 넘겨 주세요.
          </div>
          <button type="button" data-test="resume-make" className="btn btn-primary" onClick={make} disabled={busy}>
            {busy ? '만드는 중…' : '이력서 링크 만들기'}
          </button>
        </div>
      )}
    </Sheet>
  )
}
