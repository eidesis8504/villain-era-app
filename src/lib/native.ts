// 스토어 앱(Capacitor) 안에서 실행 중인지와 앱 전용 처리
import { Capacitor } from '@capacitor/core'

// 앱 안의 주소는 https://localhost 등이라, QR·공유 링크는 항상 공개 웹 주소로 만든다
export const PUBLIC_ORIGIN = 'https://villain-era-app.netlify.app'

export const isNative = () => Capacitor.isNativePlatform()
export const nativePlatform = () => Capacitor.getPlatform() as 'ios' | 'android' | 'web'
export const appOrigin = () => (isNative() ? PUBLIC_ORIGIN : location.origin)

export async function initNative() {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
    if (nativePlatform() === 'android') await StatusBar.setBackgroundColor({ color: '#FAF9F6' })
  } catch {
    /* 상태 표시줄 설정 실패는 무시 */
  }
}
