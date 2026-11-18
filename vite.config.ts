/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// 내장 글꼴(@fontsource)의 woff 예비 파일 참조를 빼서 CSS와 빌드 크기를 줄인다 (woff2는 모든 지원 브라우저가 읽음)
const dropWoffFallback = {
  name: 've-drop-woff-fallback',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!/@fontsource[\\/].+\.css$/.test(id)) return null
    return code.replace(/,\s*url\([^)]+\.woff\)\s*format\(['"]woff['"]\)/g, '')
  },
}

export default defineConfig({
  plugins: [dropWoffFallback, react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
