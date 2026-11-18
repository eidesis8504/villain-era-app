// 안드로이드 크롬 '앱으로 설치' (beforeinstallprompt). 페이지가 열리자마자 오는 이벤트라 모듈을 일찍 불러 둔다.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    listeners.forEach((f) => f())
  })
}

export const canInstall = () => deferred !== null

export function onInstallChange(f: () => void) {
  listeners.add(f)
  return () => listeners.delete(f)
}

export async function promptInstall() {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  await ev.prompt()
  const { outcome } = await ev.userChoice
  listeners.forEach((f) => f())
  return outcome === 'accepted'
}
