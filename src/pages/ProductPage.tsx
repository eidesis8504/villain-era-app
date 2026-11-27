// 제품 QR 시작 화면 (/p/<slug>): 와구와구 제품의 QR을 찍은 회원이 그 사료로 급여 기록을 시작한다.
// 계정이 없는 기기에서는 환영 화면이 같은 제품 카드를 보여 준다 (app/Welcome.tsx).
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useKeeper } from '../data/keeper'
import { getFoodPreset, productOf, setFoodPreset } from '../lib/products'
import { ProductInfo } from './ProductInfo'

export default function ProductPage() {
  const { slug } = useParams()
  const nav = useNavigate()
  const k = useKeeper()
  const p = productOf(slug)

  if (!p) {
    return (
      <Screen title="제품" back="/">
        <div className="empty-card" style={{ margin: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>제품을 찾을 수 없어요</div>
          <div className="hint">QR이 오래됐거나 주소가 잘못됐을 수 있어요</div>
          <button type="button" className="btn btn-primary btn-sm" style={{ padding: '0 18px' }} onClick={() => nav('/', { replace: true })}>
            홈으로
          </button>
        </div>
      </Screen>
    )
  }

  const mine = getFoodPreset() === p.food
  const has = k.owned.length > 0
  const go = () => {
    setFoodPreset(p.food)
    nav(has ? '/feedings' : '/animals/new')
  }

  return (
    <Screen title="와구와구" back="/">
      <div className="page">
        <ProductInfo p={p} />
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>이 사료로 급여 기록</div>
          <div className="hint" style={{ fontSize: 13 }}>
            {mine
              ? '내 사료로 기억돼 있어요 · 급여 기록의 먹이에 먼저 골라져요'
              : '버튼을 누르면 이 기기가 내 사료로 기억해서, 급여 기록의 먹이에 먼저 골라져요'}
          </div>
          <button type="button" data-test="product-start" className="btn btn-primary" onClick={go} disabled={k.loading}>
            {has ? '이 사료로 급여 기록하기' : '개체 등록하고 급여 기록 시작'}
          </button>
        </div>
      </div>
    </Screen>
  )
}
