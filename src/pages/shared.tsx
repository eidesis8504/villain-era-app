// 여러 화면에서 쓰는 조각: 할 일 행 표시값, 게시글 카드, 개체 썸네일
import { useNavigate } from 'react-router'
import { Heart, MessageSquare, Play } from 'lucide-react'
import type { Check, Todo } from '../data/keeper'
import { badgeColor, type Post } from '../data/community'
import { badgeOf, displayName } from '../app/auth'
import { ADOPT_MODE_LABEL, ADOPT_STATUS_LABEL, ADOPT_STATUS_TAG } from '../lib/adopt'
import { md, isoDay } from '../lib/date'
import { fmtDur } from '../lib/media'
import { publicUrl } from '../lib/supabase'
import { alarmLbl, hhmm, ruleLbl } from '../lib/todo'
import { TierBadge } from './TierViews'

export function todoRow(t: Todo, day: string, checks: Check[], T: string) {
  const on = checks.some((c) => c.todo_id === t.id && c.day === day)
  return {
    t,
    on,
    time: hhmm(t.time_of_day),
    rule: ruleLbl(t, T),
    alarm: alarmLbl(t.alarm_minutes),
    box: on ? 'var(--blue)' : '#BDB8AD',
    fill: on ? 'var(--blue)' : '#fff',
    mark: on ? '✓' : '',
    ink: on ? '#9A9DA3' : 'var(--ink)',
    deco: on ? 'line-through' : 'none',
    seg: on ? 'var(--cream)' : 'rgba(250,249,246,.3)',
    dot: on ? 'var(--blue)' : 'var(--cream)',
    op: on ? 0.55 : 1,
  }
}

// 글 한 줄: 카드 상자 없이 가는 줄로 나눈다. 분류는 작은 회색 글자, 상태만 색 글자
export function PostCard({ p, compact }: { p: Post; compact?: boolean }) {
  const nav = useNavigate()
  const badge = badgeOf(p.author)
  const qaOpen = p.cat === 'Q&A' && !p.has_adopted
  const media = p.media ?? []
  // 분양·홍보 글: 글 종류와 분양 상태, 개체·분양가·지역 한 줄
  const ad = p.attach?.kind === 'adopt' ? p.attach : null
  const adLine = ad ? [ad.animal && `${ad.animal.name || '이름 없음'} · ${ad.animal.morph || '모프 미정'}`, ad.mode === 'sale' && (ad.price || '분양가 문의'), ad.region].filter(Boolean).join(' · ') : ''
  return (
    <div className="post" data-test="post-card" onClick={() => nav(`/community/${p.id}`)}>
      <div className="post-k">
        <span>{p.cat}</span>
        {ad && !compact && <span>{ADOPT_MODE_LABEL[ad.mode]}</span>}
        {ad?.mode === 'sale' && ad.status && <span className={`st ${ADOPT_STATUS_TAG[ad.status]}`}>{ADOPT_STATUS_LABEL[ad.status]}</span>}
        {p.has_adopted && <span className="st solid">채택 완료</span>}
        {qaOpen && !compact && <span className="st warn">답변 대기</span>}
        {p.attach && !ad && !compact && <span>기록 첨부</span>}
        {p.hidden && <span className="st warn">숨김</span>}
      </div>
      <div className="post-t">{p.title}</div>
      {!compact && adLine && <div className="post-x ellipsis">{adLine}</div>}
      {!compact && p.body && <div className="post-b ellipsis">{p.body}</div>}
      {!compact && media.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {media.slice(0, 4).map((m, i) => (
            <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'var(--surface2)', flex: 'none' }}>
              {m.thumb && <img src={publicUrl('post-media', m.thumb)} alt="" className="cover" loading="lazy" />}
              {m.t === 'vid' && (
                <span style={{ position: 'absolute', left: 4, bottom: 4, display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: '#fff', background: 'rgba(22,24,29,.75)', padding: '2px 5px', borderRadius: 4 }}>
                  <Play size={9} fill="currentColor" /> {fmtDur(m.dur ?? 0)}
                </span>
              )}
            </div>
          ))}
          {media.length > 4 && (
            <div style={{ width: 64, height: 64, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--sub)', flex: 'none' }}>
              +{media.length - 4}
            </div>
          )}
        </div>
      )}
      <div className="post-m">
        <span>{displayName(p.author)}</span>
        {badge && (
          <span className="tag dark" style={{ background: badgeColor(badge) }}>
            {badge}
          </span>
        )}
        {p.author && p.author.role !== 'admin' && <TierBadge hz={p.author.hz} />}
        {!compact && <span>· {md(isoDay(p.created_at))}</span>}
        <span style={{ flex: 1 }} />
        <span className="cnt">
          <Heart size={14} /> {p.like_count}
        </span>
        <span className="cnt">
          <MessageSquare size={14} /> {p.comment_count}
        </span>
      </div>
    </div>
  )
}

export function AnimalThumb({ path, mark, size, radius = 10 }: { path: string | null; mark: string; size: number; radius?: number }) {
  return (
    <div className="ph-stripes" style={{ width: size, height: size, borderRadius: radius, flex: 'none' }}>
      {path ? <img src={publicUrl('animal-photos', path)} alt="" loading="lazy" /> : <span>{mark}</span>}
    </div>
  )
}
