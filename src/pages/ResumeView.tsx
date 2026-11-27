// 분양 이력서 본문 (순수 표시): 공개 화면(/r/<토큰>)이 쓴다. 사진 주소는 바깥에서 만들어 넘긴다.
import { LAW_NOTES, NOT_A_PARTY, WIMS_URL } from '../lib/adopt'
import { yd } from '../lib/date'
import { fd, fw, nm, sexLbl, sexMark } from '../lib/format'
import { resumeFeeding, resumeWeight, type Resume, type ResumeNode } from '../lib/resume'
import { Sparkline } from '../ui/kit'
import { FeedStrip } from './FeedStrip'
import { TierBadge } from './TierViews'

function Parent({ label, n }: { label: string; n: ResumeNode | null }) {
  return (
    <div className="resume-row">
      <span className="resume-key">{label}</span>
      {n ? (
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {n.name || '이름 없음'} <span className="mono resume-code">{n.code}</span>
          {n.morph ? ` · ${n.morph}` : ''}
        </span>
      ) : (
        <span style={{ color: 'var(--muted)' }}>미상</span>
      )}
    </div>
  )
}

export function ResumeView({ r, today, photoUrl }: { r: Resume; today: string; photoUrl: string }) {
  const a = r.animal
  const w = resumeWeight(r.weights)
  const f = resumeFeeding(r.feedings, today)
  return (
    <div className="resume" data-test="resume">
      <div className="card card-pad resume-head">
        <div className="ph-stripes resume-photo">{photoUrl ? <img src={photoUrl} alt="" /> : <span>{sexMark(a.sex)}</span>}</div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="resume-name">{nm(a)}</span>
            {a.status === 'sold' && <span className="tag solid">분양 완료</span>}
          </div>
          <span className="mono resume-code">{a.code}</span>
          <span className="resume-sub">
            {a.species} · {sexLbl(a.sex)} · {a.morph || '모프 미정'}
          </span>
          <span className="resume-sub">해칭 {a.hatch_date ? yd(a.hatch_date) : '미상'}</span>
        </div>
      </div>

      <div className="card card-pad resume-sec">
        <div className="resume-title">분양자</div>
        <div className="resume-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
            {r.owner.nickname || '사육자'}
            {r.owner.badge && <span className="tag dark">{r.owner.badge}</span>}
            {r.owner.badge !== '운영자' && typeof r.owner.hz === 'number' && <TierBadge hz={r.owner.hz} />}
          </span>
          <span className="resume-sub">VILLAIN ERA 시작 {yd(r.owner.since)}</span>
        </div>
      </div>

      <div className="card card-pad resume-sec">
        <div className="resume-title">체중</div>
        {w.count === 0 ? (
          <div className="resume-empty">체중 기록이 없어요</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 'none' }}>
              <div className="mono resume-big">{fw(w.last)}</div>
              <div className="resume-sub">
                {yd(w.lastDay)} · 측정 {w.count}회
              </div>
              {w.gain !== null && <div className="mono resume-gain">첫 측정 대비 {fd(w.gain)}</div>}
            </div>
            <Sparkline pts={w.pts} />
          </div>
        )}
      </div>

      <div className="card card-pad resume-sec">
        <div className="resume-title">
          급여 <span className="resume-sub">최근 30일</span>
        </div>
        {r.feedings.length === 0 ? (
          <div className="resume-empty">급여 기록이 없어요</div>
        ) : (
          <>
            <FeedStrip list={r.feedings.map((x) => ({ fed_on: x.d, result: x.r }))} now={today} />
            <div className="resume-sub">
              {f.days === 0
                ? `최근 30일 기록이 없어요 · 마지막 기록 ${yd(f.lastDay)}`
                : `기록한 날 ${f.days}일 · 먹음 ${f.ate}회 · 거부 ${f.refused}회`}
            </div>
            {f.foods.length > 0 && (
              <div className="resume-row">
                <span className="resume-key">주로 먹은 먹이</span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{f.foods.join(', ')}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card card-pad resume-sec">
        <div className="resume-title">혈통</div>
        {!r.sire && !r.dam ? (
          <div className="resume-empty">부모 정보가 없어요</div>
        ) : (
          <>
            <Parent label="부" n={r.sire} />
            <Parent label="모" n={r.dam} />
          </>
        )}
      </div>

      <div className="resume-note">
        <p>이 이력서는 분양자가 VILLAIN ERA에 남긴 기록을 그대로 보여 줘요. 건강 기록은 들어 있지 않아요.</p>
        <p>
          <b>{NOT_A_PARTY}</b>
        </p>
        <ul>
          {LAW_NOTES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <a href={WIMS_URL} target="_blank" rel="noreferrer">
          야생동물종합관리시스템 열기 ›
        </a>
        <p className="resume-sub">이 링크를 만든 날 {yd(r.shared_at)}</p>
      </div>
    </div>
  )
}
