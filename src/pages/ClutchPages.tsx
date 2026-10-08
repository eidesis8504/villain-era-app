import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useKeeper, useRefresh, type Clutch, type Keeper } from '../data/keeper'
import { gap, today, yd } from '../lib/date'
import { nm } from '../lib/format'
import { spInfo, spOf } from '../lib/species'
import { errMsg, supabase } from '../lib/supabase'
import { ErrorBox, PairCard, Sheet, Spinner, Stepper } from '../ui/kit'

function BreederSheet({ k, onClose }: { k: Keeper; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const [f, setF] = useState('')
  const [m, setM] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const fems = k.animals.filter((a) => a.sex === 'F' && a.status === 'keeping' && !k.breeders.some((b) => b.female_id === a.id))
  const males = k.animals.filter((a) => a.sex === 'M' && a.status === 'keeping' && (!f || spOf(a) === spOf(k.A(f))))
  const pi = f && m ? k.lineage.pairInfo(m, f, k.coiLimit) : null
  const bl = !!pi?.blocked

  const save = async () => {
    if (bl) return ui.toast('기준을 넘는 페어라 등록할 수 없어요', 'warn')
    if (!f) return setTried(true)
    setBusy(true)
    const { error } = await supabase.from('breeders').insert({ female_id: f, male_id: m || null })
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '등록하지 못했어요'), 'warn')
    }
    await refresh('breeders')
    ui.toast(`${nm(k.A(f))} 산란 암컷 등록`)
    onClose()
  }

  return (
    <Sheet title="산란 암컷 등록" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">암컷</div>
            <select
              className="input"
              style={{ padding: '0 8px', fontSize: 13 }}
              value={f}
              onChange={(e) => {
                setF(e.target.value)
                if (m && spOf(k.A(m)) !== spOf(k.A(e.target.value))) setM('')
              }}
            >
              <option value="">{fems.length ? '암컷 선택' : '등록 가능한 암컷 없음'}</option>
              {fems.map((a) => (
                <option key={a.id} value={a.id}>
                  {nm(a)} · {a.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label">페어 수컷</div>
            <select className="input" style={{ padding: '0 8px', fontSize: 13 }} value={m} onChange={(e) => setM(e.target.value)}>
              <option value="">나중에 지정</option>
              {males.map((a) => (
                <option key={a.id} value={a.id}>
                  {nm(a)} · {a.code}
                </option>
              ))}
            </select>
          </div>
        </div>
        {pi && <PairCard pi={pi} showCommon={false} />}
        {(bl || (tried && !f)) && <div className="err">{bl ? `근친 페어링 차단 — COI ${pi!.txt}` : '암컷을 선택해 주세요'}</div>}
        <button type="button" className={`btn btn-primary${bl ? ' off' : ''}`} onClick={save} disabled={busy}>
          산란 암컷 등록
        </button>
      </div>
    </Sheet>
  )
}

function ClutchSheet({ k, damId, onClose }: { k: Keeper; damId: string; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const dam = k.A(damId)!
  const spi = spInfo(dam)
  const breeder = k.breeders.find((b) => b.female_id === damId)
  const [date, setDate] = useState(today())
  const [m, setM] = useState(breeder?.male_id ?? '')
  const [eggs, setEggs] = useState(spi.eggsDef)
  const [fert, setFert] = useState(spi.eggsDef)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const n = k.clutches.filter((c) => c.dam_id === damId).reduce((x, c) => Math.max(x, c.seq), 0) + 1
  const males = k.animals.filter((a) => a.sex === 'M' && a.status === 'keeping' && spOf(a) === spOf(dam))
  const pi = m ? k.lineage.pairInfo(m, damId, k.coiLimit) : null
  const bl = !!pi?.blocked
  const fut = date > today()
  const err = bl ? `근친 페어링 차단 — COI ${pi!.txt}가 기준 ${k.coiLimit}%를 넘어요` : fut ? '미래 날짜는 등록할 수 없어요' : tried && !m ? '부(수컷)를 선택해 주세요' : ''

  const save = async () => {
    if (bl) return ui.toast(`차단: ${nm(k.A(m))} × ${nm(dam)} COI ${pi!.txt}`, 'warn')
    if (fut || !m || !date) return setTried(true)
    setBusy(true)
    const { error } = await supabase.from('clutches').insert({ dam_id: damId, sire_id: m, seq: n, laid_on: date, eggs, fertile: fert })
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '산란을 등록하지 못했어요'), 'warn')
    }
    await refresh('clutches')
    ui.toast(`${n}차 산란 등록 · 유정 ${fert}개 인큐 시작`)
    onClose()
  }

  return (
    <Sheet title={`${n}차 산란 등록 · ${nm(dam)}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">산란일</div>
            <input type="date" className="input mono" style={{ padding: '0 10px', fontSize: 14 }} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">부 (수컷)</div>
            <select className="input" style={{ padding: '0 8px', fontSize: 13 }} value={m} onChange={(e) => setM(e.target.value)}>
              <option value="">수컷 선택</option>
              {males.map((a) => (
                <option key={a.id} value={a.id}>
                  {nm(a)} · {a.code}
                </option>
              ))}
            </select>
          </div>
        </div>
        {pi && <PairCard pi={pi} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">알 수</div>
            <Stepper
              value={eggs}
              onDec={() => {
                const e = Math.max(1, eggs - 1)
                setEggs(e)
                setFert(Math.min(fert, e))
              }}
              onInc={() => setEggs(Math.min(spi.eggsMax, eggs + 1))}
            />
          </div>
          <div>
            <div className="label">유정란</div>
            <Stepper value={fert} onDec={() => setFert(Math.max(0, fert - 1))} onInc={() => setFert(Math.min(eggs, fert + 1))} />
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--sub)' }}>
          무정란 <b className="mono">{eggs - fert}</b>개는 폐기로 기록돼요 · 유정란은 인큐 중으로 등록
        </div>
        {err && <div className="err">{err}</div>}
        <button type="button" className={`btn btn-primary${bl || fut ? ' off' : ''}`} onClick={save} disabled={busy}>
          {bl ? '차단됨 — 등록 불가' : `${n}차 산란 등록`}
        </button>
      </div>
    </Sheet>
  )
}

function HatchSheet({ k, clutch, onClose }: { k: Keeper; clutch: Clutch; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const inc = k.incub(clutch)
  const [hatched, setHatched] = useState(inc)
  const [dead, setDead] = useState(0)
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const over = hatched + dead > inc
  const sire = k.A(clutch.sire_id)
  const dam = k.A(clutch.dam_id)

  const save = async () => {
    if (over || hatched + dead === 0) return setTried(true)
    setBusy(true)
    const { data, error } = await supabase.rpc('record_hatch', {
      p_clutch: clutch.id,
      p_hatched: hatched,
      p_dead: dead,
      p_date: date,
      p_note: note,
    })
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '기록하지 못했어요'), 'warn')
    }
    await refresh('animals', 'clutches', 'notifications')
    const ids = (data ?? []).map((x) => x.code)
    ui.toast(ids.length ? `${ids[0]}${ids.length > 1 ? ` 외 ${ids.length - 1}마리` : ''} 자동 등록 · 부모 연결됨` : `폐사 ${dead}개 기록`)
    onClose()
  }

  return (
    <Sheet title={`${clutch.seq}차 부화 · 폐사 기록`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--sub)' }}>
          인큐 중인 알 <b className="mono">{inc}</b>개 · 산란 {yd(clutch.laid_on)} · {gap(clutch.laid_on, today())}일째
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">부화</div>
            <Stepper value={hatched} onDec={() => setHatched(Math.max(0, hatched - 1))} onInc={() => setHatched(Math.min(inc - dead, hatched + 1))} />
          </div>
          <div>
            <div className="label">폐사·실패</div>
            <Stepper warn value={dead} onDec={() => setDead(Math.max(0, dead - 1))} onInc={() => setDead(Math.min(inc - hatched, dead + 1))} />
          </div>
        </div>
        <input type="date" className="input mono" style={{ fontSize: 14 }} value={date} min={clutch.laid_on} max={today()} onChange={(e) => setDate(e.target.value)} />
        {dead > 0 && <input className="input" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="폐사 사유 (예: 곰팡이, 함몰)" />}
        {hatched > 0 && (
          <div style={{ background: 'var(--blue-soft)', borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, color: 'var(--blue)' }}>
            <b>자동 등록 예정</b>
            <br />
            <span className="mono">{hatched}마리 · VE- ID 자동 생성</span>
            <br />부 {nm(sire)} {sire?.code ?? '미상'} · 모 {nm(dam)} {dam?.code} 자동 연결
          </div>
        )}
        {(over || (tried && hatched + dead === 0)) && <div className="err">{over ? '인큐 중인 알보다 많아요' : '부화 또는 폐사 수를 입력해 주세요'}</div>}
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '기록 저장'}
        </button>
      </div>
    </Sheet>
  )
}

export function ClutchPage() {
  const nav = useNavigate()
  const k = useKeeper()
  const [sheet, setSheet] = useState(false)
  const cl = k.clutches

  return (
    <Screen title="산란 관리" back="/" right={{ label: '+ 암컷', onClick: () => setSheet(true) }} wide>
      {k.error ? (
        <ErrorBox error={k.error} />
      ) : (
        <div className="page-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))' }}>
          <div className="card span-all" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: '14px 8px', textAlign: 'center' }}>
            {(
              [
                [cl.length, '산란', ''],
                [cl.reduce((n, c) => n + c.eggs, 0), '총 알', ''],
                [cl.reduce((n, c) => n + k.incub(c), 0), '인큐 중', 'var(--blue)'],
                [cl.reduce((n, c) => n + k.hatched(c).length, 0), '부화', ''],
              ] as const
            ).map(([v, l, col]) => (
              <div key={l}>
                <div className="mono" style={{ fontWeight: 600, fontSize: 20, color: col || undefined }}>
                  {v}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="span-all" style={{ fontSize: 15, fontWeight: 700, paddingTop: 4 }}>
            산란 암컷
          </div>
          {k.loading && (
            <div className="span-all">
              <Spinner center />
            </div>
          )}
          {k.breeders.map((b) => {
            const f = k.A(b.female_id)
            const m = k.A(b.male_id)
            const cs = cl.filter((c) => c.dam_id === b.female_id)
            const inc = cs.reduce((n, c) => n + k.incub(c), 0)
            const last = cs.reduce((x, c) => (c.laid_on > x ? c.laid_on : x), '')
            return (
              <div key={b.female_id} className="card" onClick={() => nav(`/clutch/${b.female_id}`)} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{nm(f)}</span>{' '}
                      <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--blue)' }}>
                        {f?.code}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {f?.morph} · {m ? `× ${nm(m)} ${m.code}` : '페어 미지정'}
                    </div>
                  </div>
                  {inc > 0 && (
                    <span className="tag pill" style={{ flex: 'none' }}>
                      인큐 {inc}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, fontSize: 12, color: 'var(--sub)' }}>
                  <span>
                    <b className="mono">{cs.length}</b>차
                  </span>
                  <span>
                    알 <b className="mono">{cs.reduce((n, c) => n + c.eggs, 0)}</b>
                  </span>
                  <span>
                    부화 <b className="mono">{cs.reduce((n, c) => n + k.hatched(c).length, 0)}</b>
                  </span>
                  <span>
                    폐사{' '}
                    <b className="mono" style={{ color: 'var(--warn)' }}>
                      {cs.reduce((n, c) => n + c.dead, 0)}
                    </b>
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>
                  {last ? yd(last) + ' 최근 산란' : '산란 기록 없음'} · 후손 {k.animals.filter((x) => x.dam_id === b.female_id).length}마리
                </div>
              </div>
            )
          })}
          {!k.loading && !k.breeders.length && (
            <div className="span-all" style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              등록된 산란 암컷이 없어요 · 우측 상단 + 암컷
            </div>
          )}
        </div>
      )}
      {sheet && <BreederSheet k={k} onClose={() => setSheet(false)} />}
    </Screen>
  )
}

export function ClutchFemalePage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const k = useKeeper()
  const [sheet, setSheet] = useState<null | { type: 'clutch' } | { type: 'hatch'; clutch: Clutch }>(null)
  const f = k.A(id)

  if (k.error) return <Screen title="산란" back="/clutch"><ErrorBox error={k.error} /></Screen>
  if (k.loading || (k.fetching && !f)) return <Screen title="산란" back="/clutch"><Spinner center /></Screen>
  if (!f) return <Screen title="산란" back="/clutch"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const T = today()
  const b = k.breeders.find((x) => x.female_id === id)
  const m = k.A(b?.male_id)
  const cs = k.clutches.filter((c) => c.dam_id === id).sort((x, y) => y.seq - x.seq)
  const pi = m ? k.lineage.pairInfo(m.id, id, k.coiLimit) : null
  const desc = [...k.lineage.desc(id)].map((x) => k.A(x)!).filter(Boolean)
  desc.sort((x, y) => ((x.hatch_date ?? '') < (y.hatch_date ?? '') ? 1 : -1))
  const sum = (fn: (c: Clutch) => number) => cs.reduce((n, c) => n + fn(c), 0)

  return (
    <Screen title={`산란 · ${nm(f)}`} back="/clutch">
      <div className="page" style={{ gap: 12 }}>
        <div style={{ background: 'var(--blue)', color: 'var(--cream)', borderRadius: 18, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{nm(f)}</span>
            <span className="mono" style={{ fontWeight: 500, fontSize: 13 }}>
              {f.code}
            </span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{f.morph}</div>
          <div style={{ fontSize: 13, marginTop: 10 }}>
            페어 {m ? `${nm(m)} ${m.code}` : '미지정'} · <span className="mono">COI {pi ? pi.txt : '—'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, textAlign: 'center', marginTop: 14, background: 'rgba(250,249,246,.12)', borderRadius: 12, padding: '10px 4px' }}>
            {(
              [
                [sum((c) => c.eggs), '총 알'],
                [sum((c) => c.fertile), '유정'],
                [sum((c) => k.hatched(c).length), '부화'],
                [sum((c) => c.dead), '폐사'],
              ] as const
            ).map(([v, l]) => (
              <div key={l}>
                <div className="mono" style={{ fontWeight: 600, fontSize: 18 }}>
                  {v}
                </div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-primary" style={{ height: 48 }} onClick={() => setSheet({ type: 'clutch' })}>
          + {(cs[0]?.seq ?? 0) + 1}차 산란 등록
        </button>

        {cs.map((c) => {
          const inc = k.incub(c)
          const kids = k.hatched(c)
          return (
            <div key={c.id} className="card" style={{ borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="ellipsis" style={{ minWidth: 0 }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 17, color: 'var(--blue)' }}>
                    {c.seq}차
                  </span>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {' '}
                    {yd(c.laid_on)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}> × {nm(k.A(c.sire_id))}</span>
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: inc ? 'var(--blue-soft)' : c.dead ? 'var(--warn-soft)' : 'var(--seg)',
                    color: inc ? 'var(--blue)' : c.dead ? 'var(--warn)' : 'var(--sub)',
                  }}
                >
                  {inc ? `인큐 중 ${inc}` : '완료'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--sub)' }}>
                알 {c.eggs} · 유정 {c.fertile} · 무정 {c.eggs - c.fertile} · 폐사 {c.dead}
                {inc > 0 && <span style={{ color: 'var(--blue)', fontWeight: 600 }}> · 인큐 {gap(c.laid_on, T)}일째</span>}
              </div>
              {c.dead > 0 && (
                <div style={{ fontSize: 12, color: 'var(--warn)' }}>
                  폐사 {c.dead}개{c.dead_note ? ' · ' + c.dead_note : ''}
                </div>
              )}
              {kids.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {kids.map((x) => (
                    <button
                      type="button"
                      key={x.id}
                      className="mono"
                      onClick={() => nav(`/animals/${x.id}`)}
                      style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue)', background: 'var(--blue-soft)', padding: '3px 8px', borderRadius: 6 }}
                    >
                      {x.code}
                    </button>
                  ))}
                </div>
              )}
              {inc > 0 && (
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setSheet({ type: 'hatch', clutch: c })}>
                  부화 · 폐사 기록
                </button>
              )}
            </div>
          )
        })}

        <div style={{ fontSize: 15, fontWeight: 700, paddingTop: 6 }}>
          후손{' '}
          <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>
            {desc.length}마리
          </span>
        </div>
        <div className="list-card">
          {desc.map((x) => (
            <div key={x.id} className="list-row" onClick={() => nav(`/animals/${x.id}`)} style={{ padding: '11px 0' }}>
              <span className="tag">{x.dam_id === id ? '자' : '손'}</span>
              <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: 'var(--blue)' }}>
                {x.code}
              </span>
              <span style={{ fontSize: 14, flex: 1 }}>{nm(x)}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted-2)' }}>
                {yd(x.hatch_date)}
              </span>
            </div>
          ))}
          {!desc.length && <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>아직 후손이 없어요</div>}
        </div>
      </div>
      {sheet?.type === 'clutch' && <ClutchSheet k={k} damId={id} onClose={() => setSheet(null)} />}
      {sheet?.type === 'hatch' && <HatchSheet k={k} clutch={sheet.clutch} onClose={() => setSheet(null)} />}
    </Screen>
  )
}
