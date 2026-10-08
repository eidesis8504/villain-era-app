// VILLAIN ERA · 웹 푸시 발송 함수
// pg_cron(1분마다)이 푸시 대기 알림이 있을 때만 호출한다. 호출자는 Vault의 push_dispatch_secret으로 검증한다.
// VAPID 키는 처음 실행될 때 이 함수가 생성해 Vault에 저장한다(개인키는 DB 밖으로 나가지 않는다).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'npm:postgres@3.4.5'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 })
const CONTACT = 'https://villain-era-app.netlify.app'

type Job = { id: number; user_id: string; kind: string; title: string; body: string; link: string | null }
type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string }

let appServer: Promise<webpush.ApplicationServer> | null = null

async function readVapid(): Promise<webpush.ExportedVapidKeys | null> {
  const [row] = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'vapid_keys_jwk' limit 1`
  return row ? JSON.parse(row.decrypted_secret) : null
}

async function loadAppServer(): Promise<webpush.ApplicationServer> {
  let exported = await readVapid()
  if (!exported) {
    const keys = await webpush.generateVapidKeys({ extractable: true })
    const fresh = await webpush.exportVapidKeys(keys)
    const pub = await webpush.exportApplicationServerKey(keys)
    try {
      await sql.begin(async (tx) => {
        await tx`select vault.create_secret(${JSON.stringify(fresh)}, 'vapid_keys_jwk', 'VAPID key pair (JWK) for web push')`
        await tx`select vault.create_secret(${pub}, 'vapid_public_key', 'VAPID application server key (base64url)')`
      })
      exported = fresh
    } catch {
      // 동시에 다른 실행이 먼저 만들었다면 그 키를 쓴다
      exported = await readVapid()
      if (!exported) throw new Error('VAPID 키를 만들 수 없어요')
    }
  }
  const vapidKeys = await webpush.importVapidKeys(exported, { extractable: false })
  return webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys })
}

function getAppServer() {
  appServer ??= loadAppServer().catch((e) => {
    appServer = null
    throw e
  })
  return appServer
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const [secret] = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret' limit 1`
  if (!secret || !safeEqual(req.headers.get('x-dispatch-secret') ?? '', secret.decrypted_secret)) {
    return new Response('forbidden', { status: 403 })
  }

  const app = await getAppServer()
  const input = await req.json().catch(() => ({}))
  if (input?.init) return Response.json({ ok: true })

  const jobs = await sql<Job[]>`
    update public.notifications n
       set push_state = 'sending'
      from (select id from public.notifications
             where push_state = 'pending'
             order by id
             limit 200
             for update skip locked) q
     where n.id = q.id
    returning n.id, n.user_id, n.kind, n.title, n.body, n.link`
  if (!jobs.length) return Response.json({ sent: 0 })

  const userIds = [...new Set(jobs.map((j) => j.user_id))]
  const subs = await sql<Sub[]>`
    select endpoint, user_id, p256dh, auth from public.push_subscriptions where user_id in ${sql(userIds)}`

  const sent: number[] = []
  const failed: number[] = []
  const none: number[] = []
  const okEndpoints = new Set<string>()
  const goneEndpoints = new Set<string>()

  await Promise.all(jobs.map(async (job) => {
    const targets = subs.filter((s) => s.user_id === job.user_id && !goneEndpoints.has(s.endpoint))
    if (!targets.length) {
      none.push(job.id)
      return
    }
    const payload = JSON.stringify({ title: job.title, body: job.body, link: job.link ?? '/', tag: `${job.kind}-${job.id}` })
    const results = await Promise.all(targets.map(async (s) => {
      try {
        await app.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
          .pushTextMessage(payload, {
            ttl: job.kind === 'todo' ? 3600 : 86400,
            urgency: job.kind === 'todo' ? webpush.Urgency.High : webpush.Urgency.Normal,
          })
        okEndpoints.add(s.endpoint)
        return true
      } catch (e) {
        if (e instanceof webpush.PushMessageError && [404, 410].includes(e.response.status)) {
          goneEndpoints.add(s.endpoint)
        } else {
          console.error('push failed', s.endpoint.slice(0, 60), String(e))
        }
        return false
      }
    }))
    ;(results.some(Boolean) ? sent : failed).push(job.id)
  }))

  if (sent.length) await sql`update public.notifications set push_state = 'sent' where id in ${sql(sent)}`
  if (failed.length) await sql`update public.notifications set push_state = 'failed' where id in ${sql(failed)}`
  if (none.length) await sql`update public.notifications set push_state = 'none' where id in ${sql(none)}`
  if (okEndpoints.size) {
    await sql`update public.push_subscriptions set last_success_at = now() where endpoint in ${sql([...okEndpoints])}`
  }
  if (goneEndpoints.size) {
    await sql`delete from public.push_subscriptions where endpoint in ${sql([...goneEndpoints])}`
  }

  return Response.json({ sent: sent.length, failed: failed.length, none: none.length, gone: goneEndpoints.size })
})
