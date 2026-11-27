// 채팅 화면: 대화 목록(/chat), 1:1 대화(/chat/:id)와 함께 쓰는 대화 틀(ChatThread)
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { badgeOf, displayName, useMe } from '../app/auth'
import { useViewport } from '../app/layout'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { markRoomRead, peerOf, sendMessage, useMessages, useRoom, useRooms } from '../data/chat'
import { badgeColor } from '../data/community'
import { useRefresh } from '../data/keeper'
import { NOT_A_PARTY } from '../lib/adopt'
import { canSend, CHAT_MAX, CHAT_SAFETY, isUnread, mergeMessage, previewText, type ChatMessage } from '../lib/chat'
import { relTime } from '../lib/date'
import { errMsg } from '../lib/supabase'
import { ErrorBox, Spinner } from '../ui/kit'
import { MessageList, RoomItem } from './ChatViews'
import { ContentMenu } from './ReportSheet'

const NONE: ChatMessage[] = []

// 대화 하나의 화면 틀: 위쪽 안내, 메시지, 입력 칸.
// 방이 바뀌면 쓰던 글과 읽음 표시가 섞이지 않게 key={roomId}로 쓴다.
export function ChatThread({
  roomId,
  title,
  back,
  right,
  top,
  isMine,
  label,
  readOnly,
  placeholder = '메시지를 입력하세요',
}: {
  roomId: string
  title: string
  back: string
  right?: { label: string; onClick: () => void; test?: string }
  top?: ReactNode
  isMine: (senderId: string) => boolean
  label?: (senderId: string) => string
  // 읽기만 (운영자가 신고된 대화를 볼 때)
  readOnly?: boolean
  placeholder?: string
}) {
  const nav = useNavigate()
  const ui = useUI()
  const qc = useQueryClient()
  const refresh = useRefresh()
  const { desk } = useViewport()
  const q = useMessages(roomId)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const marked = useRef(0)
  const list = q.data ?? NONE
  const lastId = list[list.length - 1]?.id ?? 0
  // 상대가 보낸 마지막 메시지의 번호
  const lastOther = list.findLast((m) => !isMine(m.sender_id))?.id ?? 0

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    if (lastId) endRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  // 상대의 새 메시지를 화면에서 봤으면 읽음 처리 (화면이 가려져 있었으면 다시 보일 때)
  useEffect(() => {
    if (readOnly || !lastOther) return
    const mark = () => {
      if (document.visibilityState !== 'visible' || marked.current >= lastOther) return
      marked.current = lastOther
      markRoomRead(roomId).then(
        () => refresh('chat-rooms', 'chat-support-rooms', 'chat-room'),
        () => {
          marked.current = 0
        },
      )
    }
    mark()
    document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
  }, [readOnly, lastOther, roomId, refresh])

  const send = async () => {
    if (busy || !canSend(text)) return
    setBusy(true)
    try {
      const m = await sendMessage(roomId, text)
      qc.setQueryData<ChatMessage[]>(['chat-messages', roomId], (old) => mergeMessage(old, m))
      setText('')
      if (inputRef.current) inputRef.current.style.height = ''
      void refresh('chat-rooms', 'chat-support-rooms')
    } catch (e) {
      ui.toast(errMsg(e, '메시지를 보내지 못했어요'), 'warn')
    } finally {
      setBusy(false)
    }
  }

  const composer = (
    <div className="chat-compose">
      <textarea
        ref={inputRef}
        className="input chat-input"
        data-test="chat-input"
        rows={1}
        value={text}
        maxLength={CHAT_MAX}
        placeholder={placeholder}
        aria-label="메시지"
        onChange={(e) => {
          setText(e.target.value)
          // 내용에 맞춰 높이를 늘린다 (가장 큰 높이는 CSS가 정한다)
          e.target.style.height = 'auto'
          e.target.style.height = `${e.target.scrollHeight + 2}px`
        }}
        onKeyDown={(e) => {
          // PC에서는 Enter로 보내고 Shift+Enter로 줄을 바꾼다 (휴대폰에서는 보내기 버튼)
          if (desk && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            void send()
          }
        }}
      />
      <button
        type="button"
        data-test="chat-send"
        className={`btn btn-primary${canSend(text) ? '' : ' off'}`}
        style={{ width: 64, height: 46, fontSize: 14, flex: 'none' }}
        onClick={send}
        disabled={busy}
      >
        보내기
      </button>
    </div>
  )

  return (
    <Screen title={title} back={back} right={right} footer={readOnly ? undefined : composer}>
      <div className="chat-page">
        {top}
        {q.isLoading && <Spinner center />}
        {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
        {q.data && <MessageList messages={list} isMine={isMine} origin={window.location.origin} onPath={(p) => nav(p)} label={label} />}
        <div ref={endRef} />
      </div>
    </Screen>
  )
}

export function ChatListPage() {
  const { uid } = useMe()
  const nav = useNavigate()
  const q = useRooms()
  const rooms = q.data ?? []
  return (
    <Screen title="채팅">
      <div className="page" style={{ gap: 10 }}>
        {q.isLoading && <Spinner center />}
        {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
        {q.data && !rooms.length && (
          <div className="empty-card" data-test="chat-none">
            <div style={{ fontSize: 15, fontWeight: 700 }}>아직 대화가 없어요</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              분양·홍보 글의 ‘채팅으로 문의’나 글·댓글의 ⋯ 메뉴에서 대화를 시작할 수 있어요
            </div>
            <button type="button" className="btn btn-primary btn-sm" style={{ padding: '0 18px' }} onClick={() => nav('/community')}>
              커뮤니티 보기
            </button>
          </div>
        )}
        {rooms.length > 0 && (
          <div className="list-card" data-test="chat-rooms">
            {rooms.map((r) => {
              const p = peerOf(r, uid)
              const badge = badgeOf(p)
              return (
                <RoomItem
                  key={r.id}
                  name={displayName(p)}
                  badge={badge}
                  badgeBg={badgeColor(badge)}
                  avatarUrl={p?.avatar_url}
                  note={r.post?.title}
                  preview={previewText(r)}
                  time={r.last_message_at ? relTime(r.last_message_at) : ''}
                  unread={isUnread(r, uid)}
                  onClick={() => nav(`/chat/${r.id}`)}
                />
              )
            })}
          </div>
        )}
        <div className="hint" style={{ textAlign: 'center' }}>
          운영자에게 문의하려면 전체 › 도움말·문의
        </div>
      </div>
    </Screen>
  )
}

export function ChatRoomPage() {
  const { id = '' } = useParams()
  const { uid } = useMe()
  const nav = useNavigate()
  const q = useRoom(id)
  const [menu, setMenu] = useState(false)

  if (q.isLoading) return <Screen title="채팅" back="/chat"><Spinner center /></Screen>
  if (q.error) return <Screen title="채팅" back="/chat"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></Screen>
  const r = q.data
  const peer = r ? peerOf(r, uid) : null
  // 내 1:1 대화만 여기서 연다 (운영자 문의와 신고된 대화는 각자의 화면에서)
  if (!r || !peer || r.kind !== 'dm' || (r.user_a !== uid && r.user_b !== uid)) {
    return (
      <Screen title="채팅" back="/chat">
        <div className="empty" data-test="chat-missing" style={{ padding: '30px 18px', lineHeight: 1.6 }}>
          없는 대화예요 · 상대가 계정을 지웠거나 내가 차단한 회원일 수 있어요
        </div>
      </Screen>
    )
  }
  const name = displayName(peer)
  return (
    <>
      <ChatThread
        key={r.id}
        roomId={r.id}
        title={name}
        back="/chat"
        right={{ label: '메뉴', onClick: () => setMenu(true), test: 'chat-menu' }}
        isMine={(s) => s === uid}
        top={
          <>
            {r.post && (
              <Link to={`/community/${r.post.id}`} className="chat-post" data-test="chat-post">
                <span className="tag">글</span>
                <span className="ellipsis" style={{ flex: 1, minWidth: 0 }}>
                  {r.post.title}
                </span>
                <span style={{ color: 'var(--muted-2)' }}>›</span>
              </Link>
            )}
            <div className="hint chat-safety" data-test="chat-safety">
              {CHAT_SAFETY} {NOT_A_PARTY}
            </div>
          </>
        }
      />
      {menu && (
        <ContentMenu
          target={{ kind: 'chat', id: r.id, authorId: peer.id, authorName: name }}
          mine={false}
          canDelete={false}
          onBlocked={() => nav('/chat', { replace: true })}
          onClose={() => setMenu(false)}
        />
      )}
    </>
  )
}
