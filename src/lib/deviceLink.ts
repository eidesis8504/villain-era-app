// 다른 기기에서 이어 쓰기(연결 코드): 코드 입력 정리, 서버 함수(device-link) 호출, 일회용 로그인 열쇠 검증.
// 쓰던 기기가 코드를 받고(create) → 새 기기가 코드를 넣으면(redeem) 같은 계정의 열쇠를 받아 로그인한다(verify).
import { FunctionsHttpError, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const CODE_LEN = 8
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

// 전각(한글 키보드)·소문자·하이픈·공백이 섞여도 같은 코드로
export function normalizeCode(input: string): string {
  return input
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LEN)
}

export function formatCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

export function isCompleteCode(input: string): boolean {
  return normalizeCode(input).length === CODE_LEN
}

export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export type LinkErrorKind = 'invalid' | 'expired' | 'rate_limited' | 'blocked' | 'auth' | 'network' | 'server'

const MESSAGES: Record<LinkErrorKind, string> = {
  invalid: '코드를 다시 확인해 주세요',
  expired: '만료되었거나 이미 쓴 코드예요 — 쓰던 기기에서 새 코드를 받아 주세요',
  rate_limited: '시도가 너무 많아요 — 잠시 후 다시 시도해 주세요',
  blocked: '이용이 제한된 계정이에요',
  auth: '권한이 없거나 로그인이 만료됐어요',
  network: '네트워크 연결을 확인해 주세요',
  server: '잠시 후 다시 시도해 주세요',
}

export function linkErrorMessage(kind: LinkErrorKind): string {
  return MESSAGES[kind]
}

export class LinkError extends Error {
  readonly kind: LinkErrorKind
  constructor(kind: LinkErrorKind) {
    super(linkErrorMessage(kind))
    this.name = 'LinkError'
    this.kind = kind
  }
}

const isKind = (v: unknown): v is LinkErrorKind => typeof v === 'string' && v in MESSAGES

// 서버 함수의 응답(상태 코드, 본문) → 오류 종류. status null = 서버에 닿지 못함
export function kindFromResponse(status: number | null, body: unknown): LinkErrorKind {
  if (status === null) return 'network'
  const named = (body as { error?: unknown } | null)?.error
  if (isKind(named)) return named
  if (status === 429) return 'rate_limited'
  if (status === 401) return 'auth'
  if (status === 403) return 'blocked'
  return 'server'
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('device-link', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response
      let payload: unknown = null
      try {
        payload = await res.json()
      } catch {
        /* 본문 없음 */
      }
      throw new LinkError(kindFromResponse(res.status, payload))
    }
    throw new LinkError('network')
  }
  if (!data || typeof data !== 'object') throw new LinkError('server')
  return data as Record<string, unknown>
}

export async function createLinkCode(): Promise<{ code: string; expiresIn: number }> {
  const d = await call({ action: 'create' })
  if (typeof d.code !== 'string' || typeof d.expires_in !== 'number') throw new LinkError('server')
  return { code: d.code, expiresIn: d.expires_in }
}

export async function redeemLinkCode(code: string): Promise<string> {
  const d = await call({ action: 'redeem', code: normalizeCode(code) })
  if (typeof d.token_hash !== 'string') throw new LinkError('server')
  return d.token_hash
}

export async function revokeLinkCodes(): Promise<void> {
  await call({ action: 'revoke' })
}

// 받은 열쇠로 이 기기에 같은 계정의 새 로그인을 만든다(화면 이동 없음).
// 코드는 이미 쓰였으므로 네트워크 오류면 같은 열쇠로 한 번 더 시도한다.
export async function verifyLinkToken(tokenHash: string): Promise<Session> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    if (!error) {
      if (data.session) return data.session
      throw new LinkError('server')
    }
    if (!isAuthRetryableFetchError(error)) throw new LinkError('expired')
  }
  throw new LinkError('network')
}
