// 번식 사이클 시트: 메이팅 기록, 그라비드 체크, 알 상태 기록
import { useState } from 'react'
import { useMe } from '../app/auth'
import { useUI } from '../app/ui'
import { useRefresh, type Animal, type Breeder, type Clutch, type Keeper } from '../data/keeper'
import { EGG_STATUS_LABEL, EGG_STATUSES, layExpected, type EggStatus } from '../lib/breeding'
import { addD, today, yd } from '../lib/date'
import { nm } from '../lib/format'
import { resizeImage, upload } from '../lib/media'
import { spOf } from '../lib/species'
import { errMsg, supabase } from '../lib/supabase'
import { Chips, PairCard, Sheet, Stepper, Toggle } from '../ui/kit'

export function MatingSheet({ k, female, onClose }: { k: Keeper; female: Animal; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const breeder = k.breeders.find((b) => b.female_id === female.id)
  const [m, setM] = useState(breeder?.male_id ?? '')
  const [date, setDate] = useState(today())
  const [locked, setLocked] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const males = k.animals.filter((a) => a.sex === 'M' && a.status === 'keeping' && spOf(a) === spOf(female))
  const pi = m ? k.lineage.pairInfo(m, female.id, k.coiLimit) : null
  const bl = !!pi?.blocked

  const save = async () => {
    if (bl) return ui.toast(`차단: COI ${pi!.txt}가 기준 ${k.coiLimit}%를 넘어요`, 'warn')
    if (busy) return
    setBusy(true)
    const { error } = await supabase
      .from('matings')
      .insert({ female_id: female.id, male_id: m || null, paired_on: date, locked, note: note.trim().slice(0, 100) })
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '메이팅을 기록하지 못했어요'), 'warn')
    await refresh('matings')
    ui.toast(`메이팅 기록 · ${m ? nm(k.A(m)) : '수컷 미상'} × ${nm(female)}`)
    onClose()
  }

  return (
    <Sheet title={`메이팅 기록 · ${nm(female)}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">날짜</div>
            <input type="date" className="input mono" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">수컷</div>
            <select className="input" style={{ padding: '0 8px', fontSize: 13 }} value={m} onChange={(e) => setM(e.target.value)}>
              <option value="">미상</option>
              {males.map((a) => (
                <option key={a.id} value={a.id}>
                  {nm(a)} · {a.code}
                </option>
              ))}
            </select>
          </div>
        </div>
        {pi && <PairCard pi={pi} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>락(교미) 확인</span>
          <Toggle label="락 확인" on={locked} onClick={() => setLocked(!locked)} />
        </div>
        <input className="input" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="메모 · 선택" />
        <button type="button" data-test="mating-save" className={`btn btn-primary${bl ? ' off' : ''}`} onClick={save} disabled={busy}>
          {bl ? '차단됨 — 기록 불가' : '메이팅 기록'}
        </button>
      </div>
    </Sheet>
  )
}

export function GravidSheet({ female, breeder, onClose }: { female: Animal; breeder: Breeder; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const [date, setDate] = useState(breeder.gravid_on ?? today())
  const [lay, setLay] = useState(breeder.lay_expected_on ?? layExpected(female.species, breeder.gravid_on ?? today()))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const onDate = (d: string) => {
    setDate(d)
    if (!touched) setLay(layExpected(female.species, d))
  }

  const save = async (clear = false) => {
    setBusy(true)
    const { error } = await supabase
      .from('breeders')
      .update(clear ? { gravid_on: null, lay_expected_on: null } : { gravid_on: date, lay_expected_on: lay || null })
      .eq('female_id', female.id)
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '저장하지 못했어요'), 'warn')
    await refresh('breeders')
    ui.toast(clear ? '그라비드 표시를 지웠어요' : `그라비드 확인 · 산란 예정 ${yd(lay)} (3일 전에 알려 드려요)`)
    onClose()
  }

  return (
    <Sheet title={`그라비드 체크 · ${nm(female)}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hint" style={{ fontSize: 13 }}>
          배 쪽으로 알이 비쳐 보이면 기록해 주세요. 산란 예정일은 종별 기본값으로 계산하고, 직접 고칠 수 있어요. (감수 전 기본값)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">확인한 날</div>
            <input type="date" className="input mono" value={date} max={today()} onChange={(e) => onDate(e.target.value)} />
          </div>
          <div>
            <div className="label">산란 예정일</div>
            <input
              type="date"
              className="input mono"
              value={lay}
              min={date}
              max={addD(date, 120)}
              onChange={(e) => (setTouched(true), setLay(e.target.value))}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {breeder.gravid_on && (
            <button type="button" className="btn btn-plain" style={{ flex: 'none', padding: '0 14px' }} onClick={() => save(true)} disabled={busy}>
              지우기
            </button>
          )}
          <button type="button" data-test="gravid-save" className="btn btn-primary" style={{ flex: 1 }} onClick={() => save()} disabled={busy}>
            저장
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export function EggCheckSheet({ clutch, onClose }: { clutch: Clutch; onClose: () => void }) {
  const { uid } = useMe()
  const ui = useUI()
  const refresh = useRefresh()
  const [status, setStatus] = useState<EggStatus>('normal')
  const [count, setCount] = useState(1)
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const max = Math.max(1, clutch.fertile)

  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      const photo_path = photo ? await upload('animal-photos', uid, photo.blob, 'jpg') : null
      const { error } = await supabase
        .from('egg_checks')
        .insert({ clutch_id: clutch.id, checked_on: date, status, count, note: note.trim().slice(0, 100), photo_path })
      if (error) throw error
      await refresh('egg_checks')
      ui.toast(`${clutch.seq}차 알 ${EGG_STATUS_LABEL[status]} ${count}개 기록`)
      onClose()
    } catch (e) {
      setBusy(false)
      ui.toast(errMsg(e, '알 상태를 기록하지 못했어요'), 'warn')
    }
  }

  return (
    <Sheet title={`${clutch.seq}차 알 상태`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Chips wrap items={EGG_STATUSES.map((s) => [s, EGG_STATUS_LABEL[s]] as const)} value={status} onChange={setStatus} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">개수</div>
            <Stepper value={count} onDec={() => setCount(Math.max(1, count - 1))} onInc={() => setCount(Math.min(max, count + 1))} />
          </div>
          <div>
            <div className="label">날짜</div>
            <input type="date" className="input mono" value={date} min={clutch.laid_on} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <input className="input" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="메모 · 선택 (예: 곰팡이 닦음)" />
        <label className="btn btn-plain" style={{ cursor: 'pointer' }}>
          {photo ? '사진 바꾸기' : '+ 사진 · 선택'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const blob = await resizeImage(f, 1280)
                setPhoto({ blob, url: URL.createObjectURL(blob) })
              } catch (err) {
                ui.toast(errMsg(err, '사진을 읽을 수 없어요'), 'warn')
              }
            }}
          />
        </label>
        {photo && <img src={photo.url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10 }} />}
        <button type="button" data-test="egg-save" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '기록'}
        </button>
      </div>
    </Sheet>
  )
}
