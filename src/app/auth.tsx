// 로그인 없이 시작: 환영 화면에서 '시작하기'를 누르면 기기마다 Supabase 익명 계정을 만들어 데이터를 서버에 저장한다.
// (계정은 버튼을 눌렀을 때만 만든다 — 앱 안 브라우저·사파리·홈 화면 앱을 오가며 계정이 여러 개 생기는 것을 줄이기 위해)
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { deleteMyAccount } from '../lib/account'
import { bootErrorAction, consumeExpectedSignOut, expectSignOut, markDisconnected, missingProfileAction } from '../lib/boot'
import type { Tables } from '../lib/database.types'
import { redeemLinkCode, verifyLinkToken } from '../lib/deviceLink'
import { currentEnv } from '../lib/env'
import { supabase } from '../lib/supabase'
import { landingSource, trackDeviceLink, trackOpen } from '../lib/track'

export type Profile = Tables<'profiles'>

type Auth = {
  ready: boolean
  bootError: string | null
  session: Session | null
  uid: string | null
  profile: Profile | null
  profileLoading: boolean
  profileError: unknown
  // 세션은 있는데 프로필 행이 없을 때: 서버 확인 중 / 네트워크 문제 / 비정상(사용자는 있는데 프로필만 없음)
  profileGap: null | 'checking' | 'retry' | 'broken'
  isAdmin: boolean
  refreshProfile: () => Promise<unknown>
  retry: () => void
  start: () => Promise<void>
  // 다른 기기에서 이어 쓰기: 처음 화면에서 코드로 같은 계정에 들어가기
  link: (code: string) => Promise<void>
  // 빈 계정이 있는 기기에서 코드로 다른 계정으로 바꾸기 (빈 계정은 지운다)
  switchAccount: (code: string) => Promise<void>
  switching: boolean
}

const Ctx = createContext<Auth | null>(null)

// StrictMode에서 두 번 실행돼도 한 번만 읽도록 부팅을 공유한다
let boot: Promise<{ session: Session | null; error: string | null }> | null = null

function loadSession() {
  boot ??= (async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      boot = null
      if (bootErrorAction(error) === 'sign_out') {
        // 계정 삭제·연결 끊김으로 세션이 이미 지워졌다 → 오류 대신 처음 화면 + 안내
        markDisconnected()
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
        return { session: null, error: null }
      }
      return { session: null, error: '앱을 시작하지 못했어요 — 잠시 후 다시 시도해 주세요' }
    }
    return { session: data.session, error: null }
  })()
  return boot
}

async function signInGuest(): Promise<Session> {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.session) {
    const m = error?.message ?? ''
    throw new Error(
      error?.code === 'anonymous_provider_disabled'
        ? '서버에서 게스트 계정이 꺼져 있어요 (Supabase › Allow anonymous sign-ins)'
        : error?.status === 429
          ? '요청이 많아요 — 잠시 후 다시 시도해 주세요'
          : /fetch|network|load failed/i.test(m)
            ? '네트워크 연결을 확인해 주세요'
            : '시작하지 못했어요 — 잠시 후 다시 시도해 주세요',
    )
  }
  // 첫 유입 경로·기기 (실패해도 시작은 계속)
  await supabase.rpc('set_first_touch', { p_source: landingSource(), p_platform: currentEnv().platform })
  return data.session
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    let alive = true
    loadSession().then((r) => {
      if (!alive) return
      setSession(r.session)
      setBootError(r.error)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return
      // 계정 삭제·세션 만료 시에는 새 계정을 자동으로 만들지 않고 환영 화면으로 돌아간다
      if (event === 'SIGNED_OUT') {
        // 사용자가 직접 한 로그아웃(계정 삭제·계정 전환)이 아니면 '연결이 끊어졌어요' 안내
        if (!consumeExpectedSignOut()) markDisconnected()
        boot = null
        qc.clear()
        setSession(null)
        return
      }
      if (s) setSession(s)
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

  // 세션은 있는데 프로필 행이 없으면(계정이 서버에서 지워졌거나 연결이 끊김) 서버에 사용자를 확인한다.
  // 없는 사용자면 이 기기 로그인 정보만 지우고 처음 화면으로, 네트워크 문제면 '다시 시도'.
  // 확인이 끝나기 전에는 'checking'이라 오류 화면이 깜박이지 않는다. 다시 읽을 때마다(dataUpdatedAt) 다시 확인한다.
  const profileMissing = !!uid && profileQ.isSuccess && profileQ.data === null
  const checkedAt = profileQ.dataUpdatedAt
  const [gapCheck, setGapCheck] = useState<{ at: number; result: 'retry' | 'broken' } | null>(null)
  useEffect(() => {
    if (!profileMissing) return
    let alive = true
    supabase.auth.getUser().then(({ error }) => {
      if (!alive) return
      const action = missingProfileAction(error)
      if (action === 'sign_out') {
        markDisconnected()
        supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      } else setGapCheck({ at: checkedAt, result: action })
    })
    return () => {
      alive = false
    }
  }, [profileMissing, checkedAt])
  const profileGap = !profileMissing ? null : gapCheck?.at === checkedAt ? gapCheck.result : 'checking'

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
      profile,
      profileLoading: !!uid && profileQ.isLoading,
      profileError: profileQ.error,
      profileGap,
      isAdmin: profile?.status === 'active' && profile.role === 'admin',
      refreshProfile: () => profileQ.refetch(),
      retry: () => {
        boot = null
        setReady(false)
        setBootError(null)
        setAttempt((n) => n + 1)
      },
      start: async () => {
        const s = await signInGuest()
        setSession(s)
        trackOpen()
      },
      link: async (code: string) => {
        const s = await verifyLinkToken(await redeemLinkCode(code))
        setSession(s)
        trackOpen()
        trackDeviceLink()
      },
      switchAccount: async (code: string) => {
        // 코드를 먼저 확인해 열쇠를 받는다 — 틀린 코드면 여기서 멈추고 아무것도 지우지 않는다
        const tokenHash = await redeemLinkCode(code)
        setSwitching(true)
        try {
          expectSignOut()
          try {
            await deleteMyAccount(uid!)
          } catch {
            // 빈 계정을 지우지 못해도 전환은 계속한다 (빈 계정만 서버에 남는다)
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
          }
          setSession(await verifyLinkToken(tokenHash))
          trackOpen()
          trackDeviceLink()
        } finally {
          setSwitching(false)
        }
      },
      switching,
    }),
    [ready, bootError, session, uid, profile, profileQ, profileGap, switching],
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
