import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { useViewport } from './layout'
import { AuthProvider, isBot, useAuth } from './auth'
import { UIProvider } from './ui'

const SPLASH_KEY = 've-splash'

function Splash({ onDone }: { onDone: () => void }) {
  const { desk } = useViewport()
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const t = window.setTimeout(onDone, 4200)
    ref.current?.play().catch(() => undefined)
    return () => window.clearTimeout(t)
  }, [onDone])
  return (
    <div className="splash" data-test="splash" onClick={onDone}>
      <div className="splash-name">VILLAIN ERA</div>
      <video
        ref={ref}
        src="/splash.mp4"
        muted
        autoPlay
        playsInline
        onEnded={onDone}
        style={{ objectFit: desk ? 'contain' : 'cover' }}
      />
      <div className="splash-skip">탭하여 건너뛰기</div>
    </div>
  )
}

function FullCenter({ children }: { children: ReactNode }) {
  return (
    <div className="center-fill" style={{ height: '100dvh', background: 'var(--cream)' }}>
      {children}
    </div>
  )
}

// 기기 계정 준비가 끝나야 앱 화면을 연다
function Gate({ children }: { children: ReactNode }) {
  const { ready, bootError, session, profile, profileLoading, profileError, refreshProfile, retry } = useAuth()
  if (!ready || (session && profileLoading)) {
    return (
      <FullCenter>
        <div className="spinner" />
      </FullCenter>
    )
  }
  if (!session && !bootError && isBot()) {
    return (
      <FullCenter>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '700 28px var(--sans)', letterSpacing: '.04em', color: 'var(--blue)' }}>VILLAIN ERA</div>
          <div style={{ fontSize: 14, color: 'var(--sub)', marginTop: 6 }}>파충류 사육 관리 · 커뮤니티</div>
        </div>
      </FullCenter>
    )
  }
  if (bootError || !session || profileError || !profile) {
    return (
      <FullCenter>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
          <div style={{ font: '700 28px var(--sans)', letterSpacing: '.04em', color: 'var(--blue)' }}>VILLAIN ERA</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>앱을 시작하지 못했어요</div>
          <div className="hint">{bootError || '프로필을 불러오지 못했어요 — 네트워크 연결을 확인해 주세요'}</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (profileError || (session && !profile) ? refreshProfile() : retry())}
          >
            다시 시도
          </button>
        </div>
      </FullCenter>
    )
  }
  if (profile.status === 'blocked') {
    return (
      <FullCenter>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>이용이 제한된 계정이에요</div>
          <div className="hint" style={{ marginTop: 6 }}>
            문의가 필요하면 운영자에게 연락해 주세요
          </div>
        </div>
      </FullCenter>
    )
  }
  return <>{children}</>
}

export function Root() {
  const [splash, setSplash] = useState(() => {
    try {
      return !sessionStorage.getItem(SPLASH_KEY)
    } catch {
      return false
    }
  })
  const endSplash = () => {
    try {
      sessionStorage.setItem(SPLASH_KEY, '1')
    } catch {
      /* 저장 불가 브라우저 */
    }
    setSplash(false)
  }
  return (
    <AuthProvider>
      <UIProvider>
        <Gate>
          <Outlet />
        </Gate>
        {splash && <Splash onDone={endSplash} />}
      </UIProvider>
    </AuthProvider>
  )
}
