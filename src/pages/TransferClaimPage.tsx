import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useRefresh } from '../data/keeper'
import { yd } from '../lib/date'
import { nm, sexLbl } from '../lib/format'
import { errMsg, supabase } from '../lib/supabase'
import { Spinner } from '../ui/kit'

type Preview = {
  code: string
  animal: { code: string; species: string; name: string; sex: string; morph: string; hatch_date: string | null }
  from: string | null
  weights: number
  lineage: boolean
  clutches: { n: number; eggs: number; hatched: number; dead: number } | null
  mine: boolean
  state: 'open' | 'claimed' | 'canceled' | 'expired'
  expires_at: string
}

const STATE_MSG = {
  claimed: '이미 사용된 분양 코드예요',
  canceled: '보낸 사람이 취소한 분양 코드예요',
  expired: '만료된 분양 코드예요',
} as const

const clean = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')

export default function TransferClaimPage() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const ui = useUI()
  const refresh = useRefresh()
  const [code, setCode] = useState(sp.get('code') ?? '')
  // 주소에 코드가 있으면 들어오자마자 확인한다
  const [submitted, setSubmitted] = useState(clean(sp.get('code') ?? ''))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const pq = useQuery({
    queryKey: ['transfer-preview', submitted],
    enabled: submitted.length === 8,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('preview_transfer', { p_code: submitted })
      if (error) throw new Error(errMsg(error, '분양 코드를 확인하지 못했어요'))
      return data as unknown as Preview
    },
  })
  const pv = submitted.length === 8 ? pq.data : undefined

  const check = () => {
    const v = clean(code)
    if (v.length !== 8) return setErr('분양 코드 8자리를 입력해 주세요')
    setErr('')
    if (v === submitted) pq.refetch()
    else setSubmitted(v)
  }

  const claim = async () => {
    if (!pv) return
    setBusy(true)
    const { data, error } = await supabase.rpc('claim_transfer', { p_code: pv.code })
    if (error || !data) {
      setBusy(false)
      return setErr(errMsg(error, '개체를 받지 못했어요'))
    }
    await refresh('animals', 'weights', 'transfers')
    ui.toast(`${pv.animal.code} 개체를 받았어요`)
    nav(`/animals/${data}`, { replace: true })
  }

  const a = pv?.animal
  const shownErr = err || (pq.error as Error | null)?.message
  return (
    <Screen title="분양 받기" back="/more">
      <div className="page">
        <div className="hint" style={{ fontSize: 13 }}>
          분양해 준 사육자에게 받은 <b>분양 코드 8자리</b>를 입력하거나, 스캔 탭에서 분양 QR을 찍으세요. 체중·혈통·산란 기록이 내 계정에 같은 ID로 복사돼요.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input mono"
            style={{ flex: 1, minWidth: 0, letterSpacing: '.08em', fontWeight: 600 }}
            value={code}
            maxLength={9}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setErr('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            placeholder="ABCD-2345"
          />
          <button type="button" className="btn btn-primary" style={{ width: 76, height: 46, fontSize: 14, flex: 'none' }} onClick={check}>
            확인
          </button>
        </div>
        {shownErr && <div className="err">{shownErr}</div>}
        {pq.isFetching && !pv && <Spinner center />}

        {pv && a && (
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--blue)', fontWeight: 600 }}>
              {pv.from ?? '회원'}님이 보낸 개체
            </div>
            <div>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{nm(a)}</span>{' '}
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>
                {a.code}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--sub)' }}>
              {a.species} · {sexLbl(a.sex)} · {a.morph || '미정'} · 해칭 {a.hatch_date ? yd(a.hatch_date) : '미상'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span className="tag pill">체중 {pv.weights}회</span>
              <span className={`tag pill${pv.lineage ? '' : ' gray'}`}>{pv.lineage ? '혈통 정보 포함' : '혈통 정보 없음'}</span>
              {pv.clutches && <span className="tag pill">산란 {pv.clutches.n}차 기록</span>}
            </div>
            {pv.mine ? (
              <div className="err">내가 만든 분양 코드예요 — 받는 사람에게 코드를 전달해 주세요</div>
            ) : pv.state !== 'open' ? (
              <div className="err">{STATE_MSG[pv.state]}</div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={claim} disabled={busy}>
                {busy ? '받는 중…' : '내 개체로 받기'}
              </button>
            )}
          </div>
        )}
      </div>
    </Screen>
  )
}
