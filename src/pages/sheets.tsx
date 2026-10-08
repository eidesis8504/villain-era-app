// 개체 화면에서 쓰는 시트: 체중 기록, 분양 이전
import { useState } from 'react'
import { useUI } from '../app/ui'
import { useRefresh, type Animal, type Keeper, type Transfer, type Weight } from '../data/keeper'
import { today, yd } from '../lib/date'
import { fd, fw, nm, round1 } from '../lib/format'
import { qrMatrix, transferUrl } from '../lib/qr'
import { spInfo } from '../lib/species'
import { errMsg, supabase } from '../lib/supabase'
import { Chips, QrGrid, Sheet } from '../ui/kit'

export function WeightSheet({
  k,
  animal,
  edit,
  initial,
  onClose,
}: {
  k: Keeper
  animal: Animal
  edit?: Weight | null
  initial?: string
  onClose: () => void
}) {
  const ui = useUI()
  const refresh = useRefresh()
  const [date, setDate] = useState(edit?.measured_on ?? today())
  const [g, setG] = useState(edit ? String(edit.grams) : (initial ?? ''))
  const [tried, setTried] = useState(false)
  const [cfmDel, setCfmDel] = useState(false)
  const [busy, setBusy] = useState(false)

  const all = k.ws(animal.id)
  const before = all.filter((r) => r.measured_on < date && r.id !== edit?.id)
  const prev = before[before.length - 1] ?? null
  const v = parseFloat(g)
  const mx = spInfo(animal).wMax
  const ok = v > 0 && v < mx
  const clash = !!edit && date !== edit.measured_on && all.some((r) => r.measured_on === date)
  const df = ok && prev ? round1(v - prev.grams) : null
  const neg = df !== null && df < 0

  const save = async () => {
    if (clash) return
    if (!ok || !date) return setTried(true)
    setBusy(true)
    const nv = round1(v)
    const { error } = edit
      ? await supabase.from('weights').update({ measured_on: date, grams: nv }).eq('id', edit.id)
      : await supabase
          .from('weights')
          .upsert({ animal_id: animal.id, measured_on: date, grams: nv }, { onConflict: 'animal_id,measured_on' })
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '체중을 저장하지 못했어요'), 'warn')
    }
    await refresh('weights', 'notifications')
    if (edit) ui.toast(`체중 기록을 수정했어요 · ${fw(nv)}`)
    else if (neg) ui.toast(`체중 감소 경고 · ${nm(animal)} ${fd(df)}`, 'warn')
    else ui.toast(`${fw(nv)} 저장 · ${df === null ? '첫 측정' : fd(df)}`)
    onClose()
  }

  const del = async () => {
    if (!edit) return
    if (!cfmDel) return setCfmDel(true)
    setBusy(true)
    const { error } = await supabase.from('weights').delete().eq('id', edit.id)
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '삭제하지 못했어요'), 'warn')
    }
    await refresh('weights')
    ui.toast(`${yd(edit.measured_on)} 체중 기록을 삭제했어요`)
    onClose()
  }

  return (
    <Sheet title={`${edit ? '체중 수정' : '체중 기록'} · ${nm(animal)}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">측정일</div>
            <input type="date" className="input mono" style={{ padding: '0 10px', fontSize: 14 }} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">체중 (g)</div>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              data-test="weight-input"
              className={`input mono${tried && !ok ? ' bad' : ''}`}
              style={{ fontWeight: 600, fontSize: 18, padding: '0 12px' }}
              value={g}
              onChange={(e) => setG(e.target.value)}
              placeholder="0.0"
              autoFocus
            />
            {ok && v >= 1000 && (
              <div className="mono" style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue)', marginTop: 6 }}>
                = {fw(v)}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            background: neg ? 'var(--warn-soft)' : 'var(--blue-soft)',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--sub)' }}>
            {prev ? `직전 ${yd(prev.measured_on)} · ${fw(prev.grams)}` : '첫 측정이에요'}
          </span>
          <span className="mono" style={{ fontWeight: 600, fontSize: 16, color: neg ? 'var(--warn)' : 'var(--blue)' }}>
            {df === null ? '—' : fd(df)}
          </span>
        </div>
        {(clash || (tried && !ok)) && (
          <div className="err">
            {clash ? `${yd(date)}에 이미 측정 기록이 있어요 — 날짜를 확인해 주세요` : `0 ~ ${mx.toLocaleString()} g 사이 숫자를 입력해 주세요`}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {edit && (
            <button
              type="button"
              data-test="weight-delete"
              className={`btn btn-danger${cfmDel ? ' on' : ''}`}
              style={{ flex: 'none', minWidth: 80, padding: '0 14px', fontSize: 14 }}
              onClick={del}
              disabled={busy}
            >
              {cfmDel ? '한 번 더 누르면 삭제' : '삭제'}
            </button>
          )}
          <button type="button" data-test="weight-save" className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>
            {busy ? '저장 중…' : edit ? '수정 저장' : '저장'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

const fmtCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`

export function TransferCode({ t }: { t: Transfer }) {
  const ui = useUI()
  const url = transferUrl(t.code)
  const { n, cells } = qrMatrix(url)
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'VILLAIN ERA 분양 코드', text: `분양 코드 ${fmtCode(t.code)}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      ui.toast('분양 링크를 복사했어요')
    } catch {
      /* 사용자가 공유를 취소 */
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <div className="mono" data-test="transfer-code" style={{ fontWeight: 600, fontSize: 30, letterSpacing: '.08em', color: 'var(--blue)' }}>
        {fmtCode(t.code)}
      </div>
      <div style={{ background: '#fff', padding: 12, borderRadius: 14, border: '1px solid var(--line)' }}>
        <QrGrid n={n} cells={cells} size={168} />
      </div>
      <div className="hint" style={{ maxWidth: 360 }}>
        받는 사람이 VILLAIN ERA에서 <b>분양 받기</b>에 코드를 입력하거나 이 QR을 스캔하면 기록이 같은 ID로 복사돼요 · {yd(t.expires_at.slice(0, 10))}까지 사용
      </div>
      <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={share}>
        {typeof navigator.share === 'function' ? '링크 공유' : '링크 복사'}
      </button>
    </div>
  )
}

export function TransferSheet({ animal, existing, onClose }: { animal: Animal; existing?: Transfer | null; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const [label, setLabel] = useState('')
  const [inc, setInc] = useState({ w: true, l: true, c: true })
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<Transfer | null>(existing ?? null)
  const LBL = { w: '체중 기록', l: '혈통 정보', c: '산란 기록' } as const

  const create = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('create_transfer', {
      p_animal: animal.id,
      p_weights: inc.w,
      p_lineage: inc.l,
      p_clutches: inc.c,
      p_label: label.trim(),
    })
    setBusy(false)
    if (error || !data) return ui.toast(errMsg(error, '분양 코드를 만들지 못했어요'), 'warn')
    await refresh('animals', 'transfers')
    setMade({ ...(data as Transfer), claimer: null })
    ui.toast('분양 코드를 만들었어요')
  }

  return (
    <Sheet title={`분양 이전 · ${nm(animal)}`} onClose={onClose}>
      {made ? (
        <TransferCode t={made} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="label">받는 사육자 (메모)</div>
            <input className="input" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} placeholder="@크레집사 · 선택" />
          </div>
          <div>
            <div className="label">함께 전달할 기록</div>
            <Chips
              wrap
              items={(['w', 'l', 'c'] as const).map((key) => [key, (inc[key] ? '✓ ' : '') + LBL[key]] as const)}
              value={(['w', 'l', 'c'] as const).filter((key) => inc[key])}
              onChange={(key) => setInc((s) => ({ ...s, [key]: !s[key] }))}
            />
          </div>
          <div className="hint" style={{ lineHeight: 1.6 }}>
            분양 코드를 만들면 이 개체는 '분양' 상태가 돼요. 받는 사람이 코드를 입력하면 그 계정에 같은 ID로 기록이 복사돼요. 받기 전에는 언제든 취소할 수 있어요.
          </div>
          <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>
            {busy ? '만드는 중…' : '분양 코드 만들기'}
          </button>
        </div>
      )}
    </Sheet>
  )
}
