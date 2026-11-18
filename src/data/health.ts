// 건강 일지·진료 기록 조회와 비공개 사진 주소
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import type { HealthLog, VetVisit } from '../lib/health'
import { signedUrls, supabase } from '../lib/supabase'
import { fetchAll } from './keeper'

export function useHealthLogs() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['health_logs', uid],
    enabled: !!uid,
    queryFn: () =>
      fetchAll((f, t) =>
        supabase
          .from('health_logs')
          .select('id, animal_id, logged_on, area, level, note, photos, resolved_on')
          .order('logged_on')
          .order('id')
          .range(f, t),
      ) as Promise<HealthLog[]>,
  })
}

export function useVetVisits() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['vet_visits', uid],
    enabled: !!uid,
    queryFn: () =>
      fetchAll((f, t) =>
        supabase
          .from('vet_visits')
          .select('id, animal_id, visited_on, clinic, diagnosis, treatment, cost, next_visit')
          .order('visited_on')
          .order('id')
          .range(f, t),
      ) as Promise<VetVisit[]>,
  })
}

// 증상 사진(비공개) 서명 주소 — 55분 동안 재사용
export function useHealthPhotoUrls(paths: string[]) {
  const key = [...paths].sort().join('|')
  return useQuery({
    queryKey: ['health_photo_urls', key],
    enabled: paths.length > 0,
    staleTime: 55 * 60_000,
    queryFn: () => signedUrls('health-photos', paths),
  })
}
