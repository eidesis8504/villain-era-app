// 분양 이력서 공개 화면 (/r/<토큰>): 계정 없이 열린다 (앱 화면 밖 라우트).
// 분양자가 링크를 끄면 더 이상 보이지 않는다.
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useResume } from '../data/adopt'
import { today } from '../lib/date'
import { thumbPath } from '../lib/photo'
import { cleanToken } from '../lib/resume'
import { publicUrl } from '../lib/supabase'
import { Spinner } from '../ui/kit'
import { ResumeView } from './ResumeView'

export default function ResumePage() {
  const token = cleanToken(useParams().token)
  const q = useResume(token)
  const gone = !token || (q.isSuccess && !q.data)
  // 앱 안의 글에서 들어온 사람이 돌아갈 수 있게 (홈 화면 앱에는 브라우저의 뒤로 버튼이 없다)
  const nav = useNavigate()
  const back = () => (window.history.length > 1 ? nav(-1) : nav('/', { replace: true }))
  return (
    <div className="legal-wrap">
      <header className="legal-hdr resume-hdr">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="hdr-back" aria-label="뒤로" data-test="resume-back" onClick={back}>
            <ChevronLeft size={24} />
          </button>
          <Link to="/" className="legal-brand">
            VILLAIN ERA
          </Link>
        </span>
        <span className="resume-kicker">분양 이력서</span>
      </header>
      <main className="resume-main">
        {gone ? (
          <div className="empty-card" data-test="resume-gone">
            <div style={{ fontSize: 15, fontWeight: 600 }}>꺼졌거나 없는 이력서예요</div>
            <div className="hint">분양자가 링크를 껐거나 주소가 잘못됐을 수 있어요. 분양자에게 새 링크를 받아 주세요.</div>
          </div>
        ) : q.error ? (
          <div className="empty-card">
            <div style={{ fontSize: 15, fontWeight: 600 }}>이력서를 불러오지 못했어요</div>
            <div className="hint">네트워크 연결을 확인해 주세요</div>
            <button type="button" className="btn btn-primary btn-sm" style={{ padding: '0 18px' }} onClick={() => q.refetch()}>
              다시 시도
            </button>
          </div>
        ) : !q.data ? (
          <Spinner center />
        ) : (
          <ResumeView r={q.data} today={today()} photoUrl={publicUrl('animal-photos', thumbPath(q.data.animal.photo_path))} />
        )}
        <div className="resume-cta">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>내 개체도 이렇게 기록해 보세요</div>
            <div className="hint">체중·급여·혈통을 남기고, 분양할 때 링크 하나로 보여 줄 수 있어요</div>
          </div>
          {/* 새로 열어야 유입 경로(src)가 잡힌다 */}
          <a className="btn btn-primary" href="/?src=resume">
            VILLAIN ERA 시작하기
          </a>
        </div>
      </main>
    </div>
  )
}
