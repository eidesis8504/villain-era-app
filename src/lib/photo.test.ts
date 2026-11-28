import { describe, expect, it } from 'vitest'
import { fitSize, PHOTO_MAX, photoNames, THUMB_MAX, thumbPath } from './photo'

describe('fitSize', () => {
  it('긴 변을 기준에 맞추고 비율은 그대로 둔다', () => {
    expect(fitSize(4032, 3024, 2560)).toEqual([2560, 1920])
    expect(fitSize(3024, 4032, 2560)).toEqual([1920, 2560])
  })
  it('기준보다 작은 사진은 키우지 않는다', () => {
    expect(fitSize(1200, 900, 2560)).toEqual([1200, 900])
  })
  it('아주 길쭉한 사진도 1px보다 작아지지 않는다', () => {
    expect(fitSize(10000, 2, 400)).toEqual([400, 1])
  })
})

describe('photoNames', () => {
  it('큰 사진과 작은 사진의 파일 이름을 짝으로 만든다', () => {
    expect(photoNames('abc123')).toEqual({ full: 'abc123-o.jpg', thumb: 'abc123-t.jpg' })
  })
})

describe('thumbPath', () => {
  it('새 방식으로 올린 사진은 작은 사진 경로를 준다', () => {
    expect(thumbPath('uid-1/abc123-o.jpg')).toBe('uid-1/abc123-t.jpg')
  })
  it('예전에 올린 사진(작은 사진이 따로 없음)은 그대로 준다', () => {
    expect(thumbPath('uid-1/abc123.jpg')).toBe('uid-1/abc123.jpg')
    expect(thumbPath('uid-1/my-o.jpg.png')).toBe('uid-1/my-o.jpg.png')
  })
  it('없으면 null', () => {
    expect(thumbPath(null)).toBeNull()
    expect(thumbPath(undefined)).toBeNull()
    expect(thumbPath('')).toBeNull()
  })
})

describe('크기 기준', () => {
  it('큰 사진은 휴대폰 화면을 꽉 채워도 선명한 크기, 작은 사진은 목록용', () => {
    expect(PHOTO_MAX).toBe(2560)
    expect(THUMB_MAX).toBe(400)
  })
})
