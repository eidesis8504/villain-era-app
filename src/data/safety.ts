// 커뮤니티 안전장치: 신고·차단 (서버 규칙은 마이그레이션 community_safety)
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import { supabase } from '../lib/supabase'

export type ReportReason = 'spam' | 'abuse' | 'sexual' | 'illegal' | 'privacy' | 'other'
export type ReportKind = 'post' | 'comment' | 'user'

export const REPORT_REASONS: readonly (readonly [ReportReason, string])[] = [
  ['spam', '스팸·홍보'],
  ['abuse', '욕설·비하'],
  ['sexual', '음란·불쾌'],
  ['illegal', '불법 거래·학대'],
  ['privacy', '개인정보 노출'],
  ['other', '기타'],
]

export async function reportContent(kind: ReportKind, id: string, reason: ReportReason, note = '') {
  const { error } = await supabase.rpc('report_content', { p_kind: kind, p_id: id, p_reason: reason, p_note: note.slice(0, 300) })
  if (error) throw error
}

export async function blockUser(id: string) {
  const { error } = await supabase.from('blocks').insert({ blocked_id: id })
  if (error && error.code !== '23505') throw error
}

export async function unblockUser(me: string, id: string) {
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', id)
  if (error) throw error
}

export type Blocked = { blocked_id: string; created_at: string; nickname: string | null }

export function useBlocks() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['blocks', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id, created_at, who:profiles!blocks_blocked_id_fkey(nickname)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as { blocked_id: string; created_at: string; who: { nickname: string | null } | null }[]).map(
        (b) => ({ blocked_id: b.blocked_id, created_at: b.created_at, nickname: b.who?.nickname ?? null }),
      ) as Blocked[]
    },
  })
}
