import { useNavigate } from 'react-router'
import { Bell, Check, ChevronRight, Egg, Network, TriangleAlert, Utensils, Weight } from 'lucide-react'
import { InstallHint } from '../app/InstallHint'
import { displayName, useMe } from '../app/auth'
import { useViewport } from '../app/layout'
import { Screen } from '../app/Screen'
import { useToggleCheck } from '../data/actions'
import { useNotices, useNotifications, usePopularPosts } from '../data/community'
import { useChecks, useKeeper, useTodos } from '../data/keeper'
import { gap, today, yd } from '../lib/date'
import { REFUSE_ALERT } from '../lib/feeding'
import { nm } from '../lib/format'
import { dayLabel, homeHeadline, namesLine } from '../lib/home'
import { todosOn } from '../lib/todo'
import { Avatar } from '../ui/kit'
import { PostCard, todoRow } from './shared'
import { SurveyCard } from './SurveyCard'

// 홈: 오늘 할 일(큰 제목) → 확인이 필요해요 → 사육 관리 → 커뮤니티 인기글
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
  // 7일 안 부화 예정(인큐 중인 알이 남은 차수) · 산란 예정(그라비드 확인 후 아직 산란 전)
  const soon = k.clutches.filter((c) => k.incub(c) > 0 && c.expected_from && gap(T, c.expected_from) <= 7)
  const soonEggs = soon.reduce((n, c) => n + k.incub(c), 0)
  const layDue = k.breeders
    .filter((b) => {
      if (!b.gravid_on || !b.lay_expected_on) return false
      const laidAfter = k.clutches.some((c) => c.dam_id === b.female_id && c.laid_on >= b.gravid_on!)
      return !laidAfter && gap(T, b.lay_expected_on) <= 7
    })
    .sort((x, y) => (x.lay_expected_on! < y.lay_expected_on! ? -1 : 1))
  const cols = desk || tablet ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)'
  // 급여 확인 필요: 연속 거부 3회 이상이거나 주기를 넘김
  const feedAttn = k.owned.map((x) => ({ x, s: k.feedSum(x.id) })).filter(({ s }) => s.overdue || s.refuseStreak >= REFUSE_ALERT)
  const refusing = feedAttn.filter(({ s }) => s.refuseStreak >= REFUSE_ALERT)
  const overdue = feedAttn.filter(({ s }) => s.refuseStreak < REFUSE_ALERT)
  const noAnimals = !k.loading && k.animals.length === 0

  // 급여 확인 줄: 한 마리면 그 개체의 급여 기록으로, 여러 마리면 한꺼번에 기록으로
  const feedRow = (test: string, title: string, list: typeof feedAttn) =>
    list.length > 0 && (
      <button type="button" className="row" data-test={test} onClick={() => nav(list.length === 1 ? `/animals/${list[0].x.id}/feeding` : '/feedings')}>
        <span className="row-ic warn">
          <TriangleAlert size={20} />
        </span>
        <span className="grow">
          <span className="row-t">{title}</span>
          <span className="meta">{namesLine(list.map(({ x }) => nm(x)))}</span>
        </span>
        <ChevronRight size={18} className="chev" />
      </button>
    )

  return (
    <Screen
      title={desk ? '홈' : undefined}
      right={desk ? { label: '+ 개체 등록', onClick: () => nav('/animals/new') } : undefined}
      wide
    >
      <div style={{ padding: '0 20px 28px', display: 'grid', gridTemplateColumns: cols, columnGap: 40, alignItems: 'start' }}>
        {!desk && (
          <div className="span-all" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56, marginRight: -8 }}>
            <span style={{ font: '700 18px var(--sans)', letterSpacing: '.05em', color: 'var(--blue)' }}>VILLAIN ERA</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button type="button" className="icon-btn" aria-label="알림" data-test="home-alerts" onClick={() => nav('/alerts')}>
                <Bell size={22} />
                {unread > 0 && (
                  <span className="dot-badge" style={{ top: 3, right: 1 }}>
                    {unread}
                  </span>
                )}
              </button>
              <button type="button" className="icon-btn" aria-label="전체" data-test="nav-more" onClick={() => nav('/more')}>
                <Avatar name={displayName(profile)} url={profile.avatar_url} size={32} />
              </button>
            </div>
          </div>
        )}

        <div className="span-all" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InstallHint hasRecords={k.animals.length > 0} />
          <SurveyCard />
          {notice && (
            <button type="button" className="notice" data-test="home-notice" onClick={() => nav('/notices')}>
              <b>공지</b>
              <span className="grow ellipsis">{notice.title}</span>
              <ChevronRight size={16} className="chev" />
            </button>
          )}
        </div>

        <div>
          <div className="meta" style={{ marginTop: 20 }}>
            {dayLabel(T)}
          </div>
          {noAnimals ? (
            <>
              <h1 className="h-display" style={{ marginTop: 4 }}>
                첫 개체를 등록해 보세요
              </h1>
              <p className="meta" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: '22px' }}>
                개체를 등록하면 체중·산란·혈통 기록이 한곳에 모이고, 서버에 자동으로 저장돼요.
              </p>
              <button type="button" className="btn btn-primary" data-test="home-first-animal" style={{ marginTop: 16, width: '100%' }} onClick={() => nav('/animals/new')}>
                개체 등록
              </button>
            </>
          ) : (
            <h1 className="h-display" style={{ marginTop: 4, maxWidth: 300 }}>
              {homeHeadline(rows.length, done)}
            </h1>
          )}

          {rows.length > 0 && (
            <>
              <div className="prog" style={{ margin: '16px 0 4px' }}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <div className="rows">
                {rows.map((r) => (
                  <button
                    type="button"
                    key={r.t.id}
                    role="checkbox"
                    aria-checked={r.on}
                    className={`row${r.on ? ' done' : ''}`}
                    onClick={() => toggle.mutate({ todoId: r.t.id, day: T, on: !r.on })}
                  >
                    <span className={`check${r.on ? ' on' : ''}`}>{r.on && <Check size={16} />}</span>
                    <span className="grow">
                      <span className="row-t">{r.t.title}</span>
                      <span className="meta">
                        {r.time} · {r.rule} · {r.alarm}
                      </span>
                    </span>
                    <span className="micro">{r.t.tag}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {!noAnimals && (
            <button type="button" className="lnk" data-test="home-todo" style={{ marginTop: rows.length ? 4 : 8 }} onClick={() => nav('/todo')}>
              할 일 전체 보기 <ChevronRight size={16} />
            </button>
          )}

          {(feedAttn.length > 0 || layDue.length > 0) && (
            <section data-test="attention" style={{ marginTop: 28 }}>
              <h2 className="h-title">확인이 필요해요</h2>
              <div className="rows">
                {feedRow('feed-attention', '급여 주기가 지났어요', overdue)}
                {feedRow('feed-refuse', `${REFUSE_ALERT}번 넘게 이어서 먹지 않았어요`, refusing)}
                {layDue.slice(0, 5).map((b) => {
                  const d = gap(T, b.lay_expected_on!)
                  return (
                    <button type="button" key={b.female_id} className="row" data-test="lay-due" onClick={() => nav(`/clutch/${b.female_id}`)}>
                      <span className="row-ic warn">
                        <Egg size={20} />
                      </span>
                      <span className="grow">
                        <span className="row-t">산란 예정 {d > 0 ? `D-${d}` : d === 0 ? '오늘' : `D+${-d}`}</span>
                        <span className="meta">
                          {nm(k.A(b.female_id))} · {yd(b.lay_expected_on)} · 산란통을 미리 준비해 주세요
                        </span>
                      </span>
                      <ChevronRight size={18} className="chev" />
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div>
          <section style={{ marginTop: 28 }}>
            <h2 className="h-title">사육 관리</h2>
            <div className="tiles" style={{ marginTop: 12 }}>
              <button type="button" className="tile" data-test="tile-feed" onClick={() => nav('/feedings')}>
                <span className="tile-h">
                  <Utensils size={18} /> 급여
                </span>
                {feedAttn.length > 0 ? (
                  <span className="tile-v warn">
                    {feedAttn.length}
                    <small>마리 확인 필요</small>
                  </span>
                ) : (
                  <span className="tile-v txt">{k.owned.length ? '확인할 것 없음' : '한꺼번에 기록'}</span>
                )}
              </button>
              <button type="button" className="tile" data-test="tile-weight" onClick={() => nav('/weights')}>
                <span className="tile-h">
                  <Weight size={18} /> 체중
                </span>
                <span className="tile-v">
                  {measured}
                  <small>/ {k.owned.length} 이번 달 측정</small>
                </span>
              </button>
              <button type="button" className="tile" data-test="tile-clutch" onClick={() => nav('/clutch')}>
                <span className="tile-h">
                  <Egg size={18} /> 산란
                </span>
                <span className="tile-v">
                  {eggs}
                  <small>개 부화 중{soonEggs ? ` · 7일 안 ${soonEggs}` : ''}</small>
                </span>
              </button>
              <button type="button" className="tile" data-test="tile-lineage" onClick={() => nav('/lineage')}>
                <span className="tile-h">
                  <Network size={18} /> 혈통
                </span>
                <span className="tile-v txt">페어링 검사</span>
              </button>
            </div>
          </section>

          <section style={{ marginTop: 28 }}>
            <div className="sec-h">
              <h2 className="h-title">커뮤니티 인기글</h2>
              <button type="button" className="lnk" style={{ padding: 0 }} onClick={() => nav('/community')}>
                더보기 <ChevronRight size={16} />
              </button>
            </div>
            {popular.data && !popular.data.length && <div className="empty">아직 커뮤니티 글이 없어요</div>}
            {(popular.data ?? []).map((p) => (
              <PostCard key={p.id} p={p} compact />
            ))}
          </section>
        </div>
      </div>
    </Screen>
  )
}
