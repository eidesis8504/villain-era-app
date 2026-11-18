// 계정과 기록 삭제: 사용자 세션으로 본인 폴더 파일을 모두 지운 뒤, 서버 함수로 계정을 지운다.
// (서버 함수는 파일이 하나라도 남아 있으면 거부한다 → 공개 주소로 열리는 파일이 남지 않음)
import { supabase } from './supabase'

const BUCKETS = ['avatars', 'animal-photos', 'post-media', 'health-photos'] as const
const PAGE = 100

async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset })
    if (error) {
      if (/not found/i.test(error.message)) return out // 아직 없는 버킷
      throw error
    }
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`
      // 폴더는 id가 없다
      if (item.id === null) out.push(...(await listAll(bucket, path)))
      else out.push(path)
    }
    if (!data || data.length < PAGE) return out
  }
}

export async function removeAllMyFiles(uid: string) {
  for (const bucket of BUCKETS) {
    const paths = await listAll(bucket, uid)
    for (let i = 0; i < paths.length; i += PAGE) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + PAGE))
      if (error) throw error
    }
  }
}

export async function deleteMyAccount(uid: string) {
  await removeAllMyFiles(uid)
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  // 서버 계정은 이미 지워졌으므로 이 기기의 세션만 정리한다 → 환영 화면으로 돌아감
  await supabase.auth.signOut({ scope: 'local' })
}
