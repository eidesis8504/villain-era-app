// 등급(Hz)의 서버 호출. 규칙은 lib/tier.ts, 점수 계산은 마이그레이션 tier
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../app/auth'
import { errMsg, supabase } from '../lib/supabase'
import { parseTier } from '../lib/tier'

// 내 점수와 항목별 내역. 부를 때마다 서버가 지금 값으로 다시 계산한다(내 프로필의 hz도 함께 고친다)
export function useMyTier() {
  const { uid } = useAuth()
  return useQuery({
    queryKey: ['my-tier', uid],
    enabled: !!uid,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_tier')
      if (error) throw new Error(errMsg(error, '등급을 불러오지 못했어요'))
      return parseTier(data)
    },
  })
}
