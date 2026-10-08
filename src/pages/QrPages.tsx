import { Navigate, useNavigate, useParams } from 'react-router'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useKeeper } from '../data/keeper'
import { nm, sexLbl } from '../lib/format'
import { animalQrText, downloadBlob, labelCanvas, qrMatrix } from '../lib/qr'
import { ErrorBox, QrGrid, Spinner } from '../ui/kit'

export function QrPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const ui = useUI()
  const k = useKeeper()
  const a = k.A(id)

  if (k.error) return <Screen title="QR 라벨" back="/animals"><ErrorBox error={k.error} /></Screen>
  if (k.loading || (k.fetching && !a)) return <Screen title="QR 라벨" back="/animals"><Spinner center /></Screen>
  if (!a) return <Screen title="QR 라벨" back="/animals"><div className="empty">개체를 찾을 수 없어요</div></Screen>

  const { n, cells } = qrMatrix(animalQrText(a.code))
  const parents = { sire: k.A(a.sire_id)?.code ?? '미상', dam: k.A(a.dam_id)?.code ?? '미상' }

  const save = () => {
    labelCanvas(a, parents).toBlob((b) => {
      if (!b) return
      downloadBlob(b, `${a.code}-label.png`)
      ui.toast('라벨 이미지를 저장했어요')
    }, 'image/png')
  }

  const print = () => {
    const url = labelCanvas(a, parents).toDataURL('image/png')
    const w = window.open('', '_blank')
    if (!w) return ui.toast('팝업이 차단됐어요 — 이미지 저장 후 인쇄해 주세요', 'warn')
    w.document.write(
      `<title>${a.code} 라벨</title><img src="${url}" style="width:64mm" onload="setTimeout(function(){print()},300)">`,
    )
    w.document.close()
  }

  return (
    <Screen title="QR 라벨" back={`/animals/${a.id}`}>
      <div style={{ padding: '8px 18px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#fff', border: '1.5px solid var(--ink)', borderRadius: 14, padding: 16, display: 'grid', gridTemplateColumns: '132px 1fr', gap: 14, alignItems: 'center' }}>
          <QrGrid n={n} cells={cells} size={132} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: '.1em', color: 'var(--blue)' }}>
              VILLAIN ERA
            </span>
            <span className="mono" style={{ fontWeight: 600, fontSize: 17, overflowWrap: 'anywhere' }}>
              {a.code}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{nm(a)}</span>
            <span style={{ fontSize: 12, color: 'var(--sub)' }}>
              {sexLbl(a.sex)} · {a.morph}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              HATCH {a.hatch_date ?? '미상'}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              부 {parents.sire} · 모 {parents.dam}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>50 × 30 mm 라벨 · 사육장 전면에 부착 · 휴대폰 카메라로 찍어도 바로 열려요</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="btn btn-outline" style={{ height: 46, fontSize: 14 }} onClick={save}>
            이미지 저장
          </button>
          <button type="button" className="btn btn-primary" style={{ height: 46, fontSize: 14 }} onClick={print}>
            라벨 인쇄
          </button>
        </div>
        <button type="button" onClick={() => nav('/scan')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', textAlign: 'center' }}>
          스캔 탭에서 인식 테스트 ›
        </button>
      </div>
    </Screen>
  )
}

// QR 라벨 주소(/a/<ID>)로 들어오면 내 개체 상세로 연결한다
export function AnimalByCode() {
  const { code = '' } = useParams()
  const k = useKeeper()
  const c = decodeURIComponent(code).toUpperCase()
  const a = k.byCode.get(c)
  if (k.loading || (k.fetching && !a)) return <Screen title="개체 찾기" back="/animals"><Spinner center /></Screen>
  if (a) return <Navigate to={`/animals/${a.id}`} replace />
  return (
    <Screen title="개체 찾기" back="/animals">
      <div className="empty-card" style={{ margin: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          <span className="mono">{c}</span> 개체가 내 목록에 없어요
        </div>
        <div className="hint">다른 사육자의 라벨이거나 아직 분양받지 않은 개체예요</div>
      </div>
    </Screen>
  )
}
