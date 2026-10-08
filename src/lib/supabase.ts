import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 환경변수가 없어요')
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type Bucket = 'avatars' | 'animal-photos' | 'post-media'

export function publicUrl(bucket: Bucket, path: string | null | undefined) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${url}/storage/v1/object/public/${bucket}/${path}`
}

// Postgres raise exception / PostgREST 오류를 사용자에게 보여줄 한국어 문장으로
export function errMsg(e: unknown, fallback = '잠시 후 다시 시도해 주세요'): string {
  if (!e) return fallback
  const m = (e as { message?: string }).message || String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '네트워크 연결을 확인해 주세요'
  if (/duplicate key/i.test(m)) return '이미 같은 기록이 있어요'
  if (/JWT|not authenticated|permission denied|row-level security/i.test(m)) return '권한이 없거나 로그인이 만료됐어요'
  return /[가-힣]/.test(m) ? m : fallback
}
