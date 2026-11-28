import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Bell, House, MessageCircle, MessagesSquare, PawPrint, Plus } from 'lucide-react'
import { useChatUnread } from '../data/chat'
import { useNotifications } from '../data/community'
import { useChecks, useKeeper, useRefresh, useTodos } from '../data/keeper'
import { gap, today } from '../lib/date'
import { supabase } from '../lib/supabase'
import { todosOn } from '../lib/todo'
import { trackOpen, trackView } from '../lib/track'
import { Avatar } from '../ui/kit'
import { displayName, useAuth } from './auth'
import { useViewport } from './layout'
import { isThread, navRoot, type NavRoot } from './nav'
import { QuickAddSheet } from './QuickAdd'
import { useUI } from './ui'

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
      feed: k.owned.filter((a) => {
        const f = k.feedSum(a.id)
        return f.overdue || f.refuseStreak >= 3
      }).length,
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
  const { profile, isAdmin } = useAuth()
  const c = useSideCounts()
  const chatUnread = useChatUnread()
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
        {item('/feedings', '급여', c.feed, 'var(--warn)')}
        {item('/weights', '체중', c.stale, 'var(--warn)')}
        {item('/todo', '오늘의 할 일', c.remain)}
      </div>
      <div className="side-group">
        <div className="side-group-title">커뮤니티</div>
        {item('/community', '커뮤니티')}
        {item('/chat', '채팅', chatUnread, 'var(--warn)', 'nav-chat')}
        {item('/notices', '공지사항')}
      </div>
      <div className="side-group">
        <div className="side-group-title">도구</div>
        {item('/scan', 'QR 스캔')}
        {item('/transfer', '분양 받기')}
        {item('/more', '전체')}
        {isAdmin && item('/admin', '검증 현황')}
      </div>
      <div className="side-foot">
        <Avatar name={name} url={profile?.avatar_url} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ellipsis" style={{ fontSize: 14, fontWeight: 600 }}>
            {name}
          </div>
          <div className="ellipsis" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {isAdmin ? '운영자' : '게스트 계정'}
          </div>
        </div>
        <button type="button" className="bell" aria-label="알림" onClick={() => nav('/alerts')}>
          <Bell size={20} />
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
  const chatUnread = useChatUnread()
  const [add, setAdd] = useState(false)
  const it = (key: NavRoot, to: string, label: string, icon: ReactNode, badge = 0) => (
    <NavLink to={to} className={`nav-item${root === key ? ' on' : ''}`} data-test={`nav-${key}`} replace={root === key}>
      <span className="nav-glyph">
        {icon}
        {badge > 0 && (
          <span className="dot-badge" data-test={`nav-${key}-badge`}>
            {badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </NavLink>
  )
  return (
    <>
      <nav className="bottom-nav" data-test="nav">
        {it('home', '/', '홈', <House size={24} />)}
        {it('animals', '/animals', '개체', <PawPrint size={24} />)}
        {/* 가운데 버튼은 화면 이동이 아니라 기록 시트를 연다 */}
        <button type="button" className="nav-item nav-add" data-test="nav-add" aria-haspopup="dialog" onClick={() => setAdd(true)}>
          <span className="nav-plus">
            <Plus size={22} />
          </span>
          <span>기록</span>
        </button>
        {it('community', '/community', '커뮤니티', <MessagesSquare size={24} />)}
        {it('chat', '/chat', '채팅', <MessageCircle size={24} />, chatUnread)}
      </nav>
      {add && <QuickAddSheet onClose={() => setAdd(false)} />}
    </>
  )
}

// 새 알림이 오면 상단 배너로 알려준다 (앱이 열려 있을 때)
function NotificationWatcher() {
  const { data } = useNotifications()
  const ui = useUI()
  const refresh = useRefresh()
  const { pathname } = useLocation()
  const seen = useRef<number | null>(null)
  const cleared = useRef(new Set<number>())
  useEffect(() => {
    if (!data) return
    // 지금 보고 있는 대화의 채팅 알림은 배너를 띄우지 않고 읽은 것으로 한다 (같은 알림은 한 번만 시도한다)
    const here = document.visibilityState === 'visible' ? data.filter((n) => n.kind === 'chat' && !n.read_at && n.link === pathname) : []
    const todo = here.filter((n) => !cleared.current.has(n.id))
    if (todo.length) {
      todo.forEach((n) => cleared.current.add(n.id))
      supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', todo.map((n) => n.id))
        .then(({ error }) => {
          if (!error) void refresh('notifications')
        })
    }
    const maxId = data[0]?.id ?? 0
    if (seen.current === null) {
      seen.current = maxId
      return
    }
    const fresh = data.filter(
      (n) =>
        n.id > seen.current! &&
        !n.read_at &&
        !here.includes(n) &&
        ['todo', 'comment', 'notice', 'transfer', 'feeding', 'hatch', 'health', 'chat'].includes(n.kind),
    )
    if (fresh.length) {
      const n = fresh[0]
      ui.banner({ title: n.title.replace(/^할 일 알림 · /, ''), body: n.body, link: n.link, kind: n.kind })
    }
    seen.current = Math.max(seen.current, maxId)
  }, [data, ui, pathname, refresh])
  return null
}

export function AppShell() {
  const { desk } = useViewport()
  const nav = useNavigate()
  const loc = useLocation()

  // 사용 흔적: 앱 열기(하루 1번, 다시 보일 때 날짜가 바뀌었으면 또) + 기록이 남지 않는 화면 보기
  useEffect(() => {
    trackOpen()
    const onVis = () => {
      if (document.visibilityState === 'visible') trackOpen()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    trackView(loc.pathname)
  }, [loc.pathname])

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
        {!desk && !isThread(loc.pathname) && <BottomNav />}
      </div>
      <NotificationWatcher />
    </div>
  )
}
