// 번식 사이클: 메이팅·알 상태 기록 조회
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import type { EggCheck, Mating } from '../lib/breeding'
import { supabase } from '../lib/supabase'
import { fetchAll } from './keeper'

export function useMatings() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['matings', uid],
    enabled: !!uid,
    queryFn: () =>
      fetchAll((f, t) =>
        supabase.from('matings').select('id, female_id, male_id, paired_on, locked, note').order('paired_on').range(f, t),
      ) as Promise<Mating[]>,
  })
}

export function useEggChecks() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['egg_checks', uid],
    enabled: !!uid,
    queryFn: () =>
      fetchAll((f, t) =>
        supabase.from('egg_checks').select('id, clutch_id, checked_on, status, count, photo_path, note').order('checked_on').order('id').range(f, t),
      ) as Promise<EggCheck[]>,
  })
}
