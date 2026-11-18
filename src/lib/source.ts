// 유입 경로: 주소의 ?src= (또는 utm_source) → 없으면 들어온 사이트 → 없으면 direct
const KNOWN: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(kakao\.com|daum\.net)$/, 'kakao'],
  [/(^|\.)naver\.(com|me)$/, 'naver'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'facebook'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
  [/(^|\.)band\.us$/, 'band'],
]

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)

export function parseSource(search: string, referrer: string, selfHost: string): string {
  const q = new URLSearchParams(search)
  const fromUrl = clean(q.get('src') || q.get('utm_source') || '')
  if (fromUrl) return fromUrl
  let host = ''
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return 'direct'
  }
  if (!host || host === selfHost.toLowerCase()) return 'direct'
  for (const [re, name] of KNOWN) if (re.test(host)) return name
  // 그 외 사이트는 도메인 이름 부분 (www.reptile-forum.co.kr → reptile-forum)
  const parts = host.replace(/^www\./, '').split('.')
  return clean(parts[0]) || 'direct'
}

export const kakaoExternalUrl = (url: string) => `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
