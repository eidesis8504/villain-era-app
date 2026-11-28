import { describe, expect, it } from 'vitest'
import { isThread, navRoot } from './nav'

describe('navRoot', () => {
  it('탭 뿌리 화면', () => {
    expect(navRoot('/')).toBe('home')
    expect(navRoot('/animals')).toBe('animals')
    expect(navRoot('/animals/abc/feeding')).toBe('animals')
    expect(navRoot('/a/VE-ABC')).toBe('animals')
    expect(navRoot('/community/new')).toBe('community')
    expect(navRoot('/chat')).toBe('chat')
  })
  it('사육 관리 화면은 홈 탭', () => {
    for (const p of ['/todo', '/weights', '/clutch', '/clutch/x', '/lineage', '/feedings', '/scan']) expect(navRoot(p)).toBe('home')
  })
  it('전체와 그 아래 화면은 켜진 탭이 없다', () => {
    for (const p of ['/more', '/tier', '/notices', '/alerts', '/transfer', '/blocked', '/inquiry', '/admin', '/p/signature']) expect(navRoot(p)).toBeNull()
  })
})
describe('isThread', () => {
  it('대화 화면에서만 참', () => {
    expect(isThread('/chat/abc')).toBe(true)
    expect(isThread('/inquiry')).toBe(true)
    expect(isThread('/admin/chat/abc')).toBe(true)
    expect(isThread('/chat')).toBe(false)
    expect(isThread('/')).toBe(false)
  })
})
