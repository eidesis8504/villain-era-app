// 화면에서 바로 반영되어야 하는 저장 동작 (낙관적 업데이트)
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import { useUI } from '../app/ui'
import { errMsg, supabase } from '../lib/supabase'
import type { Check } from './keeper'

export function useToggleCheck() {
  const qc = useQueryClient()
  const { uid } = useAuth()
  const ui = useUI()
  return useMutation({
    mutationFn: async ({ todoId, day, on }: { todoId: string; day: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from('todo_checks').insert({ todo_id: todoId, day })
        if (error && error.code !== '23505') throw error
      } else {
        const { error } = await supabase.from('todo_checks').delete().eq('todo_id', todoId).eq('day', day)
        if (error) throw error
      }
    },
    onMutate: async ({ todoId, day, on }) => {
      const keys = qc.getQueryCache().findAll({ queryKey: ['checks', uid] }).map((q) => q.queryKey)
      await Promise.all(keys.map((key) => qc.cancelQueries({ queryKey: key })))
      const prev = keys.map((key) => [key, qc.getQueryData<Check[]>(key)] as const)
      for (const key of keys) {
        qc.setQueryData<Check[]>(key, (old = []) =>
          on ? [...old, { todo_id: todoId, day }] : old.filter((c) => !(c.todo_id === todoId && c.day === day)),
        )
      }
      return { prev }
    },
    onError: (e, _v, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data))
      ui.toast(errMsg(e, '체크를 저장하지 못했어요'), 'warn')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['checks'] }),
  })
}

export function useToggleLike(postId: string) {
  const qc = useQueryClient()
  const { uid } = useAuth()
  const ui = useUI()
  return useMutation({
    mutationFn: async (liked: boolean) => {
      if (liked) {
        const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', uid!)
        if (error) throw error
      } else {
        const { error } = await supabase.from('likes').insert({ post_id: postId })
        if (error && error.code !== '23505') throw error
      }
    },
    onMutate: async (liked) => {
      const key = ['liked', postId, uid]
      await qc.cancelQueries({ queryKey: key })
      qc.setQueryData(key, !liked)
      qc.setQueryData(['post', postId], (p: { like_count: number } | undefined) =>
        p ? { ...p, like_count: Math.max(0, p.like_count + (liked ? -1 : 1)) } : p,
      )
      return { liked }
    },
    onError: (e, _v, ctx) => {
      if (ctx) qc.setQueryData(['liked', postId, uid], ctx.liked)
      ui.toast(errMsg(e, '좋아요를 저장하지 못했어요'), 'warn')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] })
      qc.invalidateQueries({ queryKey: ['liked', postId] })
      qc.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
