// 증상 기록·진료 기록 시트
import { useState } from 'react'
import { useMe } from '../app/auth'
import { useUI } from '../app/ui'
import { useHealthPhotoUrls } from '../data/health'
import { useRefresh, type Animal } from '../data/keeper'
import { addD, today, yd } from '../lib/date'
import { nm } from '../lib/format'
import { HEALTH_AREAS, HEALTH_NOTICE, LEVEL_LABEL, MAX_HEALTH_PHOTOS, type HealthArea, type HealthLog, type VetVisit } from '../lib/health'
import { removeFiles, resizeImage, upload } from '../lib/media'
import { errMsg, supabase } from '../lib/supabase'
import { Chips, Seg, Sheet } from '../ui/kit'

type Draft = { path: string } | { blob: Blob; url: string }

export function SymptomSheet({ animal, edit, onClose }: { animal: Animal; edit?: HealthLog | null; onClose: () => void }) {
  const { uid } = useMe()
  const ui = useUI()
  const refresh = useRefresh()
  const [date, setDate] = useState(edit?.logged_on ?? today())
  const [area, setArea] = useState<HealthArea | ''>(edit?.area ?? '')
  const [level, setLevel] = useState<1 | 2 | 3>(edit?.level ?? 1)
  const [note, setNote] = useState(edit?.note ?? '')
  const [photos, setPhotos] = useState<Draft[]>((edit?.photos ?? []).map((path) => ({ path })))
  const [busy, setBusy] = useState(false)
  const [cfmDel, setCfmDel] = useState(false)
  const [tried, setTried] = useState(false)
  const urls = useHealthPhotoUrls(edit?.photos ?? []).data ?? {}

  const addPhotos = async (files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, MAX_HEALTH_PHOTOS - photos.length)
    for (const f of list) {
      try {
        const blob = await resizeImage(f, 1280)
        setPhotos((s) => (s.length < MAX_HEALTH_PHOTOS ? [...s, { blob, url: URL.createObjectURL(blob) }] : s))
      } catch (e) {
        ui.toast(errMsg(e, '사진을 읽을 수 없어요'), 'warn')
      }
    }
  }

  const save = async () => {
    if (!area) return setTried(true)
    if (busy) return
    setBusy(true)
    const uploaded: string[] = []
    try {
      const paths: string[] = []
      for (const p of photos) {
        if ('path' in p) paths.push(p.path)
        else {
          const path = await upload('health-photos', uid, p.blob, 'jpg')
          uploaded.push(path)
          paths.push(path)
        }
      }
      const rec = { logged_on: date, area, level, note: note.trim().slice(0, 300), photos: paths }
      const { error } = edit
        ? await supabase.from('health_logs').update(rec).eq('id', edit.id)
        : await supabase.from('health_logs').insert({ ...rec, animal_id: animal.id })
      if (error) throw error
      if (edit) await removeFiles('health-photos', edit.photos.filter((x) => !paths.includes(x)))
      await refresh('health_logs')
      ui.toast(edit ? '증상 기록을 수정했어요' : `증상 기록 · ${area} ${LEVEL_LABEL[level]}`)
      onClose()
    } catch (e) {
      await removeFiles('health-photos', uploaded)
      setBusy(false)
      ui.toast(errMsg(e, '증상을 저장하지 못했어요'), 'warn')
    }
  }

  const resolve = async () => {
    if (!edit) return
    setBusy(true)
    const { error } = await supabase.from('health_logs').update({ resolved_on: edit.resolved_on ? null : today() }).eq('id', edit.id)
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '저장하지 못했어요'), 'warn')
    await refresh('health_logs')
    ui.toast(edit.resolved_on ? '진행 중으로 되돌렸어요' : '해결로 표시했어요')
    onClose()
  }

  const del = async () => {
    if (!edit) return
    if (!cfmDel) return setCfmDel(true)
    setBusy(true)
    const { error } = await supabase.from('health_logs').delete().eq('id', edit.id)
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '삭제하지 못했어요'), 'warn')
    }
    await removeFiles('health-photos', edit.photos)
    await refresh('health_logs')
    ui.toast('증상 기록을 삭제했어요')
    onClose()
  }

  return (
    <Sheet title={`${edit ? '증상 수정' : '증상 기록'} · ${nm(animal)}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="label">부위 <span className="req">*</span></div>
          <Chips wrap items={HEALTH_AREAS.map((a) => [a, a] as const)} value={area as HealthArea} onChange={setArea} />
          {tried && !area && <div className="err" style={{ marginTop: 6 }}>부위를 골라 주세요</div>}
        </div>
        <div>
          <div className="label">정도</div>
          <Seg height={40} items={([1, 2, 3] as const).map((n) => [n, LEVEL_LABEL[n]] as const)} value={level} onChange={setLevel} />
        </div>
        <div>
          <div className="label">사진 · 최대 {MAX_HEALTH_PHOTOS}장 · 나만 볼 수 있어요</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', background: 'var(--seg)' }}>
                <img src={'path' in p ? urls[p.path] : p.url} alt="" className="cover" />
                <button
                  type="button"
                  aria-label="사진 빼기"
                  onClick={() => setPhotos((s) => s.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 10, background: 'rgba(22,24,29,.7)', color: '#fff', fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < MAX_HEALTH_PHOTOS && (
              <label className="btn btn-plain" style={{ width: 72, height: 72, fontSize: 22, cursor: 'pointer' }}>
                +
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => (addPhotos(e.target.files), (e.target.value = ''))} />
              </label>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div>
            <div className="label">날짜</div>
            <input type="date" className="input mono" value={date} min={addD(today(), -365)} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">메모 · 선택 · {note.length}/300</div>
            <textarea
              className="input"
              style={{ height: 80, fontSize: 15, lineHeight: 1.5, padding: 10 }}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="예: 오른쪽 뒷다리에 딱지, 식욕은 보통"
            />
          </div>
        </div>
        <div className="hint">{HEALTH_NOTICE}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {edit && (
            <button type="button" className="btn btn-outline" style={{ flex: 'none', padding: '0 14px', fontSize: 14 }} onClick={resolve} disabled={busy}>
              {edit.resolved_on ? '진행 중으로' : '해결'}
            </button>
          )}
          {edit && (
            <button type="button" className={`btn btn-danger${cfmDel ? ' on' : ''}`} style={{ flex: 'none', padding: '0 14px', fontSize: 14 }} onClick={del} disabled={busy}>
              {cfmDel ? '한 번 더' : '삭제'}
            </button>
          )}
          <button type="button" data-test="symptom-save" className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>
            {busy ? '저장 중…' : edit ? '수정 저장' : '저장'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export function VetSheet({ animal, edit, onClose }: { animal: Animal; edit?: VetVisit | null; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const [date, setDate] = useState(edit?.visited_on ?? today())
  const [clinic, setClinic] = useState(edit?.clinic ?? '')
  const [diagnosis, setDiagnosis] = useState(edit?.diagnosis ?? '')
  const [treatment, setTreatment] = useState(edit?.treatment ?? '')
  const [cost, setCost] = useState(edit?.cost != null ? String(edit.cost) : '')
  const [next, setNext] = useState(edit?.next_visit ?? '')
  const [busy, setBusy] = useState(false)
  const [cfmDel, setCfmDel] = useState(false)
  const costN = cost.trim() ? Number(cost.replace(/[^0-9]/g, '')) : null

  const save = async () => {
    if (busy) return
    if (next && next < date) return ui.toast('재진일은 진료일 이후로 골라 주세요', 'warn')
    setBusy(true)
    const rec = {
      visited_on: date,
      clinic: clinic.trim().slice(0, 40),
      diagnosis: diagnosis.trim().slice(0, 200),
      treatment: treatment.trim().slice(0, 200),
      cost: costN,
      next_visit: next || null,
    }
    const { error } = edit
      ? await supabase.from('vet_visits').update(rec).eq('id', edit.id)
      : await supabase.from('vet_visits').insert({ ...rec, animal_id: animal.id })
    setBusy(false)
    if (error) return ui.toast(errMsg(error, '진료 기록을 저장하지 못했어요'), 'warn')
    await refresh('vet_visits')
    ui.toast(edit ? '진료 기록을 수정했어요' : `진료 기록${next ? ` · 재진 ${yd(next)} 하루 전에 알려 드려요` : ''}`)
    onClose()
  }

  const del = async () => {
    if (!edit) return
    if (!cfmDel) return setCfmDel(true)
    setBusy(true)
    const { error } = await supabase.from('vet_visits').delete().eq('id', edit.id)
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '삭제하지 못했어요'), 'warn')
    }
    await refresh('vet_visits')
    ui.toast('진료 기록을 삭제했어요')
    onClose()
  }

  return (
    <Sheet title={`${edit ? '진료 수정' : '진료 기록'} · ${nm(animal)}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">진료일</div>
            <input type="date" className="input mono" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">재진일 · 선택</div>
            <input type="date" className="input mono" value={next} min={date} onChange={(e) => setNext(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="label">병원</div>
          <input className="input" value={clinic} maxLength={40} onChange={(e) => setClinic(e.target.value)} placeholder="예: OO 특수동물병원" />
        </div>
        <div>
          <div className="label">진단</div>
          <input className="input" value={diagnosis} maxLength={200} onChange={(e) => setDiagnosis(e.target.value)} placeholder="병원에서 들은 내용" />
        </div>
        <div>
          <div className="label">처치·투약</div>
          <input className="input" value={treatment} maxLength={200} onChange={(e) => setTreatment(e.target.value)} placeholder="예: 연고 하루 2번 7일" />
        </div>
        <div>
          <div className="label">비용 · 선택 · 원</div>
          <input className="input mono" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {edit && (
            <button type="button" className={`btn btn-danger${cfmDel ? ' on' : ''}`} style={{ flex: 'none', padding: '0 14px', fontSize: 14 }} onClick={del} disabled={busy}>
              {cfmDel ? '한 번 더' : '삭제'}
            </button>
          )}
          <button type="button" data-test="vet-save" className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>
            {busy ? '저장 중…' : edit ? '수정 저장' : '저장'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
