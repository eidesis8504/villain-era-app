// 운영자 전용: 검증 현황 집계, 의견·설문·오류·신고 목록, 신고 처리
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import { supabase } from '../lib/supabase'

type Rate = number | null
export type AdminMetrics = {
  launch_on: string
  today: string
  targets: { activation: number; d7: number; feeding30: number }
  funnel: { landing: number; started: number; activated: number; activation_rate: Rate }
  active: { d1: number; d7: number; d30: number }
  retention: Record<'d1' | 'd7' | 'd30', { eligible: number; returned: number; rate: Rate }>
  features: { key: string; label: string; users: number; rate: Rate }[]
  sources: { source: string; users: number; activated: number; d7_rate: Rate }[]
  platforms: { platform: string; users: number; standalone_users: number }[]
  research: {
    feeding: { users30: number; rate30: Rate; reuse_rate: Rate }
    breeding: { breeder_users: number; recorded_users: number; rate: Rate }
    health: { users30: number; rate30: Rate }
    consult: { qa_with_card: number; adopted_with_card: number; qa_without_card: number; adopted_without_card: number }
  }
  daily: { day: string; new_users: number; active_users: number }[]
  feedback: { new: number; total: number }
  survey: { responses: number; promoters: number; passives: number; detractors: number; nps: Rate }
  errors: { last7: number; top: { message: string; count: number }[] }
  reports: { open: number }
}

export function useAdminMetrics() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['admin_metrics'],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_metrics')
      if (error) throw error
      return data as unknown as AdminMetrics
    },
  })
}

export type FeedbackRow = { id: number; kind: string; body: string; path: string; app_version: string; status: string; created_at: string }
export function useAdminFeedback() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['admin_feedback'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, kind, body, path, app_version, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as FeedbackRow[]
    },
  })
}

export type SurveyRow = { user_id: string; nps: number; best_feature: string; wish: string; created_at: string }
export function useAdminSurveys() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['admin_surveys'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('user_id, nps, best_feature, wish, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return data as SurveyRow[]
    },
  })
}

export type ErrorRow = { id: number; message: string; stack: string; path: string; app_version: string; ua: string; created_at: string }
export function useAdminErrors() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['admin_errors'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_errors')
        .select('id, message, stack, path, app_version, ua, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as ErrorRow[]
    },
  })
}

export type ReportRow = {
  id: number
  target_kind: 'post' | 'comment' | 'user' | 'chat'
  target_id: string
  target_user: string | null
  reason: string
  note: string
  created_at: string
  preview: string
  who: string
}

// 열린 신고 + 대상 미리보기(글 제목·댓글 내용·회원 닉네임). 대화 신고는 내용을 목록에 싣지 않는다
export function useAdminReports() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['admin_reports'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, target_kind, target_id, target_user, reason, note, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      const rows = (data ?? []) as Omit<ReportRow, 'preview' | 'who'>[]
      const ids = (k: string) => [...new Set(rows.filter((r) => r.target_kind === k).map((r) => r.target_id))]
      const users = [...new Set(rows.map((r) => r.target_user).filter((x): x is string => !!x))]
      const [posts, comments, profiles] = await Promise.all([
        ids('post').length ? supabase.from('posts').select('id, title').in('id', ids('post')) : Promise.resolve({ data: [] }),
        ids('comment').length ? supabase.from('comments').select('id, body').in('id', ids('comment')) : Promise.resolve({ data: [] }),
        users.length ? supabase.from('profiles').select('id, nickname').in('id', users) : Promise.resolve({ data: [] }),
      ])
      const title = new Map((posts.data ?? []).map((p: { id: string; title: string }) => [p.id, p.title]))
      const body = new Map((comments.data ?? []).map((c: { id: string; body: string }) => [c.id, c.body]))
      const nick = new Map((profiles.data ?? []).map((p: { id: string; nickname: string | null }) => [p.id, p.nickname ?? '회원']))
      return rows.map((r) => ({
        ...r,
        who: (r.target_user && nick.get(r.target_user)) || '회원',
        preview:
          r.target_kind === 'post'
            ? (title.get(r.target_id) ?? '(삭제된 글)')
            : r.target_kind === 'comment'
              ? (body.get(r.target_id) ?? '(삭제된 댓글)')
              : r.target_kind === 'chat'
                ? '1:1 대화 신고 · ‘대화 보기’로 내용을 확인해 주세요'
                : `회원 ${(r.target_user && nick.get(r.target_user)) || ''}`,
      })) as ReportRow[]
    },
  })
}

export type ModerateAction = 'hide' | 'unhide' | 'delete' | 'dismiss' | 'block_user'
export async function moderate(reportId: number, action: ModerateAction) {
  const { error } = await supabase.rpc('admin_moderate', { p_report: reportId, p_action: action })
  if (error) throw error
}
