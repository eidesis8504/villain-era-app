import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useKeeper } from '../data/keeper'
import { nm } from '../lib/format'
import { ErrorBox, PairCard, Spinner } from '../ui/kit'

export function LineagePage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const k = useKeeper()
  const [partner, setPartner] = useState('')
  const a = k.A(id)

  if (k.error) return <Screen title="혈통" back="/lineage"><ErrorBox error={k.error} /></Screen>
  if (k.loading || (k.fetching && !a)) return <Screen title="혈통" back="/lineage"><Spinner center /></Screen>
  if (!a) return <Screen title="혈통" back="/lineage"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const s1 = k.A(a.sire_id)
  const d1 = k.A(a.dam_id)
  const node = (pid: string | null | undefined, role: string, big?: boolean) => {
    const x = k.A(pid)
    return (
      <div
        key={role}
        onClick={() => x && nav(`/animals/${x.id}/lineage`, { replace: true })}
        style={{
          border: `1px ${x ? 'solid' : 'dashed'} ${x ? 'var(--line)' : '#CFCAC0'}`,
          borderRadius: 10,
          padding: big ? '9px 11px' : '7px 8px',
          background: '#fff',
          cursor: x ? 'pointer' : 'default',
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: big ? 11 : 10, color: 'var(--muted)' }}>{role}</div>
        <div className={big ? '' : 'ellipsis'} style={{ fontSize: big ? 14 : 12, fontWeight: 600 }}>
          {x ? nm(x) : pid ? '미등록' : '미상'}
        </div>
        <div className="mono" style={{ fontSize: big ? 11 : 10, color: 'var(--muted)', overflowWrap: 'anywhere' }}>
          {x?.code ?? ''}
        </div>
      </div>
    )
  }
  const opp = a.sex === 'F' ? 'M' : a.sex === 'M' ? 'F' : null
  const parts = k.animals.filter((x) => x.id !== a.id && (!opp || x.sex === opp) && x.sex !== 'U')
  const pid = parts.some((x) => x.id === partner) ? partner : ''
  const pi = pid ? k.lineage.pairInfo(a.sex === 'F' ? pid : a.id, a.sex === 'F' ? a.id : pid, k.coiLimit) : null
  const kids = k.animals.filter((x) => x.sire_id === a.id || x.dam_id === a.id)

  return (
    <Screen title={`혈통 · ${nm(a)}`} back={`/animals/${a.id}`}>
      <div className="page">
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>조부모</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
            {node(s1?.sire_id, '부의 부')}
            {node(s1?.dam_id, '부의 모')}
            {node(d1?.sire_id, '모의 부')}
            {node(d1?.dam_id, '모의 모')}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', paddingTop: 4 }}>부모</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {node(a.sire_id, '부', true)}
            {node(a.dam_id, '모', true)}
          </div>
          <div style={{ background: 'var(--blue)', color: 'var(--cream)', borderRadius: 10, padding: '10px 12px', marginTop: 4 }}>
            <div style={{ fontWeight: 700 }}>{nm(a)}</div>
            <div className="mono" style={{ fontSize: 12 }}>
              {a.code} · 본인 · 근친계수 F {(k.lineage.F(a.id) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="hint">칸을 누르면 그 개체의 혈통으로 이동해요 · 6대까지 추적</div>
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>후손</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {kids.map((x) => (
              <button
                type="button"
                key={x.id}
                className="mono"
                onClick={() => nav(`/animals/${x.id}`)}
                style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue)', background: 'var(--blue-soft)', padding: '5px 9px', borderRadius: 8 }}
              >
                {x.code} {nm(x)}
              </button>
            ))}
          </div>
          {!kids.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>등록된 후손이 없어요</div>}
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            페어링 검사 <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>COI {k.coiLimit}% 초과 시 차단</span>
          </div>
          <select className="input" value={pid} onChange={(e) => setPartner(e.target.value)} disabled={a.sex === 'U'}>
            <option value="">{a.sex === 'U' ? '성별 미구분 개체는 페어링 검사 불가' : '상대 개체 선택'}</option>
            {parts.map((x) => (
              <option key={x.id} value={x.id}>
                {nm(x)} · {x.code}
              </option>
            ))}
          </select>
          {pi && (
            <div style={{ marginTop: 10 }}>
              <PairCard pi={pi} />
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}

export function LineageHubPage() {
  const nav = useNavigate()
  const k = useKeeper()
  const [m, setM] = useState('')
  const [f, setF] = useState('')
  const pi = m && f ? k.lineage.pairInfo(m, f, k.coiLimit) : null

  return (
    <Screen title="혈통 관리" back="/">
      {k.error ? (
        <ErrorBox error={k.error} />
      ) : (
        <div className="page">
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>페어링 검사</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select className="input" style={{ padding: '0 8px', fontSize: 13 }} value={m} onChange={(e) => setM(e.target.value)}>
                <option value="">수컷 선택</option>
                {k.animals
                  .filter((x) => x.sex === 'M')
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {nm(x)} · {x.code}
                    </option>
                  ))}
              </select>
              <select className="input" style={{ padding: '0 8px', fontSize: 13 }} value={f} onChange={(e) => setF(e.target.value)}>
                <option value="">암컷 선택</option>
                {k.animals
                  .filter((x) => x.sex === 'F')
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {nm(x)} · {x.code}
                    </option>
                  ))}
              </select>
            </div>
            {pi && <PairCard pi={pi} big />}
            <div className="hint">차단 기준 COI {k.coiLimit}% 초과 · 전체 › 설정에서 변경 · 산란 등록에도 같은 기준이 적용돼요</div>
          </div>

          <div style={{ fontSize: 15, fontWeight: 700 }}>개체별 근친계수</div>
          {k.loading ? (
            <Spinner center />
          ) : (
            <div className="list-card">
              {k.animals
                .filter((x) => x.status !== 'external')
                .map((x) => {
                  const v = k.lineage.F(x.id) * 100
                  return (
                    <div key={x.id} className="list-row" onClick={() => nav(`/animals/${x.id}/lineage`)} style={{ padding: '11px 0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{nm(x)}</span>{' '}
                        <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--blue)' }}>
                          {x.code}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 2 }}>
                          부모 {[x.sire_id, x.dam_id].filter(Boolean).length}/2 · 조상 {k.lineage.knownAnc(x.id)}/6 등록
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{ fontWeight: 600, fontSize: 14, color: v > k.coiLimit ? 'var(--warn)' : v > 0 ? 'var(--sub)' : 'var(--muted-2)' }}
                      >
                        {v.toFixed(2)}%
                      </span>
                      <span style={{ color: 'var(--muted-2)' }}>›</span>
                    </div>
                  )
                })}
              {!k.animals.length && <div style={{ padding: '18px 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>등록된 개체가 없어요</div>}
            </div>
          )}
        </div>
      )}
    </Screen>
  )
}
