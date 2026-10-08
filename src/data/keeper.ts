// 사육 데이터(개체·체중·산란·혈통·할 일) 조회와 파생 계산
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useAuth } from '../app/auth'
import type { Tables } from '../lib/database.types'
import { addD, today } from '../lib/date'
import { round1 } from '../lib/format'
import { Lineage } from '../lib/lineage'
import { supabase } from '../lib/supabase'

export type Animal = Tables<'animals'>
export type Weight = { id: number; animal_id: string; measured_on: string; grams: number }
export type Clutch = Tables<'clutches'>
export type Breeder = Tables<'breeders'>
export type Todo = Tables<'todos'>
export type Check = { todo_id: string; day: string }
export type Transfer = Tables<'transfers'> & { claimer: { nickname: string | null } | null }
export type Origin = {
  from?: string
  transfer_code?: string
  received_on?: string
  original_code?: string
  items?: string
  clutches?: { n: number; eggs: number; fert: number; hatched: number; dead: number } | null
}

type Res<T> = PromiseLike<{ data: T[] | null; error: unknown }>

// PostgREST는 한 번에 최대 1000행 — 넘으면 이어서 받는다
export async function fetchAll<T>(build: (from: number, to: number) => Res<T>): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}

const EMPTY: never[] = []

export function useAnimals() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['animals', uid],
    enabled: !!uid,
    queryFn: () => fetchAll<Animal>((f, t) => supabase.from('animals').select('*').order('code').range(f, t)),
  })
}

export function useWeights() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['weights', uid],
    enabled: !!uid,
    queryFn: async () =>
      (
        await fetchAll<Weight>((f, t) =>
          supabase.from('weights').select('id, animal_id, measured_on, grams').order('measured_on').range(f, t),
        )
      ).map((w) => ({ ...w, grams: Number(w.grams) })),
  })
}

export function useClutches() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['clutches', uid],
    enabled: !!uid,
    queryFn: () => fetchAll<Clutch>((f, t) => supabase.from('clutches').select('*').order('laid_on').range(f, t)),
  })
}

export function useBreeders() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['breeders', uid],
    enabled: !!uid,
    queryFn: () => fetchAll<Breeder>((f, t) => supabase.from('breeders').select('*').order('created_at').range(f, t)),
  })
}

export function useTodos() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['todos', uid],
    enabled: !!uid,
    queryFn: () => fetchAll<Todo>((f, t) => supabase.from('todos').select('*').order('time_of_day').range(f, t)),
  })
}

// 최근 일주일 + 내일까지의 완료 체크
export function useChecks() {
  const { uid } = useAuth()
  const T = today()
  return useQuery({
    queryKey: ['checks', uid, T],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todo_checks')
        .select('todo_id, day')
        .gte('day', addD(T, -7))
        .lte('day', addD(T, 1))
      if (error) throw error
      return data as Check[]
    },
  })
}

export function useTransfers() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['transfers', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transfers')
        .select('*, claimer:profiles!transfers_claimed_by_fkey(nickname)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Transfer[]
    },
  })
}

export type LastW = { date: string; g: number; diff: number | null; prev: Weight | null }

export function useKeeper() {
  const { profile } = useAuth()
  const a = useAnimals()
  const w = useWeights()
  const c = useClutches()
  const b = useBreeders()
  const animals = a.data ?? EMPTY
  const weights = w.data ?? EMPTY
  const clutches = c.data ?? EMPTY
  const breeders = b.data ?? EMPTY
  const loading = a.isLoading || w.isLoading || c.isLoading || b.isLoading
  const error = a.error || w.error || c.error || b.error

  const derived = useMemo(() => {
    const byId = new Map(animals.map((x) => [x.id, x]))
    const byCode = new Map(animals.map((x) => [x.code, x]))
    const wBy = new Map<string, Weight[]>()
    for (const r of weights) {
      const list = wBy.get(r.animal_id)
      if (list) list.push(r)
      else wBy.set(r.animal_id, [r])
    }
    for (const list of wBy.values()) list.sort((x, y) => (x.measured_on < y.measured_on ? -1 : 1))
    const hatchedBy = new Map<string, Animal[]>()
    for (const x of animals) {
      if (!x.clutch_id) continue
      const list = hatchedBy.get(x.clutch_id)
      if (list) list.push(x)
      else hatchedBy.set(x.clutch_id, [x])
    }
    const lineage = new Lineage(animals)
    const A = (id?: string | null) => (id ? (byId.get(id) ?? null) : null)
    const ws = (id: string) => wBy.get(id) ?? []
    const lastW = (id: string): LastW | null => {
      const list = ws(id)
      if (!list.length) return null
      const l = list[list.length - 1]
      const p = list[list.length - 2] ?? null
      return { date: l.measured_on, g: l.grams, diff: p ? round1(l.grams - p.grams) : null, prev: p }
    }
    const hatched = (cl: Clutch) => hatchedBy.get(cl.id) ?? []
    const incub = (cl: Clutch) => Math.max(0, cl.fertile - hatched(cl).length - cl.dead)
    return {
      byId,
      byCode,
      A,
      ws,
      lastW,
      hatched,
      incub,
      lineage,
      owned: animals.filter((x) => x.status === 'keeping'),
    }
  }, [animals, weights])

  return {
    loading,
    error,
    animals,
    weights,
    clutches,
    breeders,
    coiLimit: Number(profile?.coi_limit ?? 6.25),
    ...derived,
  }
}

export type Keeper = ReturnType<typeof useKeeper>

// 저장 후 관련 목록을 다시 불러온다
export function useRefresh() {
  const qc = useQueryClient()
  return useCallback(
    (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
    [qc],
  )
}

// 클라이언트에서 새 개체 ID 생성 (VE- + 영문 대문자·숫자 10자리, 둘 다 1개 이상)
export function newAnimalCode(used: Set<string>) {
  const C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const b = new Uint32Array(10)
  for (;;) {
    crypto.getRandomValues(b)
    const s = Array.from(b, (v) => C[v % 36]).join('')
    const code = 'VE-' + s
    if (/[A-Z]/.test(s) && /\d/.test(s) && !used.has(code)) return code
  }
}
