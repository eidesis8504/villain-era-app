// 급여 기록 목록(개체별)과 한꺼번에 기록(여러 개체)
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useKeeper, useRefresh } from '../data/keeper'
import { today, yd } from '../lib/date'
import { FEED_RESULT_LABEL, FEED_RESULTS, REFUSE_ALERT, type Feeding, type FeedResult } from '../lib/feeding'
import { nm } from '../lib/format'
import { bulkDefaultFood, bulkFoodChoices, getFoodPreset } from '../lib/products'
import { SPECIES, spOf } from '../lib/species'
import { errMsg, supabase } from '../lib/supabase'
import { Chips, ErrorBox, Seg, Spinner } from '../ui/kit'
import { FeedingSheet } from './FeedingSheet'
import { FeedStrip, RESULT_COLOR } from './FeedStrip'
import { AnimalThumb } from './shared'

export function feedLine(s: { daysSince: number | null; refuseStreak: number; last: Feeding | null }) {
  if (!s.last) return '급여 기록 없음'
  const when = s.daysSince === 0 ? '오늘' : `${s.daysSince}일 전`
  return `${when} · ${FEED_RESULT_LABEL[s.last.result]}` + (s.refuseStreak >= 2 ? ` · 연속 거부 ${s.refuseStreak}회` : '')
}

export function FeedingListPage() {
  const { id = '' } = useParams()
  const k = useKeeper()
  const [sheet, setSheet] = useState<{ edit: Feeding | null } | null>(null)
  const a = k.A(id)

  if (k.error) return <Screen title="급여" back="/feedings"><ErrorBox error={k.error} /></Screen>
  if (k.loading || (k.fetching && !a)) return <Screen title="급여" back="/feedings"><Spinner center /></Screen>
  if (!a) return <Screen title="급여" back="/feedings"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const list = [...k.fs(a.id)].reverse()
  const s = k.feedSum(a.id)
  const months = new Map<string, Feeding[]>()
  for (const x of list) {
    const m = x.fed_on.slice(0, 7)
    months.set(m, [...(months.get(m) ?? []), x])
  }
  const warn = s.refuseStreak >= REFUSE_ALERT

  return (
    <Screen title={`급여 · ${nm(a)}`} back={`/animals/${a.id}`}>
      <div className="page">
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {nm(a)} · <span className="mono">{a.code}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {a.feed_every_days ? `급여 주기 ${a.feed_every_days}일` : '급여 주기 미설정'}
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: warn || s.overdue ? 'var(--warn)' : 'var(--ink)' }}>{feedLine(s)}</div>
          <FeedStrip list={k.fs(a.id)} />
        </div>
        {warn && (
          <div className="welcome-card warn" style={{ fontSize: 13 }}>
            연속 {s.refuseStreak}회 거부했어요 · 온도·습도·탈피 여부와 체중 변화를 함께 확인해 보세요. 계속되면 파충류 진료 병원 상담을 권해요.
          </div>
        )}
        <button type="button" className="btn btn-primary" onClick={() => setSheet({ edit: null })}>
          + 급여 기록
        </button>
        {[...months].map(([m, rows]) => (
          <div key={m}>
            <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: '4px 0 6px 4px' }}>
              {m.replace('-', '.')}
            </div>
            <div className="list-card" style={{ padding: '0 16px' }}>
              {rows.map((x) => (
                <div key={x.id} className="list-row" style={{ padding: '12px 0' }} onClick={() => setSheet({ edit: x })}>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', width: 60, flex: 'none' }}>
                    {yd(x.fed_on).slice(3)}
                  </span>
                  <span className="tag" style={{ background: 'transparent', border: `1px solid ${RESULT_COLOR[x.result]}`, color: RESULT_COLOR[x.result] }}>
                    {FEED_RESULT_LABEL[x.result]}
                  </span>
                  <span className="ellipsis" style={{ flex: 1, fontSize: 14 }}>
                    {[x.food, x.amount].filter(Boolean).join(' ') || '—'}
                    {x.note && <span style={{ color: 'var(--muted)' }}> · {x.note}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!list.length && <div className="empty">아직 급여 기록이 없어요</div>}
      </div>
      {sheet && <FeedingSheet k={k} animal={a} edit={sheet.edit} onClose={() => setSheet(null)} />}
    </Screen>
  )
}

const ALL_FOODS = Array.from(new Set(Object.values(SPECIES).flatMap((s) => s.feed.foods)))

export function FeedingBulkPage() {
  const k = useKeeper()
  const nav = useNavigate()
  const ui = useUI()
  const refresh = useRefresh()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<FeedResult>('ate')
  // 내 사료(제품 QR로 기억한 먹이): 사육 중인 개체가 모두 급여 대상 종이면 먼저 골라 둔다. 직접 고르면 그 값을 쓴다
  const [preset] = useState(() => getFoodPreset())
  const [picked, setFood] = useState<string | null>(null)
  const food = picked ?? bulkDefaultFood(k.owned.map(spOf), preset)
  const [busy, setBusy] = useState(false)
  const owned = useMemo(() => {
    // 확인이 필요한 개체(주기 초과·연속 거부)를 위로
    const score = (id: string) => {
      const s = k.feedSum(id)
      return (s.refuseStreak >= REFUSE_ALERT ? 2 : 0) + (s.overdue ? 1 : 0)
    }
    return [...k.owned].sort((x, y) => score(y.id) - score(x.id) || (x.code < y.code ? -1 : 1))
  }, [k])

  if (k.error) return <Screen title="한꺼번에 급여 기록" back="/"><ErrorBox error={k.error} /></Screen>
  if (k.loading) return <Screen title="한꺼번에 급여 기록" back="/"><Spinner center /></Screen>

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allOn = owned.length > 0 && sel.size === owned.length

  const save = async () => {
    if (!sel.size || busy) return
    setBusy(true)
    const T = today()
    const rows = [...sel].map((animal_id) => ({ animal_id, fed_on: T, result, food: food.trim().slice(0, 30) }))
    const { error } = await supabase.from('feedings').insert(rows)
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '급여 기록을 저장하지 못했어요'), 'warn')
    await refresh('feedings', 'notifications')
    ui.toast(`${rows.length}마리 급여 기록 · ${FEED_RESULT_LABEL[result]}`)
    setSel(new Set())
  }

  return (
    <Screen title="한꺼번에 급여 기록" back="/">
      <div className="page">
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="label" style={{ margin: 0 }}>
            오늘 결과
          </div>
          <Seg height={44} items={FEED_RESULTS.map((r) => [r, FEED_RESULT_LABEL[r]] as const)} value={result} onChange={setResult} />
          <Chips
            wrap
            small
            items={bulkFoodChoices(ALL_FOODS, preset).map((x) => [x, x] as const)}
            value={food}
            onChange={(x) => setFood(food === x ? '' : x)}
          />
          <button type="button" data-test="bulk-save" className="btn btn-primary" onClick={save} disabled={!sel.size || busy}>
            {busy ? '저장 중…' : sel.size ? `선택한 ${sel.size}마리 기록` : '기록할 개체를 골라 주세요'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>사육 중 {owned.length}마리</span>
          <button
            type="button"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}
            onClick={() => setSel(allOn ? new Set() : new Set(owned.map((x) => x.id)))}
          >
            {allOn ? '선택 해제' : '모두 선택'}
          </button>
        </div>
        <div className="list-card" style={{ padding: '0 16px' }}>
          {owned.map((x) => {
            const s = k.feedSum(x.id)
            const on = sel.has(x.id)
            const warn = s.refuseStreak >= REFUSE_ALERT || s.overdue
            return (
              <div key={x.id} className="list-row" style={{ padding: '10px 0' }} onClick={() => toggle(x.id)}>
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    flex: 'none',
                    border: `2px solid ${on ? 'var(--blue)' : '#BDB8AD'}`,
                    background: on ? 'var(--blue)' : '#fff',
                    color: '#fff',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <AnimalThumb path={x.photo_path} mark={x.sex === 'F' ? '♀' : x.sex === 'M' ? '♂' : '–'} size={38} radius={10} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
                    {nm(x)} <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>{x.code}</span>
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: warn ? 'var(--warn)' : 'var(--muted)' }}>{feedLine(s)}</span>
                </span>
                <button
                  type="button"
                  aria-label="급여 기록 보기"
                  onClick={(e) => {
                    e.stopPropagation()
                    nav(`/animals/${x.id}/feeding`)
                  }}
                  style={{ color: 'var(--muted-2)', padding: '0 4px' }}
                >
                  ›
                </button>
              </div>
            )
          })}
          {!owned.length && <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>사육 중인 개체가 없어요</div>}
        </div>
      </div>
    </Screen>
  )
}
