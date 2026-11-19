// 스플래시 일러스트: 앱을 켤 때마다 무작위 1장 고르기와, 화면에 맞는 크기 파일 하나만 받게 하는 안내 (순수 함수)

// 0 이상 1 미만의 난수 → 0..n-1 (n장 각각 같은 확률). 이상한 값은 0으로
export function pickIndex(rand: number, n: number): number {
  if (!(rand > 0)) return 0
  return Math.min(n - 1, Math.floor(rand * n))
}

export function srcSetOf(sources: { url: string; w: number }[]): string {
  return sources.map((s) => `${s.url} ${s.w}w`).join(', ')
}

// 그림 전체가 화면 안에 들어가게(contain) 그릴 때의 표시 너비:
// 화면이 그림보다 길쭉하면 화면 너비, 아니면 화면 높이 × 그림 비율(가로/세로, 올림)
export function sizesOf(ratio: number): string {
  return `(max-aspect-ratio: ${Math.round(ratio * 1000)}/1000) 100vw, ${Math.ceil(ratio * 100)}vh`
}
