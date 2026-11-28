import type { CSSProperties, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useViewport } from './layout'

// 뒤로가기: 앱 안에서 이동해 온 경우 이전 화면, 직접 들어온 경우 상위 화면으로
export function useBack(fallback: string) {
  const nav = useNavigate()
  const loc = useLocation()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (loc.key !== 'default' && idx > 0) nav(-1)
    else nav(fallback, { replace: true })
  }
}

type Right = { label: string; onClick: () => void; test?: string; icon?: ReactNode }

export function Screen({
  title,
  back,
  right,
  wide,
  children,
  hideHeader,
  footer,
}: {
  title?: string
  back?: string
  right?: Right
  wide?: boolean
  children: ReactNode
  hideHeader?: boolean
  // 스크롤되지 않고 화면 아래에 붙는 영역 (채팅 입력 칸)
  footer?: ReactNode
}) {
  const { desk, tablet } = useViewport()
  const goBack = useBack(back ?? '/')
  const width = wide ? 1120 : 720
  const side = desk ? `max(32px, calc((100% - ${width}px) / 2))` : tablet ? 'max(0px, calc((100% - 760px) / 2))' : '0px'
  const pad = desk ? `20px ${side} 40px` : `0 ${side}`
  const showHeader = !hideHeader && !!(title || right)
  // 휴대폰에서 뒤로 가기가 없는 화면(탭의 첫 화면)은 왼쪽에 큰 제목을 둔다
  const root = !desk && !back
  return (
    <>
      {showHeader && (
        <div
          className={`hdr${root ? ' root' : ''}`}
          style={desk ? ({ '--desk-pad': `max(32px, calc((100% - ${width}px) / 2 + 20px))` } as CSSProperties) : undefined}
        >
          {root ? null : desk && !back ? (
            <span />
          ) : (
            <button type="button" className="hdr-back" aria-label="뒤로" onClick={goBack}>
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="hdr-title ellipsis">{title}</div>
          {right ? (
            <button type="button" className="hdr-right" data-test={right.test} onClick={right.onClick}>
              {right.icon}
              {right.label}
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
      <div className="scroller" style={{ padding: pad }}>
        {children}
      </div>
      {footer && (
        <div className="screen-foot" style={{ padding: `0 ${side}` }}>
          {footer}
        </div>
      )}
    </>
  )
}
