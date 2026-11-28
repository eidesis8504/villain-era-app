// 사진·동영상 처리와 업로드 (사진은 기기에서 줄여서 올린다 — 무료 저장 용량 1GB 절약)
import { fitSize, PHOTO_MAX, PHOTO_QUALITY, photoNames, THUMB_MAX, THUMB_QUALITY, thumbPath } from './photo'
import { supabase, type Bucket } from './supabase'

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      URL.revokeObjectURL(u)
      res(im)
    }
    im.onerror = () => {
      URL.revokeObjectURL(u)
      rej(new Error('이 이미지 형식은 열 수 없어요 (JPG·PNG 권장)'))
    }
    im.src = u
  })
}

function draw(im: CanvasImageSource, w: number, h: number, maxSide: number) {
  const c = document.createElement('canvas')
  ;[c.width, c.height] = fitSize(w, h, maxSide)
  const ctx = c.getContext('2d')!
  // 크게 줄일 때(목록용 작은 사진) 계단 무늬가 생기지 않게 한다
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(im, 0, 0, c.width, c.height)
  return c
}

const toJpeg = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지를 변환하지 못했어요'))), 'image/jpeg', q))

export async function resizeImage(file: File, maxSide: number, quality = 0.82): Promise<Blob> {
  if (file.type && !/^image\//.test(file.type)) throw new Error('이미지 파일만 올릴 수 있어요')
  const im = await loadImage(file)
  return toJpeg(draw(im, im.naturalWidth, im.naturalHeight, maxSide), quality)
}

// 정사각형으로 잘라 줄인다 (프로필 사진)
export async function squareImage(file: File, side: number): Promise<Blob> {
  if (file.type && !/^image\//.test(file.type)) throw new Error('사진 파일만 올릴 수 있어요')
  const im = await loadImage(file)
  const s = Math.min(im.naturalWidth, im.naturalHeight)
  const c = document.createElement('canvas')
  c.width = side
  c.height = side
  c.getContext('2d')!.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, side, side)
  return toJpeg(c, 0.86)
}

// 개체 대표 사진: 자르지 않은 큰 사진과 목록용 작은 사진을 함께 만든다.
// 다시 그려 저장하므로 촬영 위치 같은 사진 속 정보는 남지 않는다
export type AnimalPhoto = { full: Blob; thumb: Blob }
export async function prepareAnimalPhoto(file: File): Promise<AnimalPhoto> {
  if (file.type && !/^image\//.test(file.type)) throw new Error('사진 파일만 올릴 수 있어요')
  const im = await loadImage(file)
  const full = await toJpeg(draw(im, im.naturalWidth, im.naturalHeight, PHOTO_MAX), PHOTO_QUALITY)
  const thumb = await toJpeg(draw(im, im.naturalWidth, im.naturalHeight, THUMB_MAX), THUMB_QUALITY)
  return { full, thumb }
}

export type MediaDraft = { t: 'img' | 'vid'; file: Blob; thumb: Blob; dur: number; preview: string }

export async function prepareImage(file: File): Promise<MediaDraft> {
  if (file.type && !/^image\//.test(file.type)) throw new Error('이미지 파일만 올릴 수 있어요')
  const im = await loadImage(file)
  const full = await toJpeg(draw(im, im.naturalWidth, im.naturalHeight, 1600), 0.82)
  const thumb = await toJpeg(draw(im, im.naturalWidth, im.naturalHeight, 360), 0.7)
  return { t: 'img', file: full, thumb, dur: 0, preview: URL.createObjectURL(thumb) }
}

export const VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const VIDEO_MAX_SEC = 180

export function prepareVideo(file: File): Promise<MediaDraft> {
  return new Promise((res, rej) => {
    if (file.type && !/^video\//.test(file.type)) return rej(new Error('동영상 파일만 올릴 수 있어요'))
    if (file.size > VIDEO_MAX_BYTES) return rej(new Error('동영상은 50MB 이하만 올릴 수 있어요'))
    const u = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    let done = false
    const finish = (err?: Error, thumb?: Blob) => {
      if (done) return
      done = true
      clearTimeout(timer)
      const dur = v.duration
      v.removeAttribute('src')
      v.load()
      URL.revokeObjectURL(u)
      if (err) return rej(err)
      if (!isFinite(dur) || dur <= 0) return rej(new Error('동영상 길이를 읽을 수 없어요'))
      if (dur > VIDEO_MAX_SEC + 0.5) return rej(new Error('동영상은 3분 이하만 올릴 수 있어요'))
      const t = thumb ?? new Blob()
      res({ t: 'vid', file, thumb: t, dur: Math.round(dur), preview: thumb ? URL.createObjectURL(thumb) : '' })
    }
    const timer = setTimeout(() => finish(v.readyState >= 1 ? undefined : new Error('동영상을 읽지 못했어요')), 10000)
    v.onloadedmetadata = () => {
      try {
        v.currentTime = Math.min(0.5, (v.duration || 1) / 2)
      } catch {
        finish()
      }
    }
    v.onseeked = async () => {
      try {
        const c = draw(v, v.videoWidth || 16, v.videoHeight || 9, 360)
        finish(undefined, await toJpeg(c, 0.7))
      } catch {
        finish()
      }
    }
    v.onerror = () => finish(new Error('이 브라우저에서 열 수 없는 영상 형식이에요 (MP4 권장)'))
    v.src = u
  })
}

export const fmtDur = (s: number) => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, '0')}`

function rand() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export async function upload(bucket: Bucket, uid: string, blob: Blob, ext: string, folder = '') {
  const path = `${uid}/${folder ? folder + '/' : ''}${rand()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || (ext === 'jpg' ? 'image/jpeg' : undefined),
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(/exceeded|too large|size/i.test(error.message) ? '파일이 너무 커요' : '파일을 올리지 못했어요')
  return path
}

// 큰 사진과 작은 사진을 같은 이름으로 짝지어 올리고 큰 사진의 경로를 돌려준다 (작은 사진의 경로는 photo.ts의 thumbPath로 구한다)
export async function uploadAnimalPhoto(uid: string, photo: AnimalPhoto): Promise<string> {
  const names = photoNames(rand())
  const bucket = supabase.storage.from('animal-photos')
  const put = (name: string, blob: Blob) => bucket.upload(`${uid}/${name}`, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
  const a = await put(names.full, photo.full)
  if (a.error) throw new Error(/exceeded|too large|size/i.test(a.error.message) ? '파일이 너무 커요' : '파일을 올리지 못했어요')
  const b = await put(names.thumb, photo.thumb)
  if (b.error) {
    await bucket.remove([`${uid}/${names.full}`])
    throw new Error('파일을 올리지 못했어요')
  }
  return `${uid}/${names.full}`
}

// 개체 사진을 지울 때는 짝인 작은 사진도 함께 지운다
export const removeAnimalPhoto = (path: string | null | undefined) => removeFiles('animal-photos', [...new Set([path, thumbPath(path)])])

export async function removeFiles(bucket: Bucket, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p && !/^https?:/.test(p))
  if (list.length) await supabase.storage.from(bucket).remove(list)
}

export function videoExt(file: Blob) {
  const t = file.type
  return t === 'video/quicktime' ? 'mov' : t === 'video/webm' ? 'webm' : 'mp4'
}
