// 건강 기록 목록(증상·진료)과 상담 카드 화면
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useHealthLogs, useHealthPhotoUrls, useVetVisits } from '../data/health'
import { useKeeper } from '../data/keeper'
import { addD, gap, today, yd } from '../lib/date'
import { nm } from '../lib/format'
import { buildConsult, HEALTH_NOTICE, LEVEL_LABEL, type HealthLog, type VetVisit } from '../lib/health'
import { downloadBlob } from '../lib/qr'
import { ErrorBox, Spinner } from '../ui/kit'
import { consultPng, HealthCardView } from './ConsultCard'
import { SymptomSheet, VetSheet } from './HealthSheets'

type SheetState = null | { type: 'symptom'; edit: HealthLog | null } | { type: 'vet'; edit: VetVisit | null }

export function HealthPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const k = useKeeper()
  const logsQ = useHealthLogs()
  const visitsQ = useVetVisits()
  const [sheet, setSheet] = useState<SheetState>(null)
  const a = k.A(id)
  const logs = (logsQ.data ?? []).filter((x) => x.animal_id === id).reverse()
  const visits = (visitsQ.data ?? []).filter((x) => x.animal_id === id).reverse()
  const urls = useHealthPhotoUrls(logs.flatMap((x) => x.photos)).data ?? {}

  const err = k.error || logsQ.error || visitsQ.error
  if (err) return <Screen title="건강" back={`/animals/${id}`}><ErrorBox error={err} /></Screen>
  if (k.loading || logsQ.isLoading || visitsQ.isLoading) return <Screen title="건강" back={`/animals/${id}`}><Spinner center /></Screen>
  if (!a) return <Screen title="건강" back="/animals"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const open = logs.filter((x) => !x.resolved_on)
  const done = logs.filter((x) => x.resolved_on)
  const T = today()

  const logRow = (x: HealthLog) => (
    <div key={x.id} className="list-row" style={{ padding: '12px 0', alignItems: 'flex-start' }} onClick={() => setSheet({ type: 'symptom', edit: x })}>
      <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', width: 58, flex: 'none', paddingTop: 2 }}>
        {yd(x.logged_on)}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {x.area} · <span style={{ color: x.level === 3 ? 'var(--warn)' : 'var(--sub)' }}>{LEVEL_LABEL[x.level]}</span>
          {x.resolved_on && <span style={{ fontSize: 12, color: 'var(--muted)' }}> · {yd(x.resolved_on)} 해결</span>}
        </span>
        {x.note && <span style={{ fontSize: 13, color: 'var(--sub)', overflowWrap: 'anywhere' }}>{x.note}</span>}
        {x.photos.length > 0 && (
          <span style={{ display: 'flex', gap: 6 }}>
            {x.photos.map((p) => (
              <img key={p} src={urls[p]} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: 'cover', background: 'var(--seg)' }} />
            ))}
          </span>
        )}
      </span>
    </div>
  )

  return (
    <Screen title={`건강 · ${nm(a)}`} back={`/animals/${a.id}`}>
      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setSheet({ type: 'symptom', edit: null })}>
            + 증상
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSheet({ type: 'vet', edit: null })}>
            + 진료
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => nav(`/animals/${a.id}/consult`)}>
            상담 카드
          </button>
        </div>
        <div className="hint">{HEALTH_NOTICE}</div>

        <div className="section-title">진행 중인 증상 {open.length > 0 && <span className="mono" style={{ fontSize: 12, color: 'var(--warn)' }}>{open.length}</span>}</div>
        <div className="list-card" style={{ padding: '0 16px' }}>
          {open.map(logRow)}
          {!open.length && <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>진행 중인 증상이 없어요</div>}
        </div>

        <div className="section-title">진료 기록</div>
        <div className="list-card" style={{ padding: '0 16px' }}>
          {visits.map((v) => (
            <div key={v.id} className="list-row" style={{ padding: '12px 0', alignItems: 'flex-start' }} onClick={() => setSheet({ type: 'vet', edit: v })}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', width: 58, flex: 'none', paddingTop: 2 }}>
                {yd(v.visited_on)}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{v.clinic || '병원'}{v.diagnosis ? ` · ${v.diagnosis}` : ''}</span>
                {v.treatment && <span style={{ fontSize: 13, color: 'var(--sub)' }}>{v.treatment}</span>}
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {v.cost != null ? `${v.cost.toLocaleString()}원` : ''}
                  {v.next_visit && (
                    <b style={{ color: v.next_visit >= T ? 'var(--ink)' : 'var(--muted)' }}>
                      {v.cost != null ? ' · ' : ''}재진 {yd(v.next_visit)}
                      {v.next_visit >= T ? ` (D-${gap(T, v.next_visit)})` : ''}
                    </b>
                  )}
                </span>
              </span>
            </div>
          ))}
          {!visits.length && <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>진료 기록이 없어요</div>}
        </div>

        {done.length > 0 && (
          <>
            <div className="section-title">해결된 증상</div>
            <div className="list-card" style={{ padding: '0 16px' }}>
              {done.map(logRow)}
            </div>
          </>
        )}
      </div>
      {sheet?.type === 'symptom' && <SymptomSheet animal={a} edit={sheet.edit} onClose={() => setSheet(null)} />}
      {sheet?.type === 'vet' && <VetSheet animal={a} edit={sheet.edit} onClose={() => setSheet(null)} />}
    </Screen>
  )
}

export function ConsultPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const ui = useUI()
  const k = useKeeper()
  const logsQ = useHealthLogs()
  const visitsQ = useVetVisits()
  const [pick, setPick] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const a = k.A(id)
  const logs = (logsQ.data ?? []).filter((x) => x.animal_id === id)
  const visits = (visitsQ.data ?? []).filter((x) => x.animal_id === id)
  const T = today()
  const recentPhotos = logs.filter((x) => x.logged_on >= addD(T, -30) || !x.resolved_on).flatMap((x) => x.photos).slice(-9)
  const urls = useHealthPhotoUrls(recentPhotos).data ?? {}

  const err = k.error || logsQ.error || visitsQ.error
  if (err) return <Screen title="상담 카드" back={`/animals/${id}`}><ErrorBox error={err} /></Screen>
  if (k.loading || logsQ.isLoading || visitsQ.isLoading) return <Screen title="상담 카드" back={`/animals/${id}`}><Spinner center /></Screen>
  if (!a) return <Screen title="상담 카드" back="/animals"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const data = buildConsult({ label: `${nm(a)} ${a.code}`, weights: k.ws(a.id), feeds: k.fs(a.id), logs, visits, today: T })

  const save = async () => {
    setBusy(true)
    try {
      const blob = await consultPng(data)
      const file = new File([blob], `상담카드_${a.code}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: '상담 카드' })
      else downloadBlob(blob, file.name)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') ui.toast('이미지를 만들지 못했어요', 'warn')
    }
    setBusy(false)
  }

  return (
    <Screen title={`상담 카드 · ${nm(a)}`} back={`/animals/${a.id}/health`}>
      <div className="page">
        <div className="hint" style={{ fontSize: 13 }}>
          최근 체중·급여·증상·진료를 한 장으로 모았어요. 병원에 보여 주거나 커뮤니티 Q&A에 첨부해 조언을 구해 보세요.
        </div>
        <HealthCardView data={data} photoUrls={pick.map((p) => urls[p]).filter(Boolean)} />
        {recentPhotos.length > 0 && (
          <div>
            <div className="label">Q&A에 함께 올릴 증상 사진 (선택한 사진만 공개돼요)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recentPhotos.map((p) => {
                const on = pick.includes(p)
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPick((s) => (on ? s.filter((x) => x !== p) : s.length < 3 ? [...s, p] : s))}
                    style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: `3px solid ${on ? 'var(--blue)' : 'transparent'}` }}
                  >
                    <img src={urls[p]} alt="" className="cover" />
                    {on && <span style={{ position: 'absolute', top: 2, right: 4, color: '#fff', fontWeight: 600, textShadow: '0 0 3px #000' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="btn btn-outline" onClick={save} disabled={busy}>
            {busy ? '만드는 중…' : '이미지로 저장'}
          </button>
          <button
            type="button"
            data-test="consult-ask"
            className="btn btn-primary"
            onClick={() => nav('/community/new', { state: { attach: 'health', animal: a.id, photos: pick } })}
          >
            Q&A에 질문하기
          </button>
        </div>
      </div>
    </Screen>
  )
}
