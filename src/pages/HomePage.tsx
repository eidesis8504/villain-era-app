import { useNavigate } from 'react-router'
import { displayName, useMe } from '../app/auth'
import { useViewport } from '../app/layout'
import { Screen } from '../app/Screen'
import { useToggleCheck } from '../data/actions'
import { useNotices, useNotifications, usePopularPosts } from '../data/community'
import { useChecks, useKeeper, useTodos } from '../data/keeper'
import { dateLbl, today } from '../lib/date'
import { todosOn } from '../lib/todo'
import { PostCard, todoRow } from './shared'

export default function HomePage() {
  const { desk, tablet } = useViewport()
  const nav = useNavigate()
  const { profile } = useMe()
  const k = useKeeper()
  const todos = useTodos().data ?? []
  const checks = useChecks().data ?? []
  const notice = useNotices().data?.[0]
  const popular = usePopularPosts()
  const unread = (useNotifications().data ?? []).filter((n) => !n.read_at).length
  const toggle = useToggleCheck()

  const T = today()
  const rows = todosOn(todos, T).map((t) => todoRow(t, T, checks, T))
  const done = rows.filter((r) => r.on).length
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0
  const month = T.slice(0, 7)
  const measured = k.owned.filter((a) => k.lastW(a.id)?.date.startsWith(month)).length
  const eggs = k.clutches.reduce((n, c) => n + k.incub(c), 0)
  const cols = desk || tablet ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)'

  const stat = (label: string, value: number | string, unit: string, to: string) => (
    <div className="stat" onClick={() => nav(to)}>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ marginTop: 4 }}>
        <span className="mono" style={{ fontWeight: 600, fontSize: 26, color: 'var(--blue)' }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{unit}</span>
      </div>
    </div>
  )

  return (
    <Screen
      title={desk ? '홈' : undefined}
      right={desk ? { label: '+ 개체 등록', onClick: () => nav('/animals/new') } : undefined}
      wide
    >
      <div style={{ padding: '4px 18px 28px', display: 'grid', gridTemplateColumns: cols, gap: 14, alignItems: 'start' }}>
        {!desk && (
          <div className="span-all" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
            <span style={{ font: '700 20px var(--sans)', letterSpacing: '.02em', color: 'var(--blue)' }}>VILLAIN ERA</span>
            <button
              type="button"
              aria-label="알림"
              onClick={() => nav('/alerts')}
              style={{ position: 'relative', width: 28, height: 28, border: '1.6px solid var(--ink)', borderRadius: '9px 9px 6px 6px' }}
            >
              {unread > 0 && (
                <span className="dot-badge" style={{ top: -8, right: -9 }}>
                  {unread}
                </span>
              )}
            </button>
          </div>
        )}

        {notice && (
          <div
            className="span-all"
            onClick={() => nav('/notices')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--blue-soft)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}
          >
            <span style={{ background: 'var(--blue)', color: 'var(--cream)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, flex: 'none' }}>
              공지
            </span>
            <span className="ellipsis" style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0 }}>
              {notice.title}
            </span>
            <span style={{ color: 'var(--blue)', flex: 'none' }}>›</span>
          </div>
        )}

        <div className="span-all">
          <div className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>
            {dateLbl(T)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>안녕하세요, {displayName(profile)}님</div>
        </div>

        <div className="span-all" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {stat('사육 개체', k.owned.length, ' 마리', '/animals')}
          {stat('부화 중인 알', eggs, ' 개', '/clutch')}
          {stat('이번 달 체중 측정', measured, ` / ${k.owned.length}`, '/weights')}
          {stat('남은 할 일', rows.length - done, ` / ${rows.length}건`, '/todo')}
        </div>

        {!k.loading && k.animals.length === 0 && (
          <div className="span-all" style={{ background: 'var(--blue)', color: 'var(--cream)', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>첫 개체를 등록해 보세요</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>개체를 등록하면 체중·산란·혈통 기록이 한곳에 모이고, 서버에 자동으로 저장돼요.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => nav('/animals/new')}
                style={{ height: 44, padding: '0 18px', borderRadius: 12, background: 'var(--cream)', color: 'var(--blue)', fontSize: 14, fontWeight: 700 }}
              >
                + 개체 등록
              </button>
            </div>
          </div>
        )}

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="section-title">오늘의 할 일</span>
            <button type="button" data-test="home-todo" onClick={() => nav('/todo')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>
              전체 보기
            </button>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--seg)', margin: '12px 0 4px', overflow: 'hidden' }}>
            <div style={{ height: 6, background: 'var(--blue)', width: `${pct}%`, transition: 'width .3s' }} />
          </div>
          {rows.map((r) => (
            <div
              key={r.t.id}
              onClick={() => toggle.mutate({ todoId: r.t.id, day: T, on: !r.on })}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer' }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `1.6px solid ${r.box}`,
                  background: r.fill,
                  color: '#fff',
                  fontSize: 14,
                  lineHeight: '19px',
                  textAlign: 'center',
                  flex: 'none',
                }}
              >
                {r.mark}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: r.ink, textDecoration: r.deco }}>{r.t.title}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                  {r.time} · {r.rule} · {r.alarm}
                </div>
              </div>
              <span className="tag pill" style={{ flex: 'none' }}>
                {r.t.tag}
              </span>
            </div>
          ))}
          {!rows.length && (
            <div style={{ padding: '18px 0 6px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>오늘 예정된 할 일이 없어요</div>
          )}
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span className="section-title">커뮤니티 인기글</span>
            <button type="button" onClick={() => nav('/community')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>
              더보기
            </button>
          </div>
          {popular.data && !popular.data.length && (
            <div style={{ padding: '16px 0 4px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>아직 커뮤니티 글이 없어요</div>
          )}
          {(popular.data ?? []).map((p) => (
            <PostCard key={p.id} p={p} compact />
          ))}
        </div>
      </div>
    </Screen>
  )
}
