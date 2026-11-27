// 채팅(1:1 대화 · 운영자 문의)의 서버 호출. 규칙은 lib/chat.ts, 서버 쪽은 마이그레이션 chat
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../app/auth'
import { mergeMessage, unreadCount, type ChatMessage, type ChatRoom } from '../lib/chat'
import { errMsg, supabase } from '../lib/supabase'
import type { ReportReason } from './safety'

export type Peer = { id: string; nickname: string | null; role: string; badge: string | null; avatar_url: string | null }
export type RoomRow = ChatRoom & { a: Peer | null; b: Peer | null; post: { id: string; title: string } | null }

const PEER = 'id, nickname, role, badge, avatar_url'
const ROOM =
  'id, kind, user_a, user_b, post_id, created_at, last_message_at, last_message, last_sender, a_read_at, b_read_at, ' +
  `a:profiles!chat_rooms_user_a_fkey(${PEER}), b:profiles!chat_rooms_user_b_fkey(${PEER}), post:posts!chat_rooms_post_id_fkey(id, title)`

// 내가 보는 상대: 1:1 대화의 상대, 운영자가 보는 문의방의 회원. 내 문의방에서는 null(상대는 '운영자')
export const peerOf = (r: RoomRow, me: string): Peer | null => (r.user_a === me ? r.b : r.a)

// 내 1:1 대화 목록. 메시지가 하나도 없는 방은 빼고, 최근 대화가 위로
export function useRooms() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['chat-rooms', uid],
    enabled: !!uid,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(ROOM)
        .eq('kind', 'dm')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as unknown as RoomRow[]
    },
  })
}

// 안 읽은 1:1 대화 수 (하단 탭·왼쪽 메뉴의 숫자)
export function useChatUnread(): number {
  const { uid } = useAuth()
  const rooms = useRooms()
  return uid && rooms.data ? unreadCount(rooms.data, uid) : 0
}

export function useRoom(id: string | undefined) {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['chat-room', id],
    enabled: !!uid && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('chat_rooms').select(ROOM).eq('id', id!).maybeSingle()
      if (error) throw error
      return data as unknown as RoomRow | null
    },
  })
}

// 내 운영자 문의방 (없으면 만든다 — 같은 회원에게는 언제나 같은 방)
export function useSupportRoomId() {
  const { uid } = useAuth()
  return useQuery({ queryKey: ['chat-support-id', uid], enabled: !!uid, staleTime: Infinity, queryFn: openSupport })
}

// 운영자: 문의가 온 방 목록 (운영자 자신이 남긴 문의는 다른 운영자의 문의함에만 보인다)
export function useSupportRooms(enabled: boolean) {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['chat-support-rooms', uid],
    enabled: enabled && !!uid,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(ROOM)
        .eq('kind', 'support')
        .neq('user_a', uid!)
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as unknown as RoomRow[]
    },
  })
}

let channelSeq = 0

// 최근 메시지 200개. 열려 있는 동안 새 메시지를 실시간으로 받고, 연결이 끊겼을 때를 대비해 20초마다 다시 읽는다
export function useMessages(roomId: string | undefined) {
  const { uid } = useAuth()
  const qc = useQueryClient()
  useEffect(() => {
    if (!uid || !roomId) return
    // 채널 이름은 매번 새로: 같은 이름을 다시 쓰면 이미 구독한 채널이 돌아와 on()이 실패한다
    const ch = supabase
      .channel(`chat-${roomId}-${++channelSeq}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (p) =>
        qc.setQueryData<ChatMessage[]>(['chat-messages', roomId], (old) => mergeMessage(old, p.new as ChatMessage)),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [uid, roomId, qc])
  return useQuery({
    queryKey: ['chat-messages', roomId],
    enabled: !!uid && !!roomId,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_id, body, created_at')
        .eq('room_id', roomId!)
        .order('id', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data as ChatMessage[]).reverse()
    },
  })
}

export async function openDm(userId: string, postId?: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('open_dm', { p_user: userId, p_post: postId ?? null })
  if (error || !data) throw new Error(errMsg(error, '대화를 시작하지 못했어요'))
  return data
}

export async function openSupport(): Promise<string> {
  const { data, error } = await supabase.rpc('open_support')
  if (error || !data) throw new Error(errMsg(error, '문의를 열지 못했어요'))
  return data
}

export async function sendMessage(roomId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc('send_message', { p_room: roomId, p_body: body })
  if (error || !data) throw new Error(errMsg(error, '메시지를 보내지 못했어요'))
  return data
}

export async function markRoomRead(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_room_read', { p_room: roomId })
  if (error) throw new Error(errMsg(error, '읽음 표시를 하지 못했어요'))
}

export async function reportChat(roomId: string, reason: ReportReason, note = ''): Promise<void> {
  const { error } = await supabase.rpc('report_chat', { p_room: roomId, p_reason: reason, p_note: note.slice(0, 300) })
  if (error) throw new Error(errMsg(error, '신고하지 못했어요'))
}
