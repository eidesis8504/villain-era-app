// 로그인 없이 시작: 기기마다 Supabase 익명 계정을 자동으로 만들어 데이터를 서버에 저장한다.
// (구글·카카오 로그인은 추후 이 계정에 연결하는 방식으로 추가 — 기존 기록 유지)
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Tables } from '../lib/database.types'
import { supabase } from '../lib/supabase'

export type Profile = Tables<'profiles'>

type Auth = {
  ready: boolean
  bootError: string | null
  session: Session | null
  uid: string | null
  isGuest: boolean
  profile: Profile | null
  profileLoading: boolean
  profileError: unknown
  isAdmin: boolean
  refreshProfile: () => Promise<unknown>
  retry: () => void
}

const Ctx = createContext<Auth | null>(null)

// 검색엔진·링크 미리보기·배포 스크린샷 봇에는 게스트 계정을 만들지 않는다
const BOT_UA = /bot\b|crawl|spider|slurp|HeadlessChrome|Lighthouse|facebookexternalhit|kakaotalk-scrap|Yeti|Daumoa/i
export const isBot = () => BOT_UA.test(navigator.userAgent)

// StrictMode에서 두 번 실행돼도 계정이 하나만 만들어지도록 한 번만 부팅한다
let boot: Promise<{ session: Session | null; error: string | null }> | null = null

function startSession() {
  boot ??= (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return { session: data.session, error: null }
    if (isBot()) return { session: null, error: null }
    const { data: d2, error } = await supabase.auth.signInAnonymously()
    if (error) {
      boot = null
      return {
        session: null,
        error:
          error.code === 'anonymous_provider_disabled'
            ? '서버에서 게스트 계정이 꺼져 있어요 (Supabase › Allow anonymous sign-ins)'
            : /fetch|network/i.test(error.message)
              ? '네트워크 연결을 확인해 주세요'
              : '앱을 시작하지 못했어요 — 잠시 후 다시 시도해 주세요',
      }
    }
    return { session: d2.session, error: null }
  })()
  return boot
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    startSession().then((r) => {
      if (!alive) return
      setSession(r.session)
      setBootError(r.error)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return
      if (s) setSession(s)
      // 저장된 세션이 만료·삭제되면 새 기기 계정으로 다시 시작한다
      if (event === 'SIGNED_OUT') {
        boot = null
        qc.clear()
        // 인증 콜백 안에서 바로 Supabase를 부르면 잠금이 걸릴 수 있어 다음 틱으로 미룬다
        setTimeout(() => {
          startSession().then((r) => {
            if (!alive) return
            setSession(r.session)
            setBootError(r.error)
          })
        }, 0)
      }
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [attempt, qc])

  const uid = session?.user.id ?? null
  const profileQ = useQuery({
    queryKey: ['profile', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid!).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const profile = profileQ.data ?? null

  // 할 일 알림 예약 시각 계산용 시간대를 브라우저 기준으로 맞춘다
  useEffect(() => {
    if (!profile) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && profile.tz !== tz) {
      supabase
        .from('profiles')
        .update({ tz })
        .eq('id', profile.id)
        .then(() => undefined)
    }
  }, [profile])

  const value = useMemo<Auth>(
    () => ({
      ready,
      bootError,
      session,
      uid,
      isGuest: !!session?.user.is_anonymous,
      profile,
      profileLoading: !!uid && profileQ.isLoading,
      profileError: profileQ.error,
      isAdmin: profile?.status === 'active' && profile.role === 'admin',
      refreshProfile: () => profileQ.refetch(),
      retry: () => {
        boot = null
        setReady(false)
        setBootError(null)
        setAttempt((n) => n + 1)
      },
    }),
    [ready, bootError, session, uid, profile, profileQ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider missing')
  return v
}

// 회원 화면 안에서만 사용 (Gate가 profile을 보장)
export function useMe() {
  const { profile, uid } = useAuth()
  if (!profile || !uid) throw new Error('profile not ready')
  return { profile, uid }
}

export const displayName = (p?: { nickname: string | null } | null) => p?.nickname || '사육자'
export const badgeOf = (p?: { role: string; badge: string | null } | null) =>
  p ? (p.role === 'admin' ? '운영자' : p.badge) : null
