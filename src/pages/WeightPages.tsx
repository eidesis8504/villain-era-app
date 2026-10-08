import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useKeeper, type Animal, type Weight } from '../data/keeper'
import { gap, today, yd } from '../lib/date'
import { fd, fw, nm } from '../lib/format'
import { ErrorBox, Spinner } from '../ui/kit'
import { WeightSheet } from './sheets'

export function WeightPage() {
  const { id = '' } = useParams()
  const k = useKeeper()
  const [sheet, setSheet] = useState<{ edit: Weight | null } | null>(null)
  const a = k.A(id)

  if (k.error) return <Screen title="체중" back="/weights"><ErrorBox error={k.error} /></Screen>
  if (k.loading || (k.fetching && !a)) return <Screen title="체중" back="/weights"><Spinner center /></Screen>
  if (!a) return <Screen title="체중" back="/weights"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const w = k.ws(a.id)
  const l = k.lastW(a.id)
  const gs = w.map((x) => x.grams)
  const mx = gs.length ? Math.max(...gs) : 1
  const mn = gs.length ? Math.min(...gs) : 0
  const pd = (mx - mn) * 0.12 || 1
  const hi = mx + pd
  const lo = Math.max(0, mn - pd)
  const pts = w.map((x, i) => [w.length > 1 ? (i / (w.length - 1)) * 100 : 50, (1 - (x.grams - lo) / (hi - lo)) * 100])
  const line = pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  const area = pts.length ? `${pts[0][0].toFixed(2)},100 ${line} ${pts[pts.length - 1][0].toFixed(2)},100` : ''
  const days = w.length > 1 ? gap(w[0].measured_on, w[w.length - 1].measured_on) : 0
  const rate = days ? ((w[w.length - 1].grams - w[0].grams) / days) * 30 : null
  const warn = !!(l && l.diff !== null && l.diff < 0)

  return (
    <Screen title={`체중 · ${nm(a)}`} back={`/animals/${a.id}`}>
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {nm(a)} · <span className="mono">{a.code}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span className="mono" style={{ fontWeight: 600, fontSize: 34 }}>
                {l ? fw(l.g) : '—'}
              </span>
              <span className="mono" style={{ fontWeight: 600, fontSize: 15, color: warn ? 'var(--warn)' : 'var(--blue)' }}>
                {l ? (l.diff === null ? '첫 측정' : fd(l.diff)) : '기록 없음'}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>월 평균 성장</div>
            <div className="mono" style={{ fontWeight: 600, fontSize: 16, color: 'var(--blue)' }}>
              {rate === null ? '—' : (rate >= 0 ? '+' : '−') + fw(Math.abs(rate))}
            </div>
          </div>
        </div>

        {warn && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--warn-soft)', borderRadius: 12, padding: '11px 14px' }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--warn)' }}>
              !
            </span>
            <span style={{ fontSize: 13, color: '#5A2A05', fontWeight: 500 }}>
              직전 측정보다 {fw(Math.abs(l!.diff!))} 줄었어요 · 급여·탈피·산란 여부를 확인해 주세요
            </span>
          </div>
        )}

        {w.length > 0 ? (
          <div className="card card-pad">
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-2)' }}>
              <span>{fw(hi)}</span>
              <span>{w.length}회 측정</span>
            </div>
            <div style={{ position: 'relative', height: 150, margin: '8px 6px 0' }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                <polygon points={area} fill="#E6EDF7" />
                <polyline points={line} fill="none" stroke="#0148AB" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </svg>
              {pts.map((p, i) => {
                const s = i === pts.length - 1 ? 12 : 9
                return (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${p[0]}%`,
                      top: `${p[1]}%`,
                      width: s,
                      height: s,
                      borderRadius: '50%',
                      background: i && w[i].grams < w[i - 1].grams ? '#B4540A' : '#0148AB',
                      transform: 'translate(-50%,-50%)',
                      border: '2px solid #fff',
                    }}
                  />
                )
              })}
            </div>
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-2)', marginTop: 8 }}>
              <span>{yd(w[0].measured_on)}</span>
              <span>최저 {fw(lo)}</span>
              <span>{l ? yd(l.date) : ''}</span>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px dashed var(--off)', borderRadius: 16, padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            아직 체중 기록이 없어요
          </div>
        )}

        <button type="button" className="btn btn-primary" style={{ height: 48 }} onClick={() => setSheet({ edit: null })}>
          + 체중 기록
        </button>

        {w.length > 0 && (
          <div className="list-card">
            {[...w].reverse().map((x) => {
              const i = w.indexOf(x)
              const p = w[i - 1]
              const df = p ? Math.round((x.grams - p.grams) * 10) / 10 : null
              return (
                <div
                  key={x.id}
                  data-test="weight-row"
                  className="list-row mono"
                  onClick={() => setSheet({ edit: x })}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto 86px 12px', gap: 10 }}
                >
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{yd(x.measured_on)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{fw(x.grams)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: df !== null && df < 0 ? 'var(--warn)' : 'var(--blue)' }}>
                    {df === null ? '첫 측정' : fd(df) + (df < 0 ? ' ▼' : '')}
                  </span>
                  <span style={{ fontSize: 16, color: '#9A9EA5', textAlign: 'right' }}>›</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {sheet && <WeightSheet k={k} animal={a} edit={sheet.edit} onClose={() => setSheet(null)} />}
    </Screen>
  )
}

export function WeightAllPage() {
  const nav = useNavigate()
  const k = useKeeper()
  const [sheet, setSheet] = useState<Animal | null>(null)
  const T = today()
  const items = k.owned.map((a) => {
    const l = k.lastW(a.id)
    return { a, l, stale: !l || gap(l.date, T) > 14 }
  })

  return (
    <Screen title="체중 측정" back="/" wide>
      {k.error ? (
        <ErrorBox error={k.error} />
      ) : (
        <div className="page-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))', gap: 10 }}>
          {k.loading && (
            <div className="span-all">
              <Spinner center />
            </div>
          )}
          {!k.loading && !items.length && <div className="span-all empty">등록된 개체가 없어요</div>}
          <div className="span-all" style={{ fontSize: 13, color: 'var(--muted)' }}>
            14일 이상 측정하지 않은 개체{' '}
            <span className="mono" style={{ fontWeight: 600, color: 'var(--warn)' }}>
              {items.filter((x) => x.stale).length}
            </span>
            마리
          </div>
          {items.map(({ a, l, stale }) => (
            <div
              key={a.id}
              className="card"
              onClick={() => nav(`/animals/${a.id}/weight`)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{nm(a)}</span>
                  <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--blue)' }}>
                    {a.code}
                  </span>
                  {stale && <span className="tag warn pill">측정 필요</span>}
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {l ? `${yd(l.date)} 측정 · ${gap(l.date, T)}일 전` : '측정 기록 없음'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontWeight: 600, fontSize: 14 }}>
                  {l ? fw(l.g) : '—'}
                </div>
                <div className="mono" style={{ fontWeight: 600, fontSize: 12, color: l && l.diff !== null && l.diff < 0 ? 'var(--warn)' : 'var(--blue)' }}>
                  {l && l.diff !== null ? fd(l.diff) : ''}
                </div>
              </div>
              <button
                type="button"
                aria-label="체중 기록"
                onClick={(e) => {
                  e.stopPropagation()
                  setSheet(a)
                }}
                style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--blue-soft)', color: 'var(--blue)', fontSize: 18, fontWeight: 600, flex: 'none' }}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
      {sheet && <WeightSheet k={k} animal={sheet} onClose={() => setSheet(null)} />}
    </Screen>
  )
}
