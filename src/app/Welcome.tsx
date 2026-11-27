// 환영 화면: 계정이 없는 기기에서 보인다. '시작하기'를 눌러야 게스트 계정을 만든다.
// 앱 안 브라우저·아이폰 사파리에서는 기록이 끊기지 않도록 먼저 안내한다.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { clearDisconnected, DISCONNECTED_NOTICE, peekDisconnected } from '../lib/boot'
import { currentEnv, type InApp } from '../lib/env'
import { canInstall, onInstallChange, promptInstall } from '../lib/install'
import { isNative } from '../lib/native'
import { productOf, productSlugFromPath, setFoodPreset } from '../lib/products'
import { isTransferLink } from '../lib/qr'
import { kakaoExternalUrl } from '../lib/source'
import { logLandingOnce } from '../lib/track'
import { EnterCodeSheet } from '../pages/DeviceLinkSheets'
import { ProductInfo } from '../pages/ProductInfo'
import { useAuth } from './auth'
import { useUI } from './ui'

const HOW_TO_OPEN: Record<Exclude<InApp, null>, string> = {
  instagram: '오른쪽 위 ⋯ 메뉴 → ‘외부 브라우저에서 열기’',
  kakao: '오른쪽 아래 ⋯ 메뉴 → ‘다른 브라우저로 열기’',
  naver: '⋯ 메뉴 → ‘기본 브라우저로 열기’',
  facebook: '오른쪽 위 ⋯ 메뉴 → ‘외부 브라우저에서 열기’',
  line: '오른쪽 위 ⋯ 메뉴 → ‘다른 앱으로 열기’',
  other: '메뉴에서 ‘브라우저로 열기’를 찾아 주세요',
}

const FEATURES = ['개체·체중·급여 기록과 성장 그래프', '혈통·근친계수·산란·부화 관리', '사육자 커뮤니티와 기록 첨부 질문']

export default function Welcome() {
  const { start, link } = useAuth()
  const ui = useUI()
  const nav = useNavigate()
  const loc = useLocation()
  // 제품 QR(/p/<slug>)로 들어왔으면 그 제품을 보여 주고, 시작하면 그 사료로 급여 기록까지 이어 준다
  const product = productOf(productSlugFromPath(loc.pathname))
  // 분양 코드가 붙은 링크로 들어왔으면, 시작한 뒤 분양 받기 화면이 그대로 열린다는 것을 알려 준다
  const transferLink = isTransferLink(loc.pathname, loc.search)
  const env = currentEnv()
  // 아이폰 홈 화면 앱은 사파리와 기록이 따로라, 사파리에서 쓰던 기록을 불러오는 길을 눈에 띄게 둔다
  const fromSafari = env.platform === 'ios' && env.standalone && !isNative()
  const [linkOpen, setLinkOpen] = useState(false)
  const installable = useSyncExternalStore(onInstallChange, canInstall)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [steps, setSteps] = useState(false)
  // 계정 삭제·연결 끊김으로 돌아온 경우 한 번만 안내: 렌더에서는 읽기만 하고, 지우기는 effect에서
  const [disconnected] = useState(peekDisconnected)

  useEffect(() => {
    logLandingOnce()
    clearDisconnected()
  }, [])

  const go = async () => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await start()
      if (product) {
        setFoodPreset(product.food)
        nav('/animals/new', { replace: true })
        ui.toast(`내 사료: ${product.name} · 먼저 개체를 등록해 주세요`)
      }
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      ui.toast('링크를 복사했어요 · 사파리나 크롬 주소창에 붙여 넣어 주세요')
    } catch {
      ui.toast('링크를 복사하지 못했어요 · 메뉴에서 브라우저로 열어 주세요', 'warn')
    }
  }

  let card = null
  let primary = (
    <button type="button" className="btn btn-primary" data-test="welcome-start" onClick={go} disabled={busy}>
      {busy ? '시작하는 중…' : product ? '시작하고 급여 기록하기' : '시작하기'}
    </button>
  )
  let secondary = null

  if (env.inapp) {
    card = (
      <div className="welcome-card warn">
        <div className="welcome-card-title">앱 안 브라우저로 열었어요</div>
        <div>여기서 시작하면 기록이 이 앱 안에만 남아요. 나중에 사파리나 크롬에서 열면 보이지 않으니, 기본 브라우저로 열어 주세요.</div>
        <div className="welcome-card-how">{HOW_TO_OPEN[env.inapp]}</div>
      </div>
    )
    primary =
      env.inapp === 'kakao' && env.platform === 'android' ? (
        <a className="btn btn-primary" href={kakaoExternalUrl(location.href)}>
          크롬으로 열기
        </a>
      ) : (
        <button type="button" className="btn btn-primary" onClick={copyLink}>
          링크 복사
        </button>
      )
    secondary = (
      <button type="button" className="btn btn-plain" data-test="welcome-start" onClick={go} disabled={busy}>
        {busy ? '시작하는 중…' : '여기서 그냥 시작'}
      </button>
    )
  } else if (env.iosSafari) {
    card = (
      <div className="welcome-card">
        <div className="welcome-card-title">아이폰은 홈 화면에 추가해서 쓰세요</div>
        <div>
          홈 화면 앱으로 쓰면 기록이 안전하게 유지되고 할 일 알림도 받을 수 있어요. 사파리에서만 쓰면 7일 넘게 열지 않았을 때
          기록이 지워질 수 있어요.
        </div>
        {steps && (
          <ol className="welcome-steps">
            <li>화면 아래 공유 버튼(□↑)을 눌러요</li>
            <li>‘홈 화면에 추가’를 눌러요</li>
            <li>홈 화면의 VILLAIN ERA 아이콘으로 열어 ‘시작하기’를 눌러요</li>
          </ol>
        )}
      </div>
    )
    primary = (
      <button type="button" className="btn btn-primary" onClick={() => setSteps((v) => !v)}>
        {steps ? '방법 닫기' : '홈 화면에 추가하는 방법'}
      </button>
    )
    secondary = (
      <button type="button" className="btn btn-plain" data-test="welcome-start" onClick={go} disabled={busy}>
        {busy ? '시작하는 중…' : '사파리에서 그냥 시작'}
      </button>
    )
  } else if (installable) {
    secondary = (
      <button type="button" className="btn btn-outline" onClick={() => promptInstall()}>
        앱으로 설치
      </button>
    )
  }

  return (
    <div className="welcome">
      <div className="welcome-in">
        {disconnected && (
          <div className="welcome-card warn" data-test="disconnected-notice">
            {DISCONNECTED_NOTICE}
          </div>
        )}
        <div className="welcome-brand">
          VILLAIN ERA <span className="beta">BETA</span>
        </div>
        {product ? (
          <>
            <div>
              <div className="welcome-title">와구와구를 받으셨나요?</div>
              <div className="welcome-sub">시작하면 이 사료로 급여 기록을 바로 남길 수 있어요</div>
            </div>
            <ProductInfo p={product} compact />
          </>
        ) : (
          <>
            <div>
              <div className="welcome-title">파충류 종합 사육 플랫폼</div>
              <div className="welcome-sub">개체 기록부터 번식·분양까지 한 앱에서</div>
            </div>
            <ul className="welcome-feat">
              {FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        )}
        {transferLink && (
          <div className="welcome-card" data-test="welcome-transfer">
            <div className="welcome-card-title">분양 기록을 받으러 오셨나요?</div>
            <div>시작하면 분양 받기 화면이 바로 열려요. 받은 분양 코드는 이미 들어가 있어요.</div>
          </div>
        )}
        {card}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {primary}
          {secondary}
          {fromSafari && (
            <div className="hint" style={{ textAlign: 'center', marginTop: 4 }}>
              사파리에서 쓰던 기록이 있나요?
            </div>
          )}
          <button
            type="button"
            data-test="welcome-link"
            className={fromSafari ? 'btn btn-outline' : 'btn btn-plain'}
            onClick={() => setLinkOpen(true)}
          >
            이미 쓰던 기록이 있어요
          </button>
          {err && <div className="err" style={{ textAlign: 'center' }}>{err}</div>}
        </div>
        <div className="welcome-fine">
          가입 없이 바로 시작해요 · 기록은 {isNative() ? '이 기기의 앱' : '이 기기의 브라우저'}에 연결돼요
          <br />
          시작하면 <Link to="/terms">이용약관</Link>과 <Link to="/privacy">개인정보 처리방침</Link>에 동의하게 돼요 · 만 14세 이상
        </div>
      </div>
      {linkOpen && <EnterCodeSheet title="이미 쓰던 기록 불러오기" onClose={() => setLinkOpen(false)} onSubmit={link} />}
    </div>
  )
}
