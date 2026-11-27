import { describe, expect, it } from 'vitest'
import { viewName } from './track'

describe('viewName', () => {
  it('기록이 남지 않는 화면을 사용 흔적 이름으로 바꾼다', () => {
    expect(viewName('/lineage')).toBe('view:lineage')
    expect(viewName('/animals/abc/lineage')).toBe('view:lineage')
    expect(viewName('/scan')).toBe('view:scan')
    expect(viewName('/community')).toBe('view:community')
    expect(viewName('/community/123')).toBe('view:community')
    expect(viewName('/animals/abc/consult')).toBe('view:consult')
    expect(viewName('/feedings')).toBe('view:feeding_bulk')
  })
  it('채팅 목록과 대화 화면은 채팅 보기로 센다', () => {
    expect(viewName('/chat')).toBe('view:chat')
    expect(viewName('/chat/0b0e7b1c-1111-4222-8333-444455556666')).toBe('view:chat')
    expect(viewName('/chat/a/b')).toBeNull()
  })
  it('글쓰기·기타 화면은 기록하지 않는다', () => {
    expect(viewName('/')).toBeNull()
    expect(viewName('/community/new')).toBeNull()
    expect(viewName('/animals')).toBeNull()
    expect(viewName('/animals/abc')).toBeNull()
  })
})
