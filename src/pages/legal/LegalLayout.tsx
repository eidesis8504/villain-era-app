// 약관·정책·지원 페이지 공통 틀: 계정 없이 열리고(스토어 심사·링크용), 앱 안에서도 같은 주소로 연다
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { OPERATOR } from '../../lib/operator'

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const nav = useNavigate()
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/', { replace: true }))
  return (
    <div className="legal-wrap">
      <header className="legal-hdr">
        <button type="button" className="hdr-back" aria-label="뒤로" onClick={back}>
          <ChevronLeft size={24} />
        </button>
        <Link to="/" className="legal-brand">
          VILLAIN ERA
        </Link>
      </header>
      <main className="legal">
        <h1>{title}</h1>
        {children}
        <nav className="legal-links">
          <Link to="/privacy">개인정보 처리방침</Link> · <Link to="/terms">이용약관</Link> · <Link to="/policy">커뮤니티 운영정책</Link> ·{' '}
          <Link to="/support">도움말·문의</Link>
        </nav>
        <p className="legal-foot">
          {OPERATOR.service} · 운영 {OPERATOR.name} · 문의 <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
      </main>
    </div>
  )
}

export function Draft() {
  return (
    <p className="legal-draft">
      베타 기간 초안 · 시행일 {OPERATOR.effective} · 정식 서비스 전에 전문가 검토를 거쳐 고칠 수 있어요
    </p>
  )
}
