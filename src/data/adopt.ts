// 분양 이력서와 분양 글의 서버 호출
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import type { AdoptStatus } from '../lib/adopt'
import type { Resume } from '../lib/resume'
import { errMsg, supabase } from '../lib/supabase'

// 이력서 보기: 계정이 없어도 부를 수 있다. 꺼졌거나 없는 토큰이면 null
export function useResume(token: string | null) {
  return useQuery({
    queryKey: ['resume', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_resume', { p_token: token! })
      if (error) throw new Error(errMsg(error, '이력서를 불러오지 못했어요'))
      return data as unknown as Resume | null
    },
  })
}

// 내 개체의 살아 있는 이력서 토큰 (개체 ID → 토큰)
export function useMyShares() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['shares', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('animal_shares').select('animal_id, token').is('revoked_at', null)
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.animal_id, r.token]))
    },
  })
}

export async function shareAnimal(animalId: string): Promise<string> {
  const { data, error } = await supabase.rpc('share_animal', { p_animal: animalId })
  if (error || !data) throw new Error(errMsg(error, '이력서 링크를 만들지 못했어요'))
  return data
}

export async function unshareAnimal(animalId: string): Promise<void> {
  const { error } = await supabase.rpc('unshare_animal', { p_animal: animalId })
  if (error) throw new Error(errMsg(error, '이력서 링크를 끄지 못했어요'))
}

export async function setAdoptStatus(postId: string, status: AdoptStatus): Promise<void> {
  const { error } = await supabase.rpc('set_adopt_status', { p_post: postId, p_status: status })
  if (error) throw new Error(errMsg(error, '분양 상태를 바꾸지 못했어요'))
}
