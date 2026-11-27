import { describe, expect, it } from 'vitest'
import {
  canSend,
  CHAT_MAX,
  chatTime,
  dayGroups,
  isUnread,
  otherId,
  previewText,
  splitLinks,
  unreadCount,
  type ChatMessage,
  type ChatRoom,
} from './chat'

const A = 'aaaaaaaa-0000-0000-0000-000000000001'
const B = 'bbbbbbbb-0000-0000-0000-000000000002'
const OP = 'cccccccc-0000-0000-0000-000000000003'
const T10 = '2026-11-27T10:00:00+00:00'
const T11 = '2026-11-27T11:00:00+00:00'
const T12 = '2026-11-27T12:00:00+00:00'
const room = (over: Partial<ChatRoom> = {}): ChatRoom => ({
  id: 'r1',
  kind: 'dm',
  user_a: A,
  user_b: B,
  post_id: null,
  created_at: T10,
  last_message_at: null,
  last_message: '',
  last_sender: null,
  a_read_at: T10,
  b_read_at: T10,
  ...over,
})
const msg = (id: number, created_at: string, sender_id = A): ChatMessage => ({ id, room_id: 'r1', sender_id, body: 'm' + id, created_at })
const ORIGIN = 'https://villain-era-app.netlify.app'

describe('otherId', () => {
  it('1:1 대화의 상대', () => {
    expect(otherId(room(), A)).toBe(B)
    expect(otherId(room(), B)).toBe(A)
  })
  it('운영자 문의에는 상대가 없다', () => {
    expect(otherId(room({ kind: 'support', user_b: null }), A)).toBeNull()
  })
})

describe('isUnread', () => {
  it('메시지가 없으면 안 읽음이 아니다', () => {
    expect(isUnread(room(), A)).toBe(false)
  })
  it('상대가 보낸 마지막 메시지가 내 읽음 시각보다 늦으면 안 읽음', () => {
    const r = room({ last_message_at: T11, last_sender: B })
    expect(isUnread(r, A)).toBe(true)
  })
  it('내가 보낸 마지막 메시지는 안 읽음이 아니다', () => {
    const r = room({ last_message_at: T11, last_sender: B })
    expect(isUnread(r, B)).toBe(false)
  })
  it('읽은 뒤에는 안 읽음이 아니다', () => {
    expect(isUnread(room({ last_message_at: T11, last_sender: B, a_read_at: T12 }), A)).toBe(false)
  })
  it('b 쪽 회원은 b_read_at으로 본다', () => {
    expect(isUnread(room({ last_message_at: T11, last_sender: A, b_read_at: T10 }), B)).toBe(true)
    expect(isUnread(room({ last_message_at: T11, last_sender: A, b_read_at: T12 }), B)).toBe(false)
  })
  it('운영자 문의: 회원은 운영자의 답을 a 쪽 시각으로 본다', () => {
    const r = room({ kind: 'support', user_b: null, last_message_at: T11, last_sender: OP })
    expect(isUnread(r, A)).toBe(true)
    expect(isUnread({ ...r, a_read_at: T12 }, A)).toBe(false)
  })
  it('운영자 문의: 운영자는 회원의 문의를 b 쪽 시각으로 본다(어느 운영자든)', () => {
    const r = room({ kind: 'support', user_b: null, last_message_at: T11, last_sender: A })
    expect(isUnread(r, OP, true)).toBe(true)
    expect(isUnread({ ...r, b_read_at: T12 }, OP, true)).toBe(false)
    expect(isUnread({ ...r, last_sender: 'dddddddd-0000-0000-0000-000000000004' }, OP, true)).toBe(false)
  })
})

describe('unreadCount', () => {
  it('안 읽은 1:1 대화만 센다', () => {
    const rooms = [
      room({ id: 'r1', last_message_at: T11, last_sender: B }),
      room({ id: 'r2', last_message_at: T11, last_sender: A }),
      room({ id: 'r3', kind: 'support', user_b: null, last_message_at: T11, last_sender: OP }),
    ]
    expect(unreadCount(rooms, A)).toBe(1)
  })
})

describe('previewText', () => {
  it('마지막 메시지, 없으면 안내', () => {
    expect(previewText(room({ last_message: '안녕하세요' }))).toBe('안녕하세요')
    expect(previewText(room())).toBe('대화를 시작해 보세요')
  })
})

describe('splitLinks', () => {
  it('주소가 없으면 글자 하나', () => {
    expect(splitLinks('안녕하세요', ORIGIN)).toEqual([{ t: 'text', v: '안녕하세요' }])
  })
  it('같은 사이트의 주소는 앱 안 주소(path)를 함께 준다', () => {
    expect(splitLinks(`이력서 ${ORIGIN}/r/ABCD2345EFGH6789 보세요`, ORIGIN)).toEqual([
      { t: 'text', v: '이력서 ' },
      { t: 'link', v: `${ORIGIN}/r/ABCD2345EFGH6789`, path: '/r/ABCD2345EFGH6789' },
      { t: 'text', v: ' 보세요' },
    ])
  })
  it('다른 사이트의 주소는 path가 없고, 끝의 문장 부호는 링크에서 뺀다', () => {
    expect(splitLinks('여기 https://example.com/a?b=1.', ORIGIN)).toEqual([
      { t: 'text', v: '여기 ' },
      { t: 'link', v: 'https://example.com/a?b=1', path: null },
      { t: 'text', v: '.' },
    ])
  })
  it('주소가 여러 개면 모두 나눈다', () => {
    const s = splitLinks('https://a.example/1 그리고 http://b.example/2', ORIGIN)
    expect(s.filter((x) => x.t === 'link').map((x) => x.v)).toEqual(['https://a.example/1', 'http://b.example/2'])
  })
  it('http(s)가 아닌 것은 링크가 아니다', () => {
    expect(splitLinks('javascript:alert(1) ftp://x.example', ORIGIN)).toEqual([{ t: 'text', v: 'javascript:alert(1) ftp://x.example' }])
  })
  it('꺾쇠가 든 글은 글자 그대로 둔다', () => {
    expect(splitLinks('<script>alert(1)</script>', ORIGIN)).toEqual([{ t: 'text', v: '<script>alert(1)</script>' }])
  })
  it('주소 뒤에 붙은 꺾쇠·따옴표는 링크에 넣지 않는다', () => {
    const s = splitLinks('<a href="https://example.com/x">', ORIGIN)
    expect(s.find((x) => x.t === 'link')?.v).toBe('https://example.com/x')
  })
})

describe('dayGroups', () => {
  it('날짜별로 순서대로 묶는다', () => {
    const g = dayGroups([msg(1, '2026-11-26T03:00:00+00:00'), msg(2, '2026-11-26T03:05:00+00:00'), msg(3, '2026-11-27T03:00:00+00:00')])
    expect(g.map((x) => x.items.map((m) => m.id))).toEqual([[1, 2], [3]])
    expect(g[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(g[0].day).not.toBe(g[1].day)
  })
  it('메시지가 없으면 빈 배열', () => {
    expect(dayGroups([])).toEqual([])
  })
})

describe('chatTime', () => {
  it('시:분', () => {
    expect(chatTime('2026-11-27T03:07:00+00:00')).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('canSend', () => {
  it('공백만 있으면 못 보낸다', () => {
    expect(canSend('')).toBe(false)
    expect(canSend('  \n ')).toBe(false)
  })
  it('1자부터 1000자까지 보낸다', () => {
    expect(canSend('a')).toBe(true)
    expect(canSend('가'.repeat(CHAT_MAX))).toBe(true)
    expect(canSend('가'.repeat(CHAT_MAX + 1))).toBe(false)
  })
})
