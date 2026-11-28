// 분양 카드 (순수 표시): 분양·홍보 글에 붙는다. 개체 정보는 서버가 채운 값이다.
// 사진 주소와 '이력서 보기' 동작은 바깥에서 넘긴다.
import type { ReactNode } from 'react'
import { ADOPT_MODE_LABEL, ADOPT_STATUS_LABEL, ADOPT_STATUS_TAG, NOT_A_PARTY, type AdoptAttach } from '../lib/adopt'
import { yd } from '../lib/date'
import { nm, sexLbl, sexMark } from '../lib/format'

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <span className="adopt-key">{k}</span>
      <span className={mono ? 'mono' : undefined} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {v}
      </span>
    </>
  )
}

export function AdoptCard({
  at,
  photoUrl,
  onResume,
  children,
}: {
  at: AdoptAttach
  photoUrl: string
  onResume?: () => void
  children?: ReactNode
}) {
  const a = at.animal
  const s = at.seller
  return (
    <div className="card adopt-card" data-test="adopt-card">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span className="tag">{ADOPT_MODE_LABEL[at.mode]}</span>
        {at.mode === 'sale' && at.status && <span className={`tag ${ADOPT_STATUS_TAG[at.status]}`}>{ADOPT_STATUS_LABEL[at.status]}</span>}
      </div>
      {a && (
        <div className="adopt-animal">
          <div className="ph-stripes" style={{ width: 64, height: 64, borderRadius: 10, flex: 'none' }}>
            {photoUrl ? <img src={photoUrl} alt="" loading="lazy" /> : <span>{sexMark(a.sex)}</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>
              {nm(a)}{' '}
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)' }}>
                {a.code}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              {a.species} · {sexLbl(a.sex)} · {a.morph || '모프 미정'} · 해칭 {a.hatch_date ? yd(a.hatch_date) : '미상'}
            </div>
          </div>
        </div>
      )}
      <div className="adopt-rows">
        {at.mode === 'sale' && <Row k="희망 분양가" v={at.price || '문의'} />}
        {at.region && <Row k="지역" v={at.region} />}
        {s.type === 'biz' ? (
          <>
            <Row k="판매자" v="사업자" />
            <Row k="상호" v={s.name} />
            <Row k="대표자" v={s.rep} />
            <Row k="사업자등록번호" v={s.brn} mono />
            <Row k="연락처" v={s.tel} />
            {s.permit && <Row k="야생동물 영업허가번호" v={s.permit} />}
          </>
        ) : (
          <Row k={at.mode === 'sale' ? '분양자' : '작성자'} v="개인" />
        )}
      </div>
      {a && at.resume && onResume && (
        <button type="button" data-test="adopt-resume" className="btn btn-outline btn-sm" onClick={onResume}>
          이력서 보기
        </button>
      )}
      {children}
      <div className="hint">{NOT_A_PARTY}</div>
    </div>
  )
}
