import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useKeeper, useRefresh, useTransfers, type Animal, type Keeper, type Origin, type Transfer } from '../data/keeper'
import { gap, isoDay, today, yd } from '../lib/date'
import { fd, fw, nm, sexLbl } from '../lib/format'
import { spInfo, spOf } from '../lib/species'
import { errMsg, publicUrl, supabase } from '../lib/supabase'
import { ErrorBox, Spinner } from '../ui/kit'
import { useMyShares } from '../data/adopt'
import { useMatings } from '../data/breeding'
import { useHealthLogs, useVetVisits } from '../data/health'
import type { Mating } from '../lib/breeding'
import { FEED_RESULT_LABEL, REFUSE_ALERT } from '../lib/feeding'
import { HEALTH_NOTICE, LEVEL_LABEL, type HealthLog, type VetVisit } from '../lib/health'
import { SymptomSheet, VetSheet } from './HealthSheets'
import { FeedingSheet } from './FeedingSheet'
import { feedLine } from './FeedingPages'
import { ResumeSheet } from './ResumeSheet'
import { TransferSheet, WeightSheet } from './sheets'

type Ev = { k: string; date: string; kind: string; col: string; title: string; sub: string }

const ITEMS = (t: Transfer) =>
  [t.include_weights && '체중 기록', t.include_lineage && '혈통 정보', t.include_clutches && '산란 기록'].filter(Boolean).join(', ') ||
  '기본 정보만'

function feed(k: Keeper, a: Animal, sent: Transfer[], logs: HealthLog[], visits: VetVisit[], matings: Mating[]): Ev[] {
  const ev: Ev[] = []
  matings
    .filter((m) => m.female_id === a.id || m.male_id === a.id)
    .slice(-5)
    .forEach((m) => {
      const partner = k.A(m.female_id === a.id ? m.male_id : m.female_id)
      ev.push({ k: m.paired_on + '.m', date: yd(m.paired_on), kind: '메이팅', col: 'var(--blue)', title: `메이팅 · ${partner ? nm(partner) : '상대 미상'}`, sub: m.locked ? '락 확인' : m.note || '메이팅 기록' })
    })
  const br = k.breeders.find((b) => b.female_id === a.id)
  if (br?.gravid_on) {
    ev.push({ k: br.gravid_on + '.g', date: yd(br.gravid_on), kind: '그라비드', col: 'var(--blue)', title: '그라비드 확인', sub: br.lay_expected_on ? `산란 예정 ${yd(br.lay_expected_on)}` : '' })
  }
  logs.slice(-10).forEach((x) =>
    ev.push({
      k: x.logged_on + '.h' + x.id,
      date: yd(x.logged_on),
      kind: '증상',
      col: 'var(--warn)',
      title: `${x.area} · ${LEVEL_LABEL[x.level]}` + (x.resolved_on ? ' (해결)' : ''),
      sub: x.note || '증상 기록',
    }),
  )
  visits.slice(-5).forEach((v) =>
    ev.push({
      k: v.visited_on + '.v' + v.id,
      date: yd(v.visited_on),
      kind: '진료',
      col: 'var(--sub)',
      title: `${v.clinic || '병원'}${v.diagnosis ? ' · ' + v.diagnosis : ''}`,
      sub: v.next_visit ? `재진 ${yd(v.next_visit)}` : v.treatment || '진료 기록',
    }),
  )
  const w = k.ws(a.id)
  w.forEach((x, i) => {
    const p = w[i - 1]
    const df = p ? Math.round((x.grams - p.grams) * 10) / 10 : null
    ev.push({
      k: x.measured_on,
      date: yd(x.measured_on),
      kind: '체중',
      col: df !== null && df < 0 ? 'var(--warn)' : 'var(--blue)',
      title: `${fw(x.grams)}  ${df === null ? '' : fd(df)}`.trim(),
      sub: p ? `직전 ${yd(p.measured_on)} ${fw(p.grams)}` + (df! < 0 ? ' · 감소 경고' : '') : '첫 측정',
    })
  })
  k.fs(a.id)
    .slice(-10)
    .forEach((x) => {
      ev.push({
        k: x.fed_on + '.' + String(x.id).padStart(9, '0'),
        date: yd(x.fed_on),
        kind: '급여',
        col: x.result === 'refused' ? 'var(--warn)' : x.result === 'unknown' ? 'var(--muted-2)' : 'var(--blue)',
        title: FEED_RESULT_LABEL[x.result] + (x.food ? ` · ${x.food}` : '') + (x.amount ? ` ${x.amount}` : ''),
        sub: x.note || '급여 기록',
      })
    })
  k.clutches
    .filter((c) => c.dam_id === a.id || c.sire_id === a.id)
    .forEach((c) => {
      const partner = k.A(c.dam_id === a.id ? c.sire_id : c.dam_id)
      const inc = k.incub(c)
      ev.push({
        k: c.laid_on,
        date: yd(c.laid_on),
        kind: '산란',
        col: 'var(--blue)',
        title: `${c.seq}차 산란 · 알 ${c.eggs} (유정 ${c.fertile})`,
        sub: `페어 ${nm(partner)} · ` + (inc ? `인큐 중 ${inc}개` : '완료'),
      })
      const by = new Map<string, string[]>()
      for (const kid of k.hatched(c)) {
        const d = kid.hatch_date ?? c.laid_on
        by.set(d, [...(by.get(d) ?? []), kid.code])
      }
      for (const [d, codes] of by) {
        ev.push({ k: d + '~', date: yd(d), kind: '부화', col: 'var(--blue)', title: `${c.seq}차 부화 → ${codes.join(', ')} 자동 등록`, sub: '부모 연결됨' })
      }
      if (c.dead) {
        const d = c.dead_on ?? c.laid_on
        ev.push({
          k: d + '~',
          date: yd(d),
          kind: '폐사',
          col: 'var(--warn)',
          title: `${c.seq}차 알 ${c.dead}개 폐사`,
          sub: '실패 기록' + (c.dead_note ? ' · ' + c.dead_note : ''),
        })
      }
    })
  for (const t of sent) {
    const d = isoDay(t.created_at)
    ev.push({
      k: d + '~~',
      date: yd(d),
      kind: '분양',
      col: 'var(--sub)',
      title: t.claimed_at
        ? `${t.claimer?.nickname ?? '회원'}님이 인수 완료`
        : t.canceled_at
          ? `분양 취소 (코드 ${t.code})`
          : `${t.recipient_label || '분양'} · 코드 ${t.code} 발급`,
      sub: '전달: ' + ITEMS(t),
    })
  }
  const o = a.origin as Origin | null
  if (o?.from || o?.received_on) {
    ev.push({
      k: (o.received_on ?? '') + '~~',
      date: yd(o.received_on),
      kind: '분양',
      col: 'var(--sub)',
      title: `${o.from ?? '회원'}님에게서 분양받음`,
      sub: '전달: ' + (o.items || '기본 정보만'),
    })
  }
  if (a.status !== 'external' && a.hatch_date) {
    const s = k.A(a.sire_id)
    const d = k.A(a.dam_id)
    ev.push({
      k: a.hatch_date,
      date: yd(a.hatch_date),
      kind: '해칭',
      col: 'var(--muted)',
      title: '해칭',
      sub: a.sire_id || a.dam_id ? `부 ${s?.code ?? '미상'} · 모 ${d?.code ?? '미상'}` : '부모 미상',
    })
  }
  return ev.sort((x, y) => (x.k < y.k ? 1 : -1)).slice(0, 20)
}

export default function AnimalDetailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const ui = useUI()
  const refresh = useRefresh()
  const k = useKeeper()
  const transfers = useTransfers().data ?? []
  // ?feed=1 (제품 QR로 시작해 첫 개체를 등록한 직후): 급여 기록을 한 번 열고 주소에서 표시를 지운다
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState<null | 'weight' | 'transfer' | 'feeding' | 'symptom' | 'vet' | 'resume'>(() =>
    params.get('feed') === '1' ? 'feeding' : null,
  )
  // 분양 이력서 링크가 살아 있는 개체
  const shares = useMyShares().data
  useEffect(() => {
    if (params.has('feed')) setParams({}, { replace: true })
  }, [params, setParams])
  const healthLogs = useHealthLogs().data
  const vetVisits = useVetVisits().data
  const matings = useMatings().data ?? []
  const [showCode, setShowCode] = useState<Transfer | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const a = k.A(id)

  if (k.error) return <Screen title="개체 상세" back="/animals"><ErrorBox error={k.error} /></Screen>
  if (k.loading || (k.fetching && !a)) return <Screen title="개체 상세" back="/animals"><Spinner center /></Screen>
  if (!a) return <Screen title="개체 상세" back="/animals"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const l = k.lastW(a.id)
  const fsum = k.feedSum(a.id)
  const myLogs = (healthLogs ?? []).filter((x) => x.animal_id === a.id)
  const myVisits = (vetVisits ?? []).filter((x) => x.animal_id === a.id)
  const openLogs = myLogs.filter((x) => !x.resolved_on)
  const nextVisit = myVisits.map((v) => v.next_visit).filter((d): d is string => !!d && d >= today()).sort()[0]
  const sire = k.A(a.sire_id)
  const dam = k.A(a.dam_id)
  const cs = k.clutches.filter((c) => (a.sex === 'F' ? c.dam_id === a.id : c.sire_id === a.id))
  const kids = k.animals.filter((x) => x.dam_id === a.id || x.sire_id === a.id)
  const sent = transfers.filter((t) => t.animal_id === a.id && t.owner_id === a.owner_id)
  const pending = sent.find((t) => !t.claimed_at && !t.canceled_at)
  const claimed = sent.find((t) => t.claimed_at)
  const photo = a.photo_path ? publicUrl('animal-photos', a.photo_path) : ''

  const statusTxt =
    a.status === 'sold'
      ? pending
        ? `분양 진행 중 · 코드 ${pending.code.slice(0, 4)}-${pending.code.slice(4)} · 받는 사람이 코드를 입력하면 기록이 전달돼요`
        : claimed
          ? `분양 완료 · ${claimed.claimer?.nickname ?? '회원'} · ${yd(isoDay(claimed.claimed_at!))}`
          : '분양 완료'
      : a.status === 'external'
        ? '외부 개체 · 혈통 추적용으로 등록됨'
        : a.status === 'dead'
          ? '폐사 처리된 개체'
          : ''

  const cancelTransfer = async () => {
    if (!pending) return
    if (!cancelling) return setCancelling(true)
    const { error } = await supabase.rpc('cancel_transfer', { p_id: pending.id })
    setCancelling(false)
    if (error) return ui.toast(errMsg(error, '분양을 취소하지 못했어요'), 'warn')
    await refresh('animals', 'transfers')
    ui.toast('분양을 취소했어요 · 다시 사육 중으로 바뀌었어요')
  }

  const node = (role: string, x: Animal | null, pid: string | null) => (
    <div onClick={() => x && nav(`/animals/${x.id}`)} style={{ cursor: x ? 'pointer' : 'default', minWidth: 0 }}>
      <div style={{ fontSize: 11, opacity: 0.75 }}>{role}</div>
      <div className="mono" style={{ fontWeight: 600, fontSize: 13, overflowWrap: 'anywhere' }}>
        {x?.code ?? (pid ? '미등록' : '미상')}
      </div>
      <div style={{ fontSize: 12 }}>{x ? nm(x) : '—'}</div>
    </div>
  )

  const stat = (label: string, big: string, small: string, col: string, onClick: () => void) => (
    <div className="stat" onClick={onClick} style={{ padding: '11px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div className="mono" style={{ fontWeight: 600, fontSize: 18 }}>
        {big}
      </div>
      <div className="mono" style={{ fontWeight: 600, fontSize: 11, color: col }}>
        {small}
      </div>
    </div>
  )

  return (
    <Screen title="개체 상세" back="/animals" right={{ label: '편집', onClick: () => nav(`/animals/${a.id}/edit`) }} wide>
      <div className="page-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ background: 'var(--blue)', color: 'var(--cream)', borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, fontSize: 11, letterSpacing: '.12em', opacity: 0.8 }}>
              <span>VILLAIN ERA · ID</span>
              <span>{spInfo(a).en}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 14 }}>
              <div
                onClick={() => nav(`/animals/${a.id}/edit`)}
                className="mono"
                style={{
                  height: 116,
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'repeating-linear-gradient(135deg,rgba(250,249,246,.18) 0 8px,rgba(250,249,246,.08) 8px 16px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 500,
                  fontSize: 11,
                }}
              >
                {photo ? <img src={photo} alt="" className="cover" /> : <span>+ 사진</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span className="mono" style={{ fontWeight: 600, fontSize: 20, letterSpacing: '.02em', overflowWrap: 'anywhere' }}>
                  {a.code}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{nm(a)}</span>
                <span style={{ fontSize: 12, opacity: 0.9 }}>
                  {spOf(a)} · {sexLbl(a.sex)} · {a.morph || '미정'}
                </span>
                <span className="mono" style={{ fontSize: 12, opacity: 0.9 }}>
                  HATCH {a.hatch_date ?? '미상'}
                </span>
              </div>
            </div>
            <div style={{ height: 1, background: 'rgba(250,249,246,.3)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 64px', gap: 10, alignItems: 'end' }}>
              {node('부', sire, a.sire_id)}
              {node('모', dam, a.dam_id)}
              <button
                type="button"
                className="mono"
                onClick={() => nav(`/animals/${a.id}/qr`)}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  background: 'repeating-linear-gradient(90deg,#FAF9F6 0 4px,#E3E8F0 4px 8px)',
                  fontWeight: 600,
                  fontSize: 10,
                  color: 'var(--blue)',
                }}
              >
                QR
              </button>
            </div>
          </div>

          {statusTxt && (
            <div style={{ background: 'var(--seg)', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--sub)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span>{statusTxt}</span>
              {pending && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline btn-xs" style={{ flex: 1 }} onClick={() => setShowCode(pending)}>
                    코드 · QR 보기
                  </button>
                  <button type="button" className={`btn btn-danger btn-xs${cancelling ? ' on' : ''}`} style={{ flex: 1 }} onClick={cancelTransfer}>
                    {cancelling ? '한 번 더 누르면 취소' : '분양 취소'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {stat(
              '급여',
              fsum.last ? (fsum.daysSince === 0 ? '오늘' : `${fsum.daysSince}일 전`) : '—',
              fsum.last
                ? FEED_RESULT_LABEL[fsum.last.result] + (fsum.refuseStreak >= 2 ? ` · 거부 ${fsum.refuseStreak}회` : '')
                : '기록 없음',
              fsum.refuseStreak >= REFUSE_ALERT || fsum.overdue ? 'var(--warn)' : 'var(--blue)',
              () => nav(`/animals/${a.id}/feeding`),
            )}
            {stat(
              '체중',
              l ? fw(l.g) : '—',
              l ? (l.diff === null ? '첫 측정' : fd(l.diff)) : '기록 없음',
              l && l.diff !== null && l.diff < 0 ? 'var(--warn)' : 'var(--blue)',
              () => nav(`/animals/${a.id}/weight`),
            )}
            {stat(
              a.sex === 'F' ? '산란' : '페어 산란',
              cs.length + (a.sex === 'F' ? '차' : '회'),
              `알 ${cs.reduce((n, c) => n + c.eggs, 0)} · 자손 ${kids.length}`,
              'var(--muted)',
              () => nav(a.sex === 'F' && k.breeders.some((b) => b.female_id === a.id) ? `/clutch/${a.id}` : '/clutch'),
            )}
            {stat('COI', (k.lineage.F(a.id) * 100).toFixed(2), `조상 ${k.lineage.knownAnc(a.id)}/6`, 'var(--muted)', () =>
              nav(`/animals/${a.id}/lineage`),
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" data-test="feed-open" className="btn btn-primary btn-sm" onClick={() => setSheet('feeding')}>
              + 급여
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSheet('weight')}>
              + 체중
            </button>
            <button type="button" data-test="resume-open" className="btn btn-outline btn-sm" onClick={() => setSheet('resume')}>
              {shares?.has(a.id) ? '분양 이력서 · 공유 중' : '분양 이력서'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => (a.status === 'keeping' ? setSheet('transfer') : ui.toast('사육 중인 개체만 분양 이전할 수 있어요', 'warn'))}
            >
              분양 이전
            </button>
          </div>

          <div className="card card-pad" data-test="health-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="section-title">건강</span>
              <button type="button" onClick={() => nav(`/animals/${a.id}/health`)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>
                기록 보기
              </button>
            </div>
            {openLogs.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {openLogs.slice(-3).map((x) => (
                  <span key={x.id} className="tag warn">
                    {x.area} · {LEVEL_LABEL[x.level]}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>진행 중인 증상이 없어요</div>
            )}
            {nextVisit && (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>
                다음 재진 {yd(nextVisit)} (D-{gap(today(), nextVisit)})
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setSheet('symptom')}>
                + 증상
              </button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setSheet('vet')}>
                + 진료
              </button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => nav(`/animals/${a.id}/consult`)}>
                상담 카드
              </button>
            </div>
            <div className="hint">{HEALTH_NOTICE}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 6 }}>
            <span className="section-title">활동 기록</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{feedLine(fsum)}</span>
          </div>
          <div>
            {feed(k, a, sent, myLogs, myVisits, matings).map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '62px 1fr', gap: 10, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)', paddingTop: 2 }}>
                  {f.date}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: f.col }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: f.col }}>{f.kind}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{f.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{f.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {sheet === 'weight' && <WeightSheet k={k} animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'feeding' && <FeedingSheet k={k} animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'symptom' && <SymptomSheet animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'vet' && <VetSheet animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'transfer' && <TransferSheet animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'resume' && <ResumeSheet animal={a} token={shares?.get(a.id) ?? null} onClose={() => setSheet(null)} />}
      {showCode && <TransferSheet animal={a} existing={showCode} onClose={() => setShowCode(null)} />}
    </Screen>
  )
}
