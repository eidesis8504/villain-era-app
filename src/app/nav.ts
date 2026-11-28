// 화면 주소 → 켜질 하단 탭. '전체'와 그 아래 화면은 켜진 탭이 없다
export type NavRoot = 'home' | 'animals' | 'community' | 'chat'

// 사육 관리 화면들은 홈의 '사육 관리'에서 들어가므로 홈 탭이 켜진다
const HOME_TOOLS = ['/todo', '/weights', '/clutch', '/lineage', '/feedings', '/scan']

export function navRoot(path: string): NavRoot | null {
  if (path === '/') return 'home'
  if (path.startsWith('/animals') || path.startsWith('/a/')) return 'animals'
  if (path.startsWith('/community')) return 'community'
  if (path.startsWith('/chat')) return 'chat'
  if (HOME_TOOLS.some((p) => path.startsWith(p))) return 'home'
  return null
}

// 대화 화면에서는 하단 탭을 숨겨 입력 칸에 자리를 준다
export const isThread = (path: string) => /^\/(chat\/[^/]+|inquiry|admin\/(inquiry|chat)\/[^/]+)\/?$/.test(path)
