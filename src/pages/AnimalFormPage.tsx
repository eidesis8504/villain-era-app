import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMe } from '../app/auth'
import { Screen, useBack } from '../app/Screen'
import { useUI } from '../app/ui'
import { newAnimalCode, useKeeper, useRefresh, type Animal, type Keeper } from '../data/keeper'
import { today } from '../lib/date'
import { nm, STATUS_LABEL, type AnimalStatus } from '../lib/format'
import { removeFiles, resizeImage, upload } from '../lib/media'
import { DEFAULT_SPECIES, SPECIES, SPECIES_NAMES, spOf } from '../lib/species'
import { errMsg, publicUrl, supabase } from '../lib/supabase'
import { Chips, ErrorBox, Seg, Spinner } from '../ui/kit'

type Form = {
  code: string
  species: string
  name: string
  sex: string
  morph: string
  hatch: string
  sire: string
  dam: string
  status: AnimalStatus
  photo: { blob: Blob; url: string } | null
  photoPath: string | null
}

const LAST_SP = 've-last-species'

function initialForm(k: Keeper, editing: Animal | null): Form {
  if (editing) {
    return {
      code: editing.code,
      species: spOf(editing),
      name: editing.name,
      sex: editing.sex,
      morph: editing.morph,
      hatch: editing.hatch_date ?? '',
      sire: editing.sire_id ?? '',
      dam: editing.dam_id ?? '',
      status: editing.status as AnimalStatus,
      photo: null,
      photoPath: editing.photo_path,
    }
  }
  let sp = DEFAULT_SPECIES
  try {
    sp = localStorage.getItem(LAST_SP) || DEFAULT_SPECIES
  } catch {
    /* 저장소를 못 쓰는 브라우저 */
  }
  return {
    code: newAnimalCode(new Set(k.animals.map((a) => a.code))),
    species: SPECIES[sp] ? sp : DEFAULT_SPECIES,
    name: '',
    sex: 'U',
    morph: '',
    hatch: today(),
    sire: '',
    dam: '',
    status: 'keeping',
    photo: null,
    photoPath: null,
  }
}

export default function AnimalFormPage() {
  const { id } = useParams()
  const k = useKeeper()
  const editing = id ? k.A(id) : null
  const title = id ? '개체 정보 수정' : '개체 등록'
  if (k.error) return <Screen title={title} back="/animals"><ErrorBox error={k.error} /></Screen>
  if (k.loading) return <Screen title={title} back="/animals"><Spinner center /></Screen>
  if (id && !editing) return <Screen title={title} back="/animals"><div className="empty">개체를 찾을 수 없어요</div></Screen>
  // 데이터가 준비된 뒤에 폼을 만든다 (수정 화면은 기존 값으로 시작)
  return <AnimalForm key={id ?? 'new'} k={k} editing={editing} />
}

function AnimalForm({ k, editing }: { k: Keeper; editing: Animal | null }) {
  const id = editing?.id
  const nav = useNavigate()
  const goBack = useBack(id ? `/animals/${id}` : '/animals')
  const ui = useUI()
  const refresh = useRefresh()
  const { uid } = useMe()
  const [f, setF] = useState<Form>(() => initialForm(k, editing))
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  const excluded = useMemo(() => {
    const ex = id ? k.lineage.desc(id) : new Set<string>()
    if (id) ex.add(id)
    return ex
  }, [id, k.lineage])

  const set = (p: Partial<Form>) => setF((s) => ({ ...s, ...p }))
  const spi = SPECIES[f.species] ?? SPECIES[DEFAULT_SPECIES]
  const spLock =
    !!editing &&
    (!!editing.sire_id ||
      !!editing.dam_id ||
      k.animals.some((x) => x.sire_id === editing.id || x.dam_id === editing.id) ||
      k.breeders.some((b) => b.female_id === editing.id || b.male_id === editing.id) ||
      k.clutches.some((c) => c.dam_id === editing.id || c.sire_id === editing.id))
  const pickSp = (s: string) => {
    if (s === f.species) return
    const keep = (pid: string) => (pid && spOf(k.A(pid)) === s ? pid : '')
    const allMorphs = Object.values(SPECIES).flatMap((x) => x.morphs)
    set({ species: s, sire: keep(f.sire), dam: keep(f.dam), morph: allMorphs.includes(f.morph) ? '' : f.morph })
  }
  const parentOpts = (sex: 'M' | 'F') =>
    k.animals.filter((a) => a.sex === sex && !excluded.has(a.id) && spOf(a) === f.species)
  const pi = f.sire && f.dam ? k.lineage.pairInfo(f.sire, f.dam, k.coiLimit) : null
  const photoUrl = f.photo?.url ?? (f.photoPath ? publicUrl('animal-photos', f.photoPath) : '')

  const pickPhoto = async (file?: File) => {
    if (!file) return
    setPhotoBusy(true)
    try {
      const blob = await resizeImage(file, 640, 0.72)
      set({ photo: { blob, url: URL.createObjectURL(blob) } })
    } catch (e) {
      ui.toast(errMsg(e, '사진을 읽지 못했어요'), 'warn')
    } finally {
      setPhotoBusy(false)
    }
  }

  const save = async () => {
    if (!f.hatch) {
      setTried(true)
      return ui.toast('필수 항목을 확인해 주세요', 'warn')
    }
    setBusy(true)
    let newPath = f.photoPath
    try {
      if (f.photo) newPath = await upload('animal-photos', uid, f.photo.blob, 'jpg')
      const rec = {
        species: f.species,
        name: f.name.trim(),
        sex: f.sex,
        morph: f.morph.trim() || spi.morphDef,
        hatch_date: f.hatch,
        sire_id: f.sire || null,
        dam_id: f.dam || null,
        photo_path: newPath,
      }
      if (editing) {
        const { error } = await supabase.from('animals').update({ ...rec, status: f.status }).eq('id', editing.id)
        if (error) throw error
        if (editing.photo_path && editing.photo_path !== newPath) await removeFiles('animal-photos', [editing.photo_path])
        await refresh('animals')
        ui.toast('개체 정보를 수정했어요')
        goBack()
      } else {
        const { data, error } = await supabase
          .from('animals')
          .insert({ ...rec, code: f.code, status: 'keeping' })
          .select('id')
          .single()
        if (error) {
          if (error.code === '23505') {
            set({ code: newAnimalCode(new Set(k.animals.map((a) => a.code).concat(f.code))) })
            throw new Error('이미 쓰이는 ID라 새 ID를 만들었어요 — 다시 저장해 주세요')
          }
          throw error
        }
        try {
          localStorage.setItem(LAST_SP, f.species)
        } catch {
          /* ignore */
        }
        await refresh('animals')
        ui.toast(`${f.code} 등록 완료`)
        nav(`/animals/${data.id}`, { replace: true })
      }
    } catch (e) {
      if (f.photo && newPath && newPath !== f.photoPath) await removeFiles('animal-photos', [newPath])
      ui.toast(errMsg(e, '저장하지 못했어요'), 'warn')
      setBusy(false)
    }
  }

  return (
    <Screen title={editing ? '개체 정보 수정' : '개체 등록'} back={id ? `/animals/${id}` : '/animals'}>
      <div style={{ padding: '8px 18px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="label">
            개체 ID <span className="req">*</span>
          </div>
          {editing ? (
            <div className="input locked mono" style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
              {f.code}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                data-test="animal-id"
                className="input mono ellipsis"
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', fontWeight: 600, letterSpacing: '.03em', border: '1.5px solid var(--input)' }}
              >
                {f.code}
              </div>
              <button
                type="button"
                data-test="animal-id-regen"
                className="btn btn-outline"
                style={{ height: 46, padding: '0 14px', fontSize: 14, flex: 'none' }}
                onClick={() => set({ code: newAnimalCode(new Set(k.animals.map((a) => a.code).concat(f.code))) })}
              >
                새로 생성
              </button>
            </div>
          )}
          <div className="hint" style={{ marginTop: 6 }}>
            {editing ? '등록된 ID는 혈통 연결 때문에 바꿀 수 없어요' : '영문 대문자·숫자 10자리로 자동 생성돼요 · 등록 후에는 바꿀 수 없어요'}
          </div>
        </div>

        <div>
          <div className="label">
            종 <span className="req">*</span>
          </div>
          {spLock ? (
            <>
              <div className="input locked" style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                {f.species}
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                혈통·산란 기록이 연결된 개체는 종을 바꿀 수 없어요
              </div>
            </>
          ) : (
            <Seg testId="animal-species" height={38} items={SPECIES_NAMES.map((s) => [s, s] as const)} value={f.species} onChange={pickSp} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <label
            className="ph-stripes"
            style={{ position: 'relative', width: 88, height: 88, borderRadius: 16, flex: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            {photoUrl ? <img src={photoUrl} alt="" /> : <span>+ 사진</span>}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                pickPhoto(e.target.files?.[0])
                e.target.value = ''
              }}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
          </label>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="label" style={{ marginBottom: 0 }}>
              대표 사진
            </div>
            <div className="hint">{photoBusy ? '사진을 줄이는 중…' : '촬영 또는 앨범에서 선택 · 640px로 줄여 저장해요'}</div>
            {photoUrl && (
              <button
                type="button"
                onClick={() => set({ photo: null, photoPath: null })}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', alignSelf: 'flex-start', padding: '4px 0' }}
              >
                사진 삭제
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="label">이름</div>
          <input className="input" value={f.name} maxLength={30} onChange={(e) => set({ name: e.target.value })} placeholder="비워두면 '이름 없음'" />
        </div>

        <div>
          <div className="label">성별</div>
          <Seg
            items={[
              ['F', '암컷'],
              ['M', '수컷'],
              ['U', '미구분'],
            ]}
            value={f.sex}
            onChange={(sex) => set({ sex })}
          />
        </div>

        <div>
          <div className="label">{spi.morphLbl}</div>
          <input className="input" value={f.morph} maxLength={60} onChange={(e) => set({ morph: e.target.value })} placeholder={spi.morphPh} />
          <Chips wrap small style={{ marginTop: 8 }} items={spi.morphs.map((m) => [m, m] as const)} value={f.morph} onChange={(morph) => set({ morph })} />
        </div>

        <div>
          <div className="label">
            해칭일 <span className="req">*</span>
          </div>
          <input type="date" className={`input mono${tried && !f.hatch ? ' bad' : ''}`} value={f.hatch} max={today()} onChange={(e) => set({ hatch: e.target.value })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">부 (수컷)</div>
            <select className="input" value={f.sire} onChange={(e) => set({ sire: e.target.value })}>
              <option value="">미상 / 선택 안 함</option>
              {parentOpts('M').map((a) => (
                <option key={a.id} value={a.id}>
                  {nm(a)} · {a.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label">모 (암컷)</div>
            <select className="input" value={f.dam} onChange={(e) => set({ dam: e.target.value })}>
              <option value="">미상 / 선택 안 함</option>
              {parentOpts('F').map((a) => (
                <option key={a.id} value={a.id}>
                  {nm(a)} · {a.code}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="hint" style={{ marginTop: -8 }}>
          자기 자신과 자손은 부모 목록에서 제외돼요 · 혈통 추적용 부모는 등록 후 상태를 '외부'로 바꿔 두세요
        </div>

        {pi && (
          <div className="pair-card" style={{ background: pi.cardBg, borderColor: pi.cardBd, gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>이 개체의 근친계수</span>
              <span className="mono" style={{ fontWeight: 600, fontSize: 15, color: pi.msgInk }}>
                {pi.txt}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--sub)' }}>부모 관계: {pi.rel}</div>
            {pi.blocked && (
              <div className="err">근친 기준을 넘는 부모 조합이에요. 기록은 저장되지만 이 개체는 근친 개체로 남아요.</div>
            )}
          </div>
        )}

        {editing && (
          <div>
            <div className="label">상태</div>
            <Seg
              items={(['keeping', 'sold', 'dead', 'external'] as const).map((s) => [s, STATUS_LABEL[s]] as const)}
              value={f.status}
              onChange={(status) => set({ status })}
            />
          </div>
        )}

        {tried && !f.hatch && <div className="err">해칭일을 입력해 주세요</div>}

        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || photoBusy}>
          {busy ? '저장 중…' : editing ? '수정 완료' : '개체 등록'}
        </button>
      </div>
    </Screen>
  )
}
