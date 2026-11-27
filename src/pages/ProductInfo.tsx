// 제품 정보 카드: 제품 화면(/p/<slug>)과 환영 화면이 함께 쓴다. 표기사항에 없는 칸은 그리지 않는다.
import type { Product } from '../lib/products'

export function ProductInfo({ p, compact }: { p: Product; compact?: boolean }) {
  return (
    <div className="product-card" data-test="product-info">
      <div>
        <div className="product-name">{p.name}</div>
        {p.form && <div className="product-form">{p.form}</div>}
      </div>
      {p.species && (
        <div>
          <div className="label">급여 가능 종</div>
          <div>{p.species}</div>
        </div>
      )}
      {p.guide.length > 0 && (
        <div>
          <div className="label">급여 방법</div>
          <ol className="product-list">
            {p.guide.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
        </div>
      )}
      {p.cautions.length > 0 && (
        <details open={!compact}>
          <summary>보관·주의사항</summary>
          <ul className="product-list">
            {p.cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
