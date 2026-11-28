// 개체 대표 사진의 크기와 파일 이름 규칙
// 큰 사진(-o): 상세 화면에서 자르지 않고 보여 준다. 작은 사진(-t): 목록·카드용.
// 사진은 기기에서 JPEG로 다시 그려 올린다 — 촬영 위치 같은 사진 속 정보가 공개 주소로 나가지 않게 한다.

// 큰 사진의 긴 변: 휴대폰 화면을 꽉 채워도 선명하고, 저장소의 파일 크기 제한(5MB) 안에 들어온다
export const PHOTO_MAX = 2560
export const PHOTO_QUALITY = 0.9
// 작은 사진의 긴 변: 가장 큰 쓰임(이력서 96px)의 3배보다 넉넉하게
export const THUMB_MAX = 400
export const THUMB_QUALITY = 0.8

// 비율을 지키며 긴 변을 maxSide에 맞춘다 (작은 사진은 키우지 않는다)
export function fitSize(w: number, h: number, maxSide: number): [number, number] {
  const k = Math.min(1, maxSide / Math.max(w, h))
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]
}

export const photoNames = (base: string) => ({ full: `${base}-o.jpg`, thumb: `${base}-t.jpg` })

// 목록에 쓸 작은 사진의 경로. 예전에 올린 사진(640px 한 장)은 작은 사진이 따로 없어 그 파일을 그대로 쓴다
export function thumbPath(path: string | null | undefined): string | null {
  if (!path) return null
  return path.endsWith('-o.jpg') ? path.slice(0, -'-o.jpg'.length) + '-t.jpg' : path
}
