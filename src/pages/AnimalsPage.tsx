import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Screen } from '../app/Screen'
import { useKeeper } from '../data/keeper'
import { fd, fw, nm, sexLbl, sexMark, STATUS_LABEL, type AnimalStatus } from '../lib/format'
import { SPECIES_NAMES, spOf } from '../lib/species'
import { Chips, ErrorBox, Spinner } from '../ui/kit'
import { AnimalThumb } from './shared'

type Filter = 'all' | 'F' | 'M' | 'U' | 'out'

export default function AnimalsPage() {
  const nav = useNavigate()
  const k = useKeeper()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [spF, setSpF] = useState('all')

  const sps = SPECIES_NAMES.filter((s) => k.animals.some((a) => spOf(a) === s))
  const sp = sps.includes(spF) ? spF : 'all'
  const qq = q.trim().toLowerCase()
  const list = k.animals
    .filter((a) => (filter === 'out' ? a.status !== 'keeping' : a.status === 'keeping' && (filter === 'all' || a.sex === filter)))
    .filter((a) => sp === 'all' || spOf(a) === sp)
    .filter((a) => !qq || `${a.code} ${a.name} ${a.morph} ${spOf(a)}`.toLowerCase().includes(qq))

  return (
    <Screen title="개체 관리" right={{ label: '+ 등록', onClick: () => nav('/animals/new'), test: 'animal-add' }} wide>
      {k.error ? (
        <ErrorBox error={k.error} />
      ) : (
        <div className="page-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))' }}>
          <input
            className="input span-all"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름 · ID · 모프 검색"
            style={{ fontSize: 15 }}
          />
          <Chips
            style={{ gridColumn: '1 / -1' }}
            items={[
              ['all', '전체'],
              ['F', '암컷'],
              ['M', '수컷'],
              ['U', '미구분'],
              ['out', '분양·외부'],
            ]}
            value={filter}
            onChange={setFilter}
          />
          {sps.length > 1 && (
            <Chips
              style={{ gridColumn: '1 / -1' }}
              items={[['all', '모든 종'] as const, ...sps.map((s) => [s, s] as const)]}
              value={sp}
              onChange={setSpF}
            />
          )}
          <div className="span-all mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>
            {list.length}마리
          </div>
          {k.loading && (
            <div className="span-all">
              <Spinner center />
            </div>
          )}
          {list.map((a) => {
            const l = k.lastW(a.id)
            return (
              <div
                key={a.id}
                className="card"
                onClick={() => nav(`/animals/${a.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
              >
                <AnimalThumb path={a.photo_path} mark={sexMark(a.sex)} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{nm(a)}</span>
                    <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--blue)' }}>
                      {a.code}
                    </span>
                  </div>
                  <div className="ellipsis" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {a.status !== 'keeping' ? STATUS_LABEL[a.status as AnimalStatus] + ' · ' : ''}
                    {spOf(a)} · {sexLbl(a.sex)} · {a.morph || '미정'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div className="mono" style={{ fontWeight: 600, fontSize: 14 }}>
                    {l ? fw(l.g) : '—'}
                  </div>
                  <div className="mono" style={{ fontWeight: 600, fontSize: 12, color: l && l.diff !== null && l.diff < 0 ? 'var(--warn)' : 'var(--blue)' }}>
                    {l ? (l.diff === null ? '첫 측정' : fd(l.diff)) : '기록 없음'}
                  </div>
                </div>
              </div>
            )
          })}
          {!k.loading && !list.length && (
            <div className="span-all empty">
              {k.animals.length ? '조건에 맞는 개체가 없어요' : '아직 등록된 개체가 없어요 · 우측 상단 + 등록'}
            </div>
          )}
        </div>
      )}
    </Screen>
  )
}
