// 스토어 앱 포장 설정 (Capacitor). 웹 빌드(dist)를 그대로 iOS·Android 앱에 넣는다.
// appId는 스토어에 처음 올린 뒤에는 바꿀 수 없다.
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.villainera.app',
  appName: 'VILLAIN ERA',
  webDir: 'dist',
  backgroundColor: '#FAF9F6',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#0148AB',
      showSpinner: false,
    },
  },
}

export default config
