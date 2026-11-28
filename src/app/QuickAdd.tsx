// 하단 가운데 '기록' 버튼의 시트: 자주 하는 기록으로 바로 간다
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, ListChecks, Plus, ScanLine, Utensils, Weight } from 'lucide-react'
import { useKeeper } from '../data/keeper'
import { today } from '../lib/date'
import { Sheet } from '../ui/kit'

export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const k = useKeeper()
  const month = today().slice(0, 7)
  const measured = k.owned.filter((a) => k.lastW(a.id)?.date.startsWith(month)).length
  const go = (to: string, state?: { add: true }) => {
    onClose()
    nav(to, state ? { state } : undefined)
  }
  const row = (test: string, icon: ReactNode, title: string, sub: string, onClick: () => void, primary = false) => (
    <button type="button" className="row" data-test={test} onClick={onClick}>
      <span className={`itile${primary ? ' blue' : ''}`}>{icon}</span>
      <span className="grow">
        <span className="row-t">{title}</span>
        {sub && <span className="meta">{sub}</span>}
      </span>
      <ChevronRight size={18} className="chev" />
    </button>
  )
  return (
    <Sheet title="기록하기" onClose={onClose}>
      <div className="rows" style={{ marginTop: -8 }}>
        {row('quick-feed', <Utensils size={20} />, '급여 기록', '여러 마리를 한 번에', () => go('/feedings'), true)}
        {row('quick-weight', <Weight size={20} />, '체중 측정', k.owned.length ? `이번 달 ${measured} / ${k.owned.length}` : '', () => go('/weights'))}
        {row('quick-scan', <ScanLine size={20} />, 'QR 스캔', '라벨을 찍어 그 개체로 바로 가기', () => go('/scan'))}
        {row('quick-todo', <ListChecks size={20} />, '할 일 추가', '', () => go('/todo', { add: true }))}
        {row('quick-animal', <Plus size={20} />, '개체 등록', '', () => go('/animals/new'))}
      </div>
    </Sheet>
  )
}
