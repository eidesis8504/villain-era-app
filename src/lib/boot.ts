// 계정이 서버에서 사라졌거나(삭제) 연결이 끊긴(다른 기기에서 '연결 끊기') 기기를
// '앱을 시작하지 못했어요' 화면에 가두지 않고 처음 화면으로 돌려보내기 위한 판단.
// 진짜 네트워크 문제일 때만 '다시 시도'를 보여 준다.
import { isAuthApiError, isAuthRetryableFetchError, isAuthSessionMissingError } from '@supabase/supabase-js'

export type GapAction = 'sign_out' | 'retry' | 'broken'

export const DISCONNECTED_NOTICE = '이 기기의 계정 연결이 끊어져 처음 화면으로 돌아왔어요'

const GONE_CODES = new Set(['user_not_found', 'session_not_found', 'bad_jwt', 'no_authorization', 'refresh_token_not_found'])

// 서버가 '이 로그인은 더 이상 없다'고 답한 오류인지
function isGone(err: unknown): boolean {
  if (isAuthSessionMissingError(err)) return true
  if (!isAuthApiError(err)) return false
  return GONE_CODES.has(err.code ?? '') || [401, 403, 404].includes(err.status)
}

// 세션은 있는데 프로필이 없을 때: getUser()의 error로 다음 행동을 정한다 (null = 사용자는 있음)
export function missingProfileAction(err: unknown): GapAction {
  if (err == null) return 'broken'
  if (isAuthRetryableFetchError(err)) return 'retry'
  return isGone(err) ? 'sign_out' : 'retry'
}

// 시작할 때 getSession()이 오류를 내면: 네트워크면 다시 시도, 아니면 세션이 이미 지워진 것이라 처음 화면
export function bootErrorAction(err: unknown): 'sign_out' | 'retry' {
  return isAuthRetryableFetchError(err) ? 'retry' : 'sign_out'
}

// 처음 화면에 한 번만 보여 줄 '연결이 끊어졌어요' 표시 (이 기기 세션 저장소, 새로 열면 사라짐)
const KEY = 've-disconnected'

export function markDisconnected(): void {
  try {
    globalThis.sessionStorage?.setItem(KEY, '1')
  } catch {
    /* 저장소를 쓸 수 없는 브라우저 */
  }
}

// 읽기만 한다 (화면 첫 렌더에서 써도 안전 — 개발 모드 이중 렌더에도 같은 값)
export function peekDisconnected(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function clearDisconnected(): void {
  try {
    globalThis.sessionStorage?.removeItem(KEY)
  } catch {
    /* 저장소를 쓸 수 없는 브라우저 */
  }
}

// 사용자가 직접 계정을 지우거나 다른 계정으로 바꿀 때의 로그아웃은 '끊어졌어요' 안내를 띄우지 않는다
let expected = false

export function expectSignOut(): void {
  expected = true
}

export function consumeExpectedSignOut(): boolean {
  const was = expected
  expected = false
  return was
}
