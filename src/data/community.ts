// 커뮤니티 · 공지 · 알림 조회
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import type { Tables } from '../lib/database.types'
import { supabase } from '../lib/supabase'

export type Author = { id: string; nickname: string | null; role: string; badge: string | null; avatar_url: string | null }
export type MediaItem = { t: 'img' | 'vid'; path: string; thumb?: string; dur?: number }
export type Attach =
  | { kind: 'weight'; label: string; last: string; diff: string; pts: number[]; count: number }
  | { kind: 'clutch'; label: string; n: number; eggs: number; fert: number; hatched: number; dead: number }
  | { kind: 'line'; label: string; sire: string; dam: string; coi: string }
export type Post = Omit<Tables<'posts'>, 'media' | 'attach'> & {
  media: MediaItem[]
  attach: Attach | null
  author: Author | null
}
export type Comment = Tables<'comments'> & { author: Author | null }
export type Notice = Tables<'notices'>
export type Notification = Tables<'notifications'>

const AUTHOR = 'author:profiles!posts_author_id_fkey(id, nickname, role, badge, avatar_url)'
export const CATS = ['자유', 'Q&A', '정보', '사육일지'] as const

export function usePosts(cat: string) {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['posts', uid, cat],
    enabled: !!uid,
    queryFn: async () => {
      let q = supabase.from('posts').select(`*, ${AUTHOR}`).order('created_at', { ascending: false }).limit(100)
      if (cat !== '전체') q = q.eq('cat', cat)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as Post[]
    },
  })
}

export function usePopularPosts() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['posts', uid, 'popular'],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, ${AUTHOR}`)
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return data as unknown as Post[]
    },
  })
}

export function usePost(id: string | undefined) {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['post', id],
    enabled: !!uid && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('posts').select(`*, ${AUTHOR}`).eq('id', id!).maybeSingle()
      if (error) throw error
      return data as unknown as Post | null
    },
  })
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: ['comments', postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!comments_author_id_fkey(id, nickname, role, badge, avatar_url)')
        .eq('post_id', postId!)
        .order('created_at')
      if (error) throw error
      return data as unknown as Comment[]
    },
  })
}

export function useLiked(postId: string | undefined) {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['liked', postId, uid],
    enabled: !!postId && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('likes')
        .select('post_id')
        .eq('post_id', postId!)
        .eq('user_id', uid!)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })
}

export function useMyPostCount() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['posts', uid, 'mine-count'],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', uid!)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useNotices() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['notices', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(30)
      if (error) throw error
      return data
    },
  })
}

export function useNotifications() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['notifications', uid],
    enabled: !!uid,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('id', { ascending: false })
        .limit(60)
      if (error) throw error
      return data
    },
  })
}

export function badgeColor(badge: string | null | undefined) {
  return badge === '전문가' || badge === '운영자' ? 'var(--ink)' : 'var(--blue)'
}
