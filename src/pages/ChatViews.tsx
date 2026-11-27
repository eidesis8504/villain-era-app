// 채팅의 순수 표시 부품: 메시지 목록, 대화방 한 줄.
// 서버를 부르지 않는다 — 이름·사진 주소·시간 글자·동작은 바깥에서 넘긴다.
import { Fragment } from 'react'
import { chatTime, dayGroups, splitLinks, type ChatMessage } from '../lib/chat'
import { dateLbl } from '../lib/date'
import { Avatar } from '../ui/kit'

// 메시지 글: 주소만 링크로 바꾸고 나머지는 글자 그대로 보여 준다 (React가 이스케이프한다)
function Body({ body, origin, onPath }: { body: string; origin: string; onPath?: (path: string) => void }) {
  return (
    <>
      {splitLinks(body, origin).map((s, i) => {
        if (s.t === 'text') return <Fragment key={i}>{s.v}</Fragment>
        const path = s.path
        // 같은 사이트의 주소는 앱 안에서 이동하고, 다른 사이트는 새 창으로 연다
        return path ? (
          <a
            key={i}
            href={s.v}
            onClick={(e) => {
              if (!onPath) return
              e.preventDefault()
              onPath(path)
            }}
          >
            {s.v}
          </a>
        ) : (
          <a key={i} href={s.v} target="_blank" rel="noopener noreferrer nofollow">
            {s.v}
          </a>
        )
      })}
    </>
  )
}

export function MessageList({
  messages,
  isMine,
  origin,
  onPath,
  label,
}: {
  messages: ChatMessage[]
  isMine: (senderId: string) => boolean
  origin: string
  onPath?: (path: string) => void
  // 보낸 사람의 이름표 (운영자 문의처럼 누가 말했는지 적어야 하는 화면에서만 넘긴다. 빈 글자면 붙이지 않는다)
  label?: (senderId: string) => string
}) {
  if (!messages.length) {
    return (
      <div className="chat-empty" data-test="chat-empty">
        아직 메시지가 없어요 · 첫 메시지를 보내 보세요
      </div>
    )
  }
  return (
    <div className="chat-list" data-test="chat-list">
      {dayGroups(messages).map((g) => (
        <Fragment key={g.day}>
          <div className="chat-day mono">{dateLbl(g.day)}</div>
          {g.items.map((m, i) => {
            const mine = isMine(m.sender_id)
            const prev = g.items[i - 1]
            const next = g.items[i + 1]
            // 같은 사람이 이어 보낸 묶음의 첫 메시지
            const first = !prev || prev.sender_id !== m.sender_id
            const who = first && label ? label(m.sender_id) : ''
            const time = chatTime(m.created_at)
            // 같은 사람이 같은 분에 이어 보낸 메시지는 마지막에만 시간을 붙인다
            const showTime = !next || next.sender_id !== m.sender_id || chatTime(next.created_at) !== time
            return (
              <div key={m.id} className={`chat-msg${mine ? ' mine' : ''}${first ? ' first' : ''}`} data-test="chat-msg" data-mine={mine ? '1' : '0'}>
                {who && <div className="chat-who">{who}</div>}
                <div className="chat-line">
                  <div className="chat-bubble">
                    <Body body={m.body} origin={origin} onPath={onPath} />
                  </div>
                  {showTime && <span className="chat-time mono">{time}</span>}
                </div>
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

export function RoomItem({
  name,
  badge,
  badgeBg,
  avatarUrl,
  note,
  preview,
  time,
  unread,
  onClick,
}: {
  name: string
  badge?: string | null
  badgeBg?: string
  avatarUrl?: string | null
  // 대화를 시작한 글의 제목
  note?: string | null
  preview: string
  time: string
  unread: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" className="list-row chat-room" data-test="chat-room" data-unread={unread ? '1' : '0'} onClick={onClick}>
      <Avatar name={name} url={avatarUrl} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>
            {name}
          </span>
          {badge && (
            <span className="tag dark" style={{ background: badgeBg }}>
              {badge}
            </span>
          )}
        </div>
        {note && (
          <div className="ellipsis" style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)' }}>
            {note}
          </div>
        )}
        <div className="ellipsis" style={{ fontSize: 13, color: unread ? 'var(--ink)' : 'var(--muted)', fontWeight: unread ? 600 : 400 }}>
          {preview}
        </div>
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>
          {time}
        </span>
        {unread && <span className="chat-dot" role="img" aria-label="안 읽음" />}
      </div>
    </button>
  )
}
