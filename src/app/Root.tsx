import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router'
import { pickIndex, sizesOf, srcSetOf } from '../lib/splash'
import { AuthProvider, useAuth } from './auth'
import { SPLASH_ART } from './splashArt'
import { UIProvider } from './ui'
import Welcome from './Welcome'

const SPLASH_KEY = 've-splash'

// 앱을 켤 때 카드엽서 일러스트 6장 중 1장을 무작위로(각 1/6) 보여 준다.
// 그림 전체가 화면 안에 들어가고, 남는 곳은 같은 그림을 흐리게 깔아 채운다.
// 그림이 뜬 뒤 3초 뒤 닫힘 · 탭하면 바로 · 6초 안에 안 뜨면 닫힘 · 그림을 못 받으면 바로 닫힘
function Splash({ onDone }: { onDone: () => void }) {
  const [art] = useState(() => SPLASH_ART[pickIndex(Math.random(), SPLASH_ART.length)])
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const cap = window.setTimeout(onDone, 6000)
    return () => window.clearTimeout(cap)
  }, [onDone])
  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(onDone, 3000)
    return () => window.clearTimeout(t)
  }, [shown, onDone])
  return (
    <div className="splash" data-test="splash" data-art={art.slug} onClick={onDone}>
      <img className="splash-bg" src={art.backdrop} alt="" aria-hidden="true" />
      {!shown && <div className="splash-name">VILLAIN ERA</div>}
      <img
        className={`splash-art${shown ? ' on' : ''}`}
        data-test="splash-art"
        src={art.sources[0].url}
        srcSet={srcSetOf(art.sources)}
        sizes={sizesOf(art.ratio)}
        alt=""
        decoding="async"
        fetchPriority="high"
        onLoad={() => setShown(true)}
        onError={onDone}
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

// 기기 계정이 없으면 환영 화면, 있으면 프로필 준비가 끝난 뒤 앱 화면을 연다
function Gate({ children }: { children: ReactNode }) {
  const { ready, bootError, session, profile, profileLoading, profileError, profileGap, switching, refreshProfile, retry } =
    useAuth()
  // 계정 전환 중에는 처음 화면이 잠깐 보이지 않도록 스피너
  if (!ready || switching || (session && (profileLoading || profileGap === 'checking'))) {
    return (
      <FullCenter>
        <div className="spinner" />
      </FullCenter>
    )
  }
  if (!session && !bootError) return <Welcome />
  if (bootError || !session || profileError || !profile) {
    return (
      <FullCenter>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
          <div style={{ font: '700 28px var(--sans)', letterSpacing: '.04em', color: 'var(--blue)' }}>VILLAIN ERA</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>앱을 시작하지 못했어요</div>
          <div className="hint">
            {bootError ||
              (profileGap === 'broken' ? (
                <>
                  계정 정보를 불러오지 못했어요 — 계속되면 <Link to="/support">도움말·문의</Link>로 알려 주세요
                </>
              ) : (
                '프로필을 불러오지 못했어요 — 네트워크 연결을 확인해 주세요'
              ))}
          </div>
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
  // 다시 그려져도 같은 함수를 넘겨 스플래시 타이머가 처음부터 다시 시작되지 않게 한다
  const endSplash = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, '1')
    } catch {
      /* 저장 불가 브라우저 */
    }
    setSplash(false)
  }, [])
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
