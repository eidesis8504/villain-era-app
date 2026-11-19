import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bootErrorAction,
  consumeExpectedSignOut,
  expectSignOut,
  markDisconnected,
  missingProfileAction,
  takeDisconnected,
} from './boot'

// vitest 환경은 node(브라우저 저장소 없음)라 sessionStorage를 흉내 낸다
const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}
afterEach(() => vi.unstubAllGlobals())

describe('missingProfileAction (세션은 있는데 프로필이 없을 때 getUser 결과)', () => {
  it('사용자 없음·세션 없음·토큰 무효면 처음 화면으로', () => {
    expect(missingProfileAction(new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found'))).toBe('sign_out')
    expect(
      missingProfileAction(new AuthApiError('Session from session_id claim in JWT does not exist', 403, 'session_not_found')),
    ).toBe('sign_out')
    expect(missingProfileAction(new AuthApiError('invalid JWT', 401, 'bad_jwt'))).toBe('sign_out')
    expect(missingProfileAction(new AuthSessionMissingError())).toBe('sign_out')
  })
  it('네트워크·서버 오류면 다시 시도, 사용자는 있는데 프로필만 없으면 broken', () => {
    expect(missingProfileAction(new AuthRetryableFetchError('Failed to fetch', 0))).toBe('retry')
    expect(missingProfileAction(new AuthApiError('boom', 500, 'unexpected_failure'))).toBe('retry')
    expect(missingProfileAction(null)).toBe('broken')
  })
})

describe('bootErrorAction (시작할 때 getSession 오류)', () => {
  it('네트워크 오류만 다시 시도, 나머지는 처음 화면', () => {
    expect(bootErrorAction(new AuthRetryableFetchError('Failed to fetch', 0))).toBe('retry')
    expect(
      bootErrorAction(new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found')),
    ).toBe('sign_out')
  })
})

describe('연결 끊김 안내 표시', () => {
  it('한 번만 읽힌다', () => {
    vi.stubGlobal('sessionStorage', memory())
    markDisconnected()
    expect(takeDisconnected()).toBe(true)
    expect(takeDisconnected()).toBe(false)
  })
  it('저장소가 없거나 예외를 던져도 멈추지 않는다', () => {
    expect(() => markDisconnected()).not.toThrow()
    expect(takeDisconnected()).toBe(false)
    const boom = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('sessionStorage', { getItem: boom, setItem: boom, removeItem: boom })
    expect(() => markDisconnected()).not.toThrow()
    expect(takeDisconnected()).toBe(false)
  })
})

describe('사용자가 직접 한 로그아웃', () => {
  it('예상한 로그아웃은 한 번만 소비된다', () => {
    expectSignOut()
    expect(consumeExpectedSignOut()).toBe(true)
    expect(consumeExpectedSignOut()).toBe(false)
  })
})
