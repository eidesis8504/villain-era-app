import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useViewport } from './layout'

type Tone = 'ok' | 'warn'
type BannerData = { title: string; body: string; link?: string | null; kind?: string }

type UI = {
  toast: (msg: string, tone?: Tone) => void
  banner: (b: BannerData) => void
}

const Ctx = createContext<UI | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const { desk } = useViewport()
  const navigate = useNavigate()
  const [toast, setToast] = useState<{ msg: string; tone: Tone } | null>(null)
  const [banner, setBanner] = useState<(BannerData & { on: boolean }) | null>(null)
  const tt = useRef<number | undefined>(undefined)
  const bt = useRef<number | undefined>(undefined)

  const showToast = useCallback((msg: string, tone: Tone = 'ok') => {
    window.clearTimeout(tt.current)
    setToast({ msg, tone })
    tt.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  const showBanner = useCallback((b: BannerData) => {
    window.clearTimeout(bt.current)
    setBanner({ ...b, on: false })
    window.setTimeout(() => setBanner((s) => (s ? { ...s, on: true } : null)), 40)
    bt.current = window.setTimeout(() => {
      setBanner((s) => (s ? { ...s, on: false } : null))
      window.setTimeout(() => setBanner(null), 400)
    }, 4600)
  }, [])

  useEffect(() => () => {
    window.clearTimeout(tt.current)
    window.clearTimeout(bt.current)
  }, [])

  const value = useMemo(() => ({ toast: showToast, banner: showBanner }), [showToast, showBanner])

  return (
    <Ctx.Provider value={value}>
      {children}
      {banner && (
        <div
          className={`banner${banner.on ? ' on' : ''}${desk ? ' desk' : ''}`}
          onClick={() => {
            setBanner(null)
            if (banner.link) navigate(banner.link)
          }}
        >
          <span className="ve-mark">VE</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
              <span>VILLAIN ERA · {banner.kind === 'todo' ? '할 일 알림' : '알림'}</span>
              <span>지금</span>
            </div>
            <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
              {banner.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--sub)' }}>{banner.body}</div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`toast-wrap${desk ? ' desk' : ''}`}>
          <div className={`toast${toast.tone === 'warn' ? ' warn' : ''}`}>{toast.msg}</div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useUI() {
  const v = useContext(Ctx)
  if (!v) throw new Error('UIProvider missing')
  return v
}
