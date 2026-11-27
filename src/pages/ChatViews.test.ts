import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../lib/chat'
import { MessageList, RoomItem } from './ChatViews'

const ME = 'aaaaaaaa-0000-0000-0000-000000000001'
const YOU = 'bbbbbbbb-0000-0000-0000-000000000002'
const ORIGIN = 'https://villain-era-app.netlify.app'
// 낮 12시(UTC): 어느 시간대에서 돌려도 날짜가 바뀌지 않는다
const NOON = '2026-11-27T12:00:00+00:00'
const msg = (id: number, sender_id: string, body: string, created_at = NOON): ChatMessage => ({ id, room_id: 'r1', sender_id, body, created_at })
const list = (messages: ChatMessage[], label?: (id: string) => string) =>
  renderToStaticMarkup(createElement(MessageList, { messages, isMine: (id: string) => id === ME, origin: ORIGIN, label }))
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length

describe('MessageList', () => {
  it('메시지가 없으면 안내 문구를 보여 준다', () => {
    expect(list([])).toContain('첫 메시지를 보내 보세요')
  })
  it('내 메시지와 상대 메시지를 구분한다', () => {
    const h = list([msg(1, ME, '내 말'), msg(2, YOU, '상대 말')])
    expect(h.indexOf('data-mine="1"')).toBeLessThan(h.indexOf('내 말'))
    expect(h.indexOf('내 말')).toBeLessThan(h.indexOf('data-mine="0"'))
    expect(h.indexOf('data-mine="0"')).toBeLessThan(h.indexOf('상대 말'))
    expect(count(h, /class="chat-msg mine/g)).toBe(1)
  })
  it('날짜가 바뀌면 날짜 줄을 넣는다', () => {
    const h = list([msg(1, ME, 'a', '2026-11-26T12:00:00+00:00'), msg(2, YOU, 'b'), msg(3, YOU, 'c')])
    expect(count(h, /class="chat-day/g)).toBe(2)
    expect(h).toContain('2026.11.26')
    expect(h).toContain('2026.11.27')
  })
  it('주소는 링크가 되고, 다른 사이트는 새 창으로 연다', () => {
    const h = list([msg(1, YOU, '여기 https://example.com/a 보세요')])
    expect(h).toContain('<a href="https://example.com/a"')
    expect(h).toContain('target="_blank"')
    expect(h).toContain('rel="noopener noreferrer nofollow"')
  })
  it('같은 사이트의 주소는 새 창으로 열지 않는다', () => {
    const h = list([msg(1, YOU, `${ORIGIN}/r/ABCD2345EFGH6789`)])
    expect(h).toContain(`<a href="${ORIGIN}/r/ABCD2345EFGH6789"`)
    expect(h).not.toContain('target="_blank"')
  })
  it('스크립트와 꺾쇠는 글자로 보인다', () => {
    const h = list([msg(1, YOU, '<script>alert(1)</script><img src=x onerror=alert(1)>')])
    expect(h).not.toContain('<script>')
    expect(h).not.toContain('<img')
    expect(h).toContain('&lt;script&gt;')
  })
  it('javascript: 주소는 링크가 되지 않는다', () => {
    expect(list([msg(1, YOU, 'javascript:alert(1)')])).not.toContain('<a ')
  })
  it('같은 사람이 같은 분에 이어 보낸 메시지는 마지막에만 시간을 붙인다', () => {
    const h = list([
      msg(1, YOU, 'a', '2026-11-27T12:00:05+00:00'),
      msg(2, YOU, 'b', '2026-11-27T12:00:40+00:00'),
      msg(3, ME, 'c', '2026-11-27T12:00:50+00:00'),
      msg(4, ME, 'd', '2026-11-27T12:01:10+00:00'),
    ])
    expect(count(h, /class="chat-time/g)).toBe(3)
  })
  it('이름표를 넘기면 보낸 사람이 바뀔 때마다 이름을 붙인다', () => {
    const h = list([msg(1, YOU, 'a'), msg(2, YOU, 'b'), msg(3, ME, 'c')], (id) => (id === ME ? '철수' : '영희'))
    expect(count(h, /class="chat-who"/g)).toBe(2)
    expect(h).toContain('영희')
    expect(h).toContain('철수')
  })
  it('이름표가 빈 글자인 사람에게는 이름을 붙이지 않는다', () => {
    const h = list([msg(1, YOU, 'a'), msg(2, ME, 'b')], (id) => (id === ME ? '' : '운영자'))
    expect(count(h, /class="chat-who"/g)).toBe(1)
    expect(h).toContain('운영자')
  })
  it('이름표를 넘기지 않으면 이름이 없다', () => {
    expect(list([msg(1, YOU, 'a')])).not.toContain('chat-who')
  })
})

describe('RoomItem', () => {
  const item = (over: Partial<Parameters<typeof RoomItem>[0]> = {}) =>
    renderToStaticMarkup(createElement(RoomItem, { name: '영희', preview: '안녕하세요', time: '방금', unread: false, ...over }))
  it('상대 이름·마지막 메시지·시간을 보여 준다', () => {
    const h = item()
    for (const t of ['영희', '안녕하세요', '방금']) expect(h).toContain(t)
  })
  it('안 읽은 방에만 표시가 있다', () => {
    expect(item({ unread: true })).toContain('data-unread="1"')
    expect(item({ unread: true })).toContain('안 읽음')
    expect(item()).toContain('data-unread="0"')
    expect(item()).not.toContain('안 읽음')
  })
  it('배지가 있으면 보여 준다', () => {
    expect(item({ badge: '운영자' })).toContain('운영자')
    expect(item()).not.toContain('tag dark')
  })
  it('글 제목을 넘기면 함께 보여 준다', () => {
    expect(item({ note: '릴리화이트 분양해요' })).toContain('릴리화이트 분양해요')
  })
})
