import { AuthApiError, AuthRetryableFetchError, FunctionsFetchError, FunctionsHttpError, type Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatCode,
  formatRemaining,
  isCompleteCode,
  kindFromResponse,
  LinkError,
  linkErrorMessage,
  normalizeCode,
  redeemLinkCode,
  verifyLinkToken,
} from './deviceLink'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({ supabase: { auth: { verifyOtp: vi.fn() }, functions: { invoke: vi.fn() } } }))

const verifyOtp = vi.mocked(supabase.auth.verifyOtp)
const invoke = vi.mocked(supabase.functions.invoke)
const fakeSession = { access_token: 'a', user: { id: 'u1' } } as unknown as Session

beforeEach(() => {
  verifyOtp.mockReset()
  invoke.mockReset()
})

describe('코드 입력 정리', () => {
  it('전각·소문자·하이픈·공백을 같은 코드로', () => {
    expect(normalizeCode('ｋ７ｑｍ－２ｘｐａ')).toBe('K7QM2XPA')
    expect(normalizeCode(' k7qm-2xpa ')).toBe('K7QM2XPA')
    expect(normalizeCode('K7QM2XPAZZZ')).toBe('K7QM2XPA')
  })
  it('4-4로 보여 주고, 8자가 되어야 완성', () => {
    expect(formatCode('K7QM2XPA')).toBe('K7QM-2XPA')
    expect(formatCode('K7Q')).toBe('K7Q')
    expect(isCompleteCode('k7qm-2xp')).toBe(false)
    expect(isCompleteCode('k7qm-2xpa')).toBe(true)
  })
})

describe('남은 시간', () => {
  it('분:초로, 0 이하는 0:00', () => {
    expect(formatRemaining(581_000)).toBe('9:41')
    expect(formatRemaining(600_000)).toBe('10:00')
    expect(formatRemaining(0)).toBe('0:00')
    expect(formatRemaining(-5)).toBe('0:00')
  })
})

describe('서버 응답 → 오류 종류', () => {
  it('상태 코드와 본문으로 정한다', () => {
    expect(kindFromResponse(null, null)).toBe('network')
    expect(kindFromResponse(400, { error: 'expired' })).toBe('expired')
    expect(kindFromResponse(400, { error: 'weird' })).toBe('server')
    expect(kindFromResponse(429, null)).toBe('rate_limited')
    expect(kindFromResponse(401, null)).toBe('auth')
    expect(kindFromResponse(403, null)).toBe('blocked')
  })
  it('사용자에게 보여 줄 문구', () => {
    expect(linkErrorMessage('expired')).toBe('만료되었거나 이미 쓴 코드예요 — 쓰던 기기에서 새 코드를 받아 주세요')
    expect(linkErrorMessage('invalid')).toBe('코드를 다시 확인해 주세요')
    expect(new LinkError('rate_limited').message).toBe('시도가 너무 많아요 — 잠시 후 다시 시도해 주세요')
  })
})

describe('redeemLinkCode', () => {
  it('정리한 코드로 서버를 부르고 열쇠를 돌려준다', async () => {
    invoke.mockResolvedValue({ data: { token_hash: 'h' }, error: null } as never)
    await expect(redeemLinkCode('k7qm-2xpa')).resolves.toBe('h')
    expect(invoke).toHaveBeenCalledWith('device-link', { body: { action: 'redeem', code: 'K7QM2XPA' } })
  })
  it('서버 오류 본문을 오류 종류로', async () => {
    const res = new Response(JSON.stringify({ error: 'expired' }), { status: 400 })
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(res) } as never)
    await expect(redeemLinkCode('K7QM2XPA')).rejects.toMatchObject({ kind: 'expired' })
  })
  it('연결 실패는 network', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error('Failed to fetch')) } as never)
    await expect(redeemLinkCode('K7QM2XPA')).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('verifyLinkToken', () => {
  it('네트워크 오류면 한 번 더 시도한다', async () => {
    verifyOtp
      .mockResolvedValueOnce({ data: { session: null, user: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) } as never)
      .mockResolvedValueOnce({ data: { session: fakeSession, user: fakeSession.user }, error: null } as never)
    await expect(verifyLinkToken('h')).resolves.toBe(fakeSession)
    expect(verifyOtp).toHaveBeenCalledTimes(2)
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'h', type: 'magiclink' })
  })
  it('두 번 다 네트워크 오류면 network', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) } as never)
    await expect(verifyLinkToken('h')).rejects.toMatchObject({ kind: 'network' })
    expect(verifyOtp).toHaveBeenCalledTimes(2)
  })
  it('열쇠가 무효면 expired (다시 시도하지 않음)', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired') } as never)
    const err = await verifyLinkToken('h').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LinkError)
    expect((err as LinkError).kind).toBe('expired')
    expect(verifyOtp).toHaveBeenCalledTimes(1)
  })
})
