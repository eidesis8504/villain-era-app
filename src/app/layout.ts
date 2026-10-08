import { useSyncExternalStore } from 'react'

// 1024px 이상은 PC 화면(좌측 메뉴), 그 미만은 모바일 앱 화면(하단 탭) — 프로토타입 규칙
function subscribe(cb: () => void) {
  window.addEventListener('resize', cb)
  window.addEventListener('orientationchange', cb)
  return () => {
    window.removeEventListener('resize', cb)
    window.removeEventListener('orientationchange', cb)
  }
}

export function useViewport() {
  const w = useSyncExternalStore(subscribe, () => window.innerWidth)
  return { w, desk: w >= 1024, tablet: w >= 700 && w < 1024 }
}
