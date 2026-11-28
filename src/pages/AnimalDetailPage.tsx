import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeftRight, Camera, ChevronRight, Egg, FileText, HeartPulse, Network, QrCode, Utensils, Weight } from 'lucide-react'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useKeeper, useRefresh, useTransfers, type Animal, type Keeper, type Origin, type Transfer } from '../data/keeper'
import { ageParts } from '../lib/age'
import { gap, isoDay, today, yd } from '../lib/date'
import { fd, fw, nm, sexLbl, sexMark, STATUS_LABEL, type AnimalStatus } from '../lib/format'
import { spOf } from '../lib/species'
import { errMsg, publicUrl, supabase } from '../lib/supabase'
import { ErrorBox, Spinner } from '../ui/kit'
import { useMyShares } from '../data/adopt'
import { useMatings } from '../data/breeding'
import { useHealthLogs, useVetVisits } from '../data/health'
import type { Mating } from '../lib/breeding'
import { FEED_RESULT_LABEL, REFUSE_ALERT } from '../lib/feeding'
import { LEVEL_LABEL, type HealthLog, type VetVisit } from '../lib/health'
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
  const [sheet, setSheet] = useState<null | 'weight' | 'transfer' | 'feeding' | 'resume'>(() =>
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

  const T = today()
  const age = ageParts(a.hatch_date, T)
  const feedWarn = fsum.refuseStreak >= REFUSE_ALERT || fsum.overdue
  const lastOpen = openLogs[openLogs.length - 1]
  const parent = (x: Animal | null, pid: string | null) => (x ? nm(x) : pid ? '미등록' : '미상')

  // 기록 한 줄: 왼쪽에 이름, 오른쪽에 최근 상태. 누르면 그 기록 화면으로 간다
  const line = (test: string, icon: ReactNode, label: string, value: ReactNode, onClick: () => void, warn = false) => (
    <button type="button" className="row" data-test={test} onClick={onClick}>
      <span className="row-ic">{icon}</span>
      <span className="row-t grow">{label}</span>
      <span className={`row-v${warn ? ' warn' : ''}`}>{value}</span>
      <ChevronRight size={18} className="chev" />
    </button>
  )

  return (
    <Screen title="" back="/animals" right={{ label: '편집', onClick: () => nav(`/animals/${a.id}/edit`) }} wide>
      <div className="detail">
        <div style={{ minWidth: 0 }}>
          <div className="hero" data-test="animal-photo" onClick={() => nav(`/animals/${a.id}/edit`)}>
            {photo ? (
              <img src={photo} alt="" className="cover" />
            ) : (
              <>
                <Camera size={24} />
                <span>사진 추가</span>
              </>
            )}
          </div>

          <div className="detail-pad">
            <div className="sec-h" style={{ marginTop: 20 }}>
              <h1 className="h-display" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {nm(a)}
              </h1>
              <span className="meta" style={{ flex: 'none' }}>
                {sexMark(a.sex)} {sexLbl(a.sex)} · {STATUS_LABEL[a.status as AnimalStatus]}
              </span>
            </div>
            <div className="meta" style={{ marginTop: 4 }}>
              <span className="code">{a.code}</span> · {spOf(a)} · {a.morph || '모프 미정'}
            </div>

            {statusTxt && (
              <div className="card" style={{ marginTop: 16, padding: '12px 14px', fontSize: 13, color: 'var(--sub)', display: 'flex', flexDirection: 'column', gap: 10 }}>
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

            <div className="specs" data-test="animal-specs" style={{ marginTop: 20 }}>
              <div className="spec">
                <b>
                  {l ? (
                    <>
                      {l.g}
                      <small>g</small>
                    </>
                  ) : (
                    '—'
                  )}
                </b>
                <span className={l && l.diff !== null && l.diff < 0 ? 'warn' : undefined}>
                  체중 · {l ? (l.diff === null ? '첫 측정' : fd(l.diff)) : '기록 없음'}
                </span>
              </div>
              <div className="spec">
                <b>
                  {age.length
                    ? age.map((x, i) => (
                        <Fragment key={x.u}>
                          {i > 0 && ' '}
                          {x.n}
                          <small>{x.u}</small>
                        </Fragment>
                      ))
                    : '—'}
                </b>
                <span>{a.hatch_date ? `해칭 ${yd(a.hatch_date)}` : '해칭일 미상'}</span>
              </div>
              <div className="spec">
                <b>
                  {!fsum.last ? (
                    '—'
                  ) : fsum.daysSince === 0 ? (
                    '오늘'
                  ) : (
                    <>
                      {fsum.daysSince}
                      <small>일 전</small>
                    </>
                  )}
                </b>
                <span className={feedWarn ? 'warn' : undefined}>마지막 급여{fsum.last ? ` · ${FEED_RESULT_LABEL[fsum.last.result]}` : ''}</span>
              </div>
            </div>

            <div className="cta" style={{ marginTop: 20 }}>
              <button type="button" data-test="feed-open" className="btn btn-primary" onClick={() => setSheet('feeding')}>
                급여 기록
              </button>
              <button type="button" data-test="weight-open" className="btn btn-outline" onClick={() => setSheet('weight')}>
                체중 기록
              </button>
            </div>

            <h2 className="h-title" style={{ marginTop: 28 }}>
              기록
            </h2>
            <div className="rows">
              {line('row-feeding', <Utensils size={20} />, '급여', fsum.last ? feedLine(fsum) : '기록 없음', () => nav(`/animals/${a.id}/feeding`), feedWarn)}
              {line('row-weight', <Weight size={20} />, '체중', l ? `${fw(l.g)} · ${yd(l.date)}` : '기록 없음', () => nav(`/animals/${a.id}/weight`))}
              {line(
                'health-section',
                <HeartPulse size={20} />,
                '건강',
                lastOpen
                  ? `${lastOpen.area} · ${LEVEL_LABEL[lastOpen.level]}${openLogs.length > 1 ? ` 외 ${openLogs.length - 1}건` : ''}`
                  : nextVisit
                    ? `다음 재진 ${yd(nextVisit)} (D-${gap(T, nextVisit)})`
                    : '진행 중인 증상 없음',
                () => nav(`/animals/${a.id}/health`),
                !!lastOpen,
              )}
              {line(
                'row-clutch',
                <Egg size={20} />,
                a.sex === 'F' ? '산란' : '페어 산란',
                `${cs.length}${a.sex === 'F' ? '차' : '회'} · 알 ${cs.reduce((n, c) => n + c.eggs, 0)} · 자손 ${kids.length}`,
                () => nav(a.sex === 'F' && k.breeders.some((b) => b.female_id === a.id) ? `/clutch/${a.id}` : '/clutch'),
              )}
              {line(
                'row-lineage',
                <Network size={20} />,
                '혈통',
                `부 ${parent(sire, a.sire_id)} · 모 ${parent(dam, a.dam_id)} · COI ${(k.lineage.F(a.id) * 100).toFixed(2)}%`,
                () => nav(`/animals/${a.id}/lineage`),
              )}
            </div>

            <h2 className="h-title" style={{ marginTop: 28 }}>
              분양 · 라벨
            </h2>
            <div className="rows">
              {line('resume-open', <FileText size={20} />, '분양 이력서', shares?.has(a.id) ? '링크 켜짐' : '링크 만들기', () => setSheet('resume'))}
              {line('transfer-open', <ArrowLeftRight size={20} />, '분양 이전', '코드로 넘기기', () =>
                a.status === 'keeping' ? setSheet('transfer') : ui.toast('사육 중인 개체만 분양 이전할 수 있어요', 'warn'),
              )}
              {line('row-qr', <QrCode size={20} />, 'QR 라벨', '', () => nav(`/animals/${a.id}/qr`))}
            </div>
          </div>
        </div>

        <div className="detail-pad" style={{ minWidth: 0, paddingBottom: 28 }}>
          <h2 className="h-title" style={{ marginTop: 28 }}>
            활동 기록
          </h2>
          <div className="rows log">
            {feed(k, a, sent, myLogs, myVisits, matings).map((f, i) => (
              <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
                <span className="meta" style={{ width: 58, flex: 'none', paddingTop: 2 }}>
                  {f.date}
                </span>
                <span className="grow">
                  <span className={`micro${f.col === 'var(--warn)' ? ' warn' : ''}`}>{f.kind}</span>
                  <span className="row-t">{f.title}</span>
                  {f.sub && <span className="meta">{f.sub}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {sheet === 'weight' && <WeightSheet k={k} animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'feeding' && <FeedingSheet k={k} animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'transfer' && <TransferSheet animal={a} onClose={() => setSheet(null)} />}
      {sheet === 'resume' && <ResumeSheet animal={a} token={shares?.get(a.id) ?? null} onClose={() => setSheet(null)} />}
      {showCode && <TransferSheet animal={a} existing={showCode} onClose={() => setShowCode(null)} />}
    </Screen>
  )
}
