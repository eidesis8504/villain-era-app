import { describe, expect, it } from 'vitest'
import { isTransferLink } from './qr'

describe('isTransferLink', () => {
  it('분양 코드가 붙은 분양 받기 주소', () => {
    expect(isTransferLink('/transfer', '?code=ABCD2345')).toBe(true)
    expect(isTransferLink('/transfer/', '?x=1&code=abcd2345')).toBe(true)
  })
  it('코드가 없거나 다른 주소면 아니다', () => {
    expect(isTransferLink('/transfer', '')).toBe(false)
    expect(isTransferLink('/transfer', '?code=ABC')).toBe(false)
    expect(isTransferLink('/animals', '?code=ABCD2345')).toBe(false)
  })
})
