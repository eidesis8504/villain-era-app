// 채팅 규칙: 대화방·메시지 타입, 안 읽음 판단, 메시지 속 주소 나누기, 날짜 묶기
// 보내기·차단·속도 제한은 서버(supabase/migrations/20261127000002_chat.sql의 send_message)가 확인한다.
import { ds, p2 } from './date'

// dm: user_a < user_b · support: user_a = 문의한 회원, user_b = null (운영자 쪽 읽음 시각은 b_read_at)
export type ChatRoom = {
  id: string
  kind: 'dm' | 'support'
  user_a: string
  user_b: string | null
  post_id: string | null
  created_at: string
  last_message_at: string | null
  last_message: string
  last_sender: string | null
  a_read_at: string
  b_read_at: string
}
export type ChatMessage = { id: number; room_id: string; sender_id: string; body: string; created_at: string }

export const CHAT_MAX = 1000
export const CHAT_SAFETY = '선입금을 요구하면 사기일 수 있어요. 전화번호·계좌를 주고받을 때 조심하세요.'

export function otherId(r: ChatRoom, me: string): string | null {
  if (r.kind !== 'dm') return null
  return r.user_a === me ? r.user_b : r.user_a
}

// 안 읽음: 상대가 보낸 마지막 메시지가 내 쪽 읽음 시각보다 늦다.
// 운영자 문의를 운영자로 볼 때(asOperator)는 회원이 보낸 메시지를 b 쪽 시각과 견준다 (운영자 여러 명이 함께 본다)
export function isUnread(r: ChatRoom, me: string, asOperator = false): boolean {
  if (!r.last_message_at || !r.last_sender) return false
  const last = Date.parse(r.last_message_at)
  if (r.kind === 'support' && asOperator && r.user_a !== me) {
    return r.last_sender === r.user_a && last > Date.parse(r.b_read_at)
  }
  if (r.last_sender === me) return false
  return last > Date.parse(r.user_a === me ? r.a_read_at : r.b_read_at)
}

export const unreadCount = (rooms: ChatRoom[], me: string) => rooms.filter((r) => r.kind === 'dm' && isUnread(r, me)).length

export const previewText = (r: ChatRoom) => r.last_message || '대화를 시작해 보세요'

export const canSend = (body: string) => {
  const t = body.trim()
  return t.length > 0 && t.length <= CHAT_MAX
}

export type Seg = { t: 'text'; v: string } | { t: 'link'; v: string; path: string | null }

// 메시지에서 http(s) 주소만 링크로 나눈다. 같은 사이트의 주소는 앱 안에서 이동할 수 있게 path를 함께 준다.
// 글자는 화면에서 그대로 보여 주므로(React가 이스케이프) 꺾쇠가 들어 있어도 실행되지 않는다.
export function splitLinks(body: string, origin: string): Seg[] {
  const out: Seg[] = []
  const text = (v: string) => {
    if (!v) return
    const prev = out[out.length - 1]
    if (prev?.t === 'text') prev.v += v
    else out.push({ t: 'text', v })
  }
  let at = 0
  for (const m of body.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const start = m.index
    // 주소 끝에 붙은 문장 부호는 링크에서 뺀다
    const url = m[0].replace(/[.,!?;:)\]}]+$/, '')
    let parsed: URL | null = null
    try {
      parsed = new URL(url)
    } catch {
      parsed = null
    }
    if (!parsed || !parsed.hostname) continue
    text(body.slice(at, start))
    out.push({ t: 'link', v: url, path: parsed.origin === origin ? parsed.pathname + parsed.search + parsed.hash : null })
    at = start + url.length
  }
  text(body.slice(at))
  return out
}

// 날짜(브라우저 기준)별로 순서대로 묶는다
export function dayGroups(ms: ChatMessage[]): { day: string; items: ChatMessage[] }[] {
  const out: { day: string; items: ChatMessage[] }[] = []
  for (const m of ms) {
    const day = ds(new Date(m.created_at))
    const last = out[out.length - 1]
    if (last?.day === day) last.items.push(m)
    else out.push({ day, items: [m] })
  }
  return out
}

// 목록에 메시지 하나를 번호 순서로 더한다. 이미 있으면 목록을 그대로 돌려준다
// (내가 보낸 메시지는 보내기 응답과 실시간으로 두 번 온다)
export function mergeMessage(list: ChatMessage[] | undefined, m: ChatMessage): ChatMessage[] {
  if (!list) return [m]
  if (list.some((x) => x.id === m.id)) return list
  const next = [...list, m]
  return m.id > list[list.length - 1]?.id ? next : next.sort((a, b) => a.id - b.id)
}

export function chatTime(iso: string): string {
  const d = new Date(iso)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}
