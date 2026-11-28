// 분양·홍보 글쓰기 칸: 글 종류, 개체, 분양가, 지역, 판매자 구분, 법 안내 확인
// 규칙(확인·서버로 보낼 모양)은 lib/adopt.ts에 있다.
import type { Animal } from '../data/keeper'
import {
  ADOPT_MODE_LABEL,
  formatBrn,
  LAW_NOTES,
  NOT_A_PARTY,
  WIMS_URL,
  type AdoptErrors,
  type AdoptForm,
  type AdoptMode,
} from '../lib/adopt'
import { nm } from '../lib/format'
import { Seg } from '../ui/kit'

export function AdoptFields({
  f,
  set,
  animals,
  errors,
}: {
  f: AdoptForm
  set: (patch: Partial<AdoptForm>) => void
  animals: Animal[]
  errors: AdoptErrors
}) {
  const text = (key: 'name' | 'rep' | 'tel' | 'permit' | 'price' | 'region', max: number, placeholder: string) => (
    <input
      className={`input${key in errors ? ' bad' : ''}`}
      data-test={`adopt-${key}`}
      value={f[key]}
      maxLength={max}
      onChange={(e) => set({ [key]: e.target.value })}
      placeholder={placeholder}
    />
  )
  const err = (key: keyof AdoptErrors) => errors[key] && <div className="err">{errors[key]}</div>

  return (
    <div data-test="adopt-fields" className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div className="label">글 종류</div>
        <Seg
          testId="adopt-mode"
          items={(['sale', 'show'] as const).map((m) => [m, ADOPT_MODE_LABEL[m]] as const)}
          value={f.mode}
          onChange={(mode: AdoptMode) => set({ mode })}
        />
        <div className="hint" style={{ marginTop: 6 }}>
          {f.mode === 'sale'
            ? '분양할 개체를 소개해요. 분양 상태(분양 중·예약 중·분양 완료)는 글을 쓴 뒤에 바꿀 수 있어요.'
            : '내 개체나 브리딩을 소개해요.'}
        </div>
      </div>

      <div>
        <div className="label">개체 · {f.mode === 'sale' ? '권장' : '선택'}</div>
        <select className="input" data-test="adopt-animal" value={f.animalId} onChange={(e) => set({ animalId: e.target.value })}>
          <option value="">개체 없이 쓰기</option>
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              {nm(a)} · {a.code}
            </option>
          ))}
        </select>
        <div className="hint" style={{ marginTop: 6 }}>
          개체를 고르면 개체 카드와 분양 이력서 링크가 글에 붙어요. 이력서는 계정이 없는 사람도 볼 수 있고, 개체 상세에서 언제든 끌 수 있어요.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: f.mode === 'sale' ? '1fr 1fr' : '1fr', gap: 10 }}>
        {f.mode === 'sale' && (
          <div>
            <div className="label">희망 분양가 · 선택</div>
            {text('price', 20, '예: 30만 원')}
          </div>
        )}
        <div>
          <div className="label">지역 · 선택</div>
          {text('region', 20, '예: 서울 강서구')}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div className="label">판매자 구분</div>
          <Seg
            testId="adopt-seller"
            items={[
              ['person', '개인'],
              ['biz', '사업자'],
            ]}
            value={f.biz ? 'biz' : 'person'}
            onChange={(v) => set({ biz: v === 'biz' })}
          />
        </div>
        {f.biz && (
          <>
            <div className="hint">사업자 정보는 글에 그대로 보여요.</div>
            {text('name', 40, '상호')}
            {err('name')}
            {text('rep', 20, '대표자')}
            {err('rep')}
            <input
              className={`input mono${errors.brn ? ' bad' : ''}`}
              data-test="adopt-brn"
              inputMode="numeric"
              value={f.brn}
              maxLength={12}
              onChange={(e) => set({ brn: formatBrn(e.target.value) })}
              placeholder="사업자등록번호 (숫자 10자리)"
            />
            {err('brn')}
            {text('tel', 20, '연락처')}
            {err('tel')}
            {text('permit', 40, '야생동물 영업허가번호 · 있으면')}
          </>
        )}
      </div>

      <div className="welcome-card" style={{ fontSize: 12 }}>
        <div className="welcome-card-title" style={{ fontSize: 13 }}>
          분양할 때 알아 두세요
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {LAW_NOTES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{NOT_A_PARTY}</div>
        <a href={WIMS_URL} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--blue)' }}>
          야생동물종합관리시스템 열기
        </a>
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, cursor: 'pointer' }}>
        <input
          type="checkbox"
          data-test="adopt-agree"
          checked={f.agreed}
          onChange={(e) => set({ agreed: e.target.checked })}
          style={{ width: 20, height: 20, flex: 'none', marginTop: 1 }}
        />
        <span>안내를 읽었고, 법과 운영정책을 지켜서 글을 써요</span>
      </label>
      {err('agreed')}
    </div>
  )
}
