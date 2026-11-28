import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Search } from 'lucide-react'
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
    <Screen title="개체" right={{ label: '등록', icon: <Plus size={18} />, onClick: () => nav('/animals/new'), test: 'animal-add' }} wide>
      {k.error ? (
        <ErrorBox error={k.error} />
      ) : (
        <div className="page" style={{ gap: 0 }}>
          <label className="field">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 · ID · 모프 검색" aria-label="개체 검색" data-test="animal-search" />
          </label>
          <Chips
            tabs
            style={{ marginTop: 8 }}
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
          {sps.length > 1 && <Chips small style={{ marginTop: 12 }} items={[['all', '모든 종'] as const, ...sps.map((s) => [s, s] as const)]} value={sp} onChange={setSpF} />}
          <div className="micro" style={{ marginTop: 14 }}>
            {list.length}마리
          </div>
          {k.loading && <Spinner center />}
          <div className="rows cols">
            {list.map((a) => {
              const l = k.lastW(a.id)
              return (
                <button type="button" key={a.id} className="row" data-test="animal-row" onClick={() => nav(`/animals/${a.id}`)}>
                  <AnimalThumb path={a.photo_path} mark={sexMark(a.sex)} size={56} />
                  <span className="grow">
                    <span className="nm">
                      {nm(a)}
                      <span className="code">{a.code}</span>
                    </span>
                    <span className="meta ellipsis">
                      {a.status !== 'keeping' ? STATUS_LABEL[a.status as AnimalStatus] + ' · ' : ''}
                      {spOf(a)} · {sexLbl(a.sex)} · {a.morph || '미정'}
                    </span>
                  </span>
                  <span className="num">
                    <b>{l ? fw(l.g) : '—'}</b>
                    <span className={l && l.diff !== null && l.diff < 0 ? 'warn' : undefined}>{l ? (l.diff === null ? '첫 측정' : fd(l.diff)) : '기록 없음'}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {!k.loading && !list.length && <div className="empty">{k.animals.length ? '조건에 맞는 개체가 없어요' : '아직 등록된 개체가 없어요 · 오른쪽 위 등록을 눌러 주세요'}</div>}
        </div>
      )}
    </Screen>
  )
}
