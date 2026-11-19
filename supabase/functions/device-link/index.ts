// VILLAIN ERA · 다른 기기에서 이어 쓰기(연결 코드)
// create: 로그인한 기기에 8자리 코드 발급 (처음이면 계정에 메일을 받을 수 없는 내부 주소를 '확인됨'으로 붙인다 — 메일 발송 없음)
// redeem: 코드를 넣은 새 기기에 같은 계정의 일회용 로그인 열쇠(token_hash)를 돌려준다 — 관리자 링크 생성이라 메일 발송 없음
// revoke: 쓰지 않은 코드 모두 무효 ('다른 기기 모두 연결 끊기')
// 코드 발급·사용·시도 제한은 private.device_link_* 함수(마이그레이션 device_link)가 맡는다.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type User } from 'npm:@supabase/supabase-js@2.117.3'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.3/cors'
import postgres from 'npm:postgres@3.4.5'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// 예약 도메인 .invalid — 어떤 메일도 갈 수 없는 주소
const internalEmail = (uid: string) => `${uid}@device.villain-era.invalid`

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function caller(req: Request): Promise<User | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data.user
}

async function create(req: Request): Promise<Response> {
  const user = await caller(req)
  if (!user) return json(401, { error: 'auth' })
  const [profile] = await sql`select status from public.profiles where id = ${user.id}`
  if (!profile) return json(401, { error: 'auth' })
  if (profile.status === 'blocked') return json(403, { error: 'blocked' })
  if (!user.email) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { email: internalEmail(user.id), email_confirm: true })
    if (error) throw error
  } else if (!user.email_confirmed_at) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
    if (error) throw error
  }
  try {
    const [row] = await sql`select code, expires_in from private.device_link_issue(${user.id})`
    return json(200, { code: row.code, expires_in: row.expires_in })
  } catch (e) {
    if (e instanceof Error && e.message === 'rate_limited') return json(429, { error: 'rate_limited' })
    throw e
  }
}

async function redeem(req: Request, code: unknown): Promise<Response> {
  if (typeof code !== 'string' || code.length > 32) return json(400, { error: 'invalid' })
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const [row] = await sql`select user_id, error from private.device_link_consume(${code}, ${await sha256(ip)})`
  if (row.error === 'rate_limited') return json(429, { error: 'rate_limited' })
  if (row.error) return json(400, { error: row.error })
  const { data: found, error: findError } = await admin.auth.admin.getUserById(row.user_id)
  if (findError) throw findError
  const email = found.user?.email
  if (!email) throw new Error(`연결할 계정에 주소가 없어요: ${row.user_id}`)
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  return json(200, { token_hash: data.properties.hashed_token })
}

async function revoke(req: Request): Promise<Response> {
  const user = await caller(req)
  if (!user) return json(401, { error: 'auth' })
  await sql`select private.device_link_revoke(${user.id})`
  return json(200, { ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'server' })
  let body: { action?: unknown; code?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'invalid' })
  }
  try {
    if (body.action === 'create') return await create(req)
    if (body.action === 'redeem') return await redeem(req, body.code)
    if (body.action === 'revoke') return await revoke(req)
    return json(400, { error: 'invalid' })
  } catch (e) {
    console.error('device-link', body.action, e)
    return json(500, { error: 'server' })
  }
})
