import { useEffect, useMemo, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useNotifications } from '../data/community'
import { useChecks, useKeeper, useTodos } from '../data/keeper'
import { gap, today } from '../lib/date'
import { todosOn } from '../lib/todo'
import { Avatar } from '../ui/kit'
import { displayName, useAuth } from './auth'
import { useViewport } from './layout'
import { useUI } from './ui'

function navRoot(path: string) {
  if (path === '/') return 'home'
  if (path.startsWith('/animals') || path.startsWith('/a/')) return 'animals'
  if (path.startsWith('/scan')) return 'scan'
  if (path.startsWith('/community')) return 'community'
  if (['/todo', '/weights', '/clutch', '/lineage'].some((p) => path.startsWith(p))) return 'home'
  return 'more'
}

const NONE: never[] = []

function useSideCounts() {
  const k = useKeeper()
  const todos = useTodos().data ?? NONE
  const checks = useChecks().data ?? NONE
  const notifs = useNotifications().data ?? NONE
  return useMemo(() => {
    const T = today()
    const done = new Set(checks.filter((c) => c.day === T).map((c) => c.todo_id))
    return {
      owned: k.owned.length,
      incub: k.clutches.reduce((n, c) => n + k.incub(c), 0),
      stale: k.owned.filter((a) => {
        const l = k.lastW(a.id)
        return !l || gap(l.date, T) > 14
      }).length,
      remain: todosOn(todos, T).filter((t) => !done.has(t.id)).length,
      unread: notifs.filter((n) => !n.read_at).length,
    }
  }, [k, todos, checks, notifs])
}

function Sidebar() {
  const { profile, isGuest, isAdmin } = useAuth()
  const c = useSideCounts()
  const nav = useNavigate()
  const loc = useLocation()
  const item = (to: string, label: string, badge?: number, badgeBg = 'var(--blue)', test?: string) => {
    const on = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)
    return (
      <Link key={to} to={to} className={`side-item${on ? ' on' : ''}`} data-test={test}>
        <span style={{ flex: 1 }}>{label}</span>
        {!!badge && (
          <span className="count-badge" style={{ background: badgeBg }}>
            {badge}
          </span>
        )}
      </Link>
    )
  }
  const name = displayName(profile)
  return (
    <nav className="sidebar" data-test="nav">
      <div className="sidebar-brand" onClick={() => nav('/')}>
        VILLAIN ERA
      </div>
      <div className="side-group">
        <div className="side-group-title">사육 관리</div>
        {item('/', '홈')}
        {item('/animals', '개체', c.owned, 'var(--muted-2)', 'nav-animals')}
        {item('/lineage', '혈통')}
        {item('/clutch', '산란', c.incub)}
        {item('/weights', '체중', c.stale, 'var(--warn)')}
        {item('/todo', '오늘의 할 일', c.remain)}
      </div>
      <div className="side-group">
        <div className="side-group-title">커뮤니티</div>
        {item('/community', '커뮤니티')}
        {item('/notices', '공지사항')}
      </div>
      <div className="side-group">
        <div className="side-group-title">도구</div>
        {item('/scan', 'QR 스캔')}
        {item('/transfer', '분양 받기')}
        {item('/more', '설정')}
      </div>
      <div className="side-foot">
        <Avatar name={name} url={profile?.avatar_url} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>
            {name}
          </div>
          <div className="ellipsis" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {isAdmin ? '운영자' : isGuest ? '게스트 · 이 기기 계정' : '회원'}
          </div>
        </div>
        <button type="button" className="bell" aria-label="알림" onClick={() => nav('/alerts')}>
          <span className="bell-glyph" />
          {c.unread > 0 && (
            <span className="dot-badge" style={{ top: -6, right: -6 }}>
              {c.unread}
            </span>
          )}
        </button>
      </div>
    </nav>
  )
}

function BottomNav() {
  const loc = useLocation()
  const root = navRoot(loc.pathname)
  const it = (key: string, to: string, label: string, glyph: React.CSSProperties) => (
    <NavLink to={to} className={`nav-item${root === key ? ' on' : ''}`} data-test={`nav-${key}`} replace={root === key}>
      <span style={{ border: '1.8px solid currentColor', ...glyph }} />
      <span>{label}</span>
    </NavLink>
  )
  return (
    <nav className="bottom-nav" data-test="nav">
      {it('home', '/', '홈', { width: 20, height: 18, borderRadius: '4px 4px 3px 3px' })}
      {it('animals', '/animals', '개체', { width: 18, height: 20, borderRadius: 4 })}
      <NavLink to="/scan" className={`nav-item nav-scan${root === 'scan' ? ' on' : ''}`} data-test="nav-scan">
        <span className="nav-scan-btn">
          <span style={{ width: 20, height: 20, border: '2px dashed var(--cream)', borderRadius: 4 }} />
        </span>
        <span>스캔</span>
      </NavLink>
      {it('community', '/community', '커뮤니티', { width: 20, height: 16, borderRadius: '4px 4px 4px 0' })}
      {it('more', '/more', '전체', { width: 18, height: 18, borderRadius: 4, borderStyle: 'dotted' })}
    </nav>
  )
}

// 새 알림이 오면 상단 배너로 알려준다 (앱이 열려 있을 때)
function NotificationWatcher() {
  const { data } = useNotifications()
  const ui = useUI()
  const seen = useRef<number | null>(null)
  useEffect(() => {
    if (!data) return
    const maxId = data[0]?.id ?? 0
    if (seen.current === null) {
      seen.current = maxId
      return
    }
    const fresh = data.filter(
      (n) => n.id > seen.current! && !n.read_at && ['todo', 'comment', 'notice', 'transfer'].includes(n.kind),
    )
    if (fresh.length) {
      const n = fresh[0]
      ui.banner({ title: n.title.replace(/^할 일 알림 · /, ''), body: n.body, link: n.link, kind: n.kind })
    }
    seen.current = Math.max(seen.current, maxId)
  }, [data, ui])
  return null
}

export function AppShell() {
  const { desk } = useViewport()
  const nav = useNavigate()

  // 푸시 알림을 눌렀을 때 서비스워커가 보내는 이동 요청
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') {
        const u = new URL(e.data.url)
        if (u.origin === location.origin) nav(u.pathname + u.search)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [nav])

  return (
    <div className={`frame${desk ? ' desk' : ''}`}>
      {desk && <Sidebar />}
      <div className="frame-main">
        <Outlet />
        {!desk && <BottomNav />}
      </div>
      <NotificationWatcher />
    </div>
  )
}
