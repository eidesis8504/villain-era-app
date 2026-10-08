// 여러 화면에서 쓰는 조각: 할 일 행 표시값, 게시글 카드, 개체 썸네일
import { useNavigate } from 'react-router'
import type { Check, Todo } from '../data/keeper'
import { badgeColor, type Post } from '../data/community'
import { badgeOf, displayName } from '../app/auth'
import { md, isoDay } from '../lib/date'
import { fmtDur } from '../lib/media'
import { publicUrl } from '../lib/supabase'
import { alarmLbl, hhmm, ruleLbl } from '../lib/todo'

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

export function PostCard({ p, compact }: { p: Post; compact?: boolean }) {
  const nav = useNavigate()
  const badge = badgeOf(p.author)
  const qaOpen = p.cat === 'Q&A' && !p.has_adopted
  const media = p.media ?? []
  if (compact) {
    return (
      <div
        onClick={() => nav(`/community/${p.id}`)}
        style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 5, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="tag">{p.cat}</span>
          {p.has_adopted && <span className="tag solid">채택 완료</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{p.title}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-2)' }}>
          <span>
            {displayName(p.author)}
            {badge && <span style={{ color: 'var(--blue)', fontWeight: 600 }}> · {badge}</span>}
          </span>
          <span className="mono">
            ♡ {p.like_count}  ▢ {p.comment_count}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div
      className="card"
      onClick={() => nav(`/community/${p.id}`)}
      style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="tag">{p.cat}</span>
        {p.has_adopted && <span className="tag solid">채택 완료</span>}
        {qaOpen && <span className="tag warn">답변 대기</span>}
        {p.attach && <span className="tag gray">기록 첨부</span>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{p.title}</div>
      {p.body && <div className="ellipsis" style={{ fontSize: 13, color: 'var(--muted)' }}>{p.body}</div>}
      {media.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          {media.slice(0, 4).map((m, i) => (
            <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'var(--seg)', flex: 'none' }}>
              {m.thumb && <img src={publicUrl('post-media', m.thumb)} alt="" className="cover" loading="lazy" />}
              {m.t === 'vid' && (
                <span
                  className="mono"
                  style={{ position: 'absolute', left: 4, bottom: 4, fontSize: 10, fontWeight: 600, color: '#fff', background: 'rgba(22,24,29,.75)', padding: '2px 5px', borderRadius: 5 }}
                >
                  ▶ {fmtDur(m.dur ?? 0)}
                </span>
              )}
            </div>
          ))}
          {media.length > 4 && (
            <div
              className="mono"
              style={{ width: 64, height: 64, borderRadius: 10, background: 'var(--seg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--sub)', flex: 'none' }}
            >
              +{media.length - 4}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--muted-2)' }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {displayName(p.author)}
          {badge && (
            <span className="tag dark" style={{ background: badgeColor(badge) }}>
              {badge}
            </span>
          )}
          · {md(isoDay(p.created_at))}
        </span>
        <span className="mono">
          ♡ {p.like_count}  ▢ {p.comment_count}
        </span>
      </div>
    </div>
  )
}

export function AnimalThumb({ path, mark, size, radius = 12 }: { path: string | null; mark: string; size: number; radius?: number }) {
  return (
    <div className="ph-stripes" style={{ width: size, height: size, borderRadius: radius, flex: 'none' }}>
      {path ? <img src={publicUrl('animal-photos', path)} alt="" loading="lazy" /> : <span>{mark}</span>}
    </div>
  )
}
