// 프로토타입의 반복 UI 조각 (세그먼트·칩·토글·스테퍼·시트·페어링 카드 등)
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useViewport } from '../app/layout'
import type { PairInfo } from '../lib/lineage'

export function Seg<T extends string | number>({
  items,
  value,
  onChange,
  height,
  mono,
  testId,
}: {
  items: readonly (readonly [T, string])[]
  value: T
  onChange: (v: T) => void
  height?: number
  mono?: boolean
  testId?: string
}) {
  return (
    <div className="seg" data-test={testId}>
      {items.map(([k, label]) => (
        <button
          type="button"
          key={String(k)}
          className={`seg-item${value === k ? ' on' : ''}`}
          style={{ height, fontFamily: mono ? 'var(--mono)' : undefined }}
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string | number>({
  items,
  value,
  onChange,
  wrap,
  small,
  style,
}: {
  items: readonly (readonly [T, string])[]
  value: T | T[]
  onChange: (v: T) => void
  wrap?: boolean
  small?: boolean
  style?: CSSProperties
}) {
  const on = (k: T) => (Array.isArray(value) ? value.includes(k) : value === k)
  return (
    <div className={`chips no-scrollbar${wrap ? ' wrap' : ''}`} style={style}>
      {items.map(([k, label]) => (
        <button
          type="button"
          key={String(k)}
          className={`chip${small ? ' sm' : ''}${on(k) ? ' on' : ''}`}
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onClick, busy, label }: { on: boolean; onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle${on ? ' on' : ''}${busy ? ' busy' : ''}`}
      onClick={busy ? undefined : onClick}
    />
  )
}

export function Stepper({
  value,
  onDec,
  onInc,
  warn,
}: {
  value: number
  onDec: () => void
  onInc: () => void
  warn?: boolean
}) {
  return (
    <div className={`stepper${warn ? ' warn' : ''}`}>
      <button type="button" onClick={onDec} aria-label="줄이기">
        −
      </button>
      <div className="val">{value}</div>
      <button type="button" onClick={onInc} aria-label="늘리기">
        +
      </button>
    </div>
  )
}

export function Field({ label, req, children, hint }: { label: ReactNode; req?: boolean; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="label">
        {label}
        {req && <span className="req"> *</span>}
      </div>
      {children}
      {hint}
    </div>
  )
}

export function PairCard({ pi, big, showCommon = true }: { pi: PairInfo; big?: boolean; showCommon?: boolean }) {
  return (
    <div className="pair-card" style={{ background: pi.cardBg, borderColor: pi.cardBd }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{ fontWeight: 600, fontSize: big ? 22 : 18 }}>
          COI {pi.txt}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background: pi.vBg,
            color: pi.vInk,
          }}
        >
          {pi.verdict}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--sub)' }}>
        {pi.rel}
        {showCommon && ` · 가까운 공통 조상: ${pi.common}`}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: pi.msgInk }}>{pi.msg}</div>
    </div>
  )
}

export function Avatar({ name, url, size }: { name: string; url?: string | null; size: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {url ? <img src={url} alt="" className="cover" /> : name.slice(0, 1)}
    </span>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { desk } = useViewport()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet${desk ? ' desk' : ''}`} role="dialog" aria-label={title} data-test="sheet">
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
          <button
            type="button"
            data-test="sheet-close"
            onClick={onClose}
            style={{ fontSize: 14, color: 'var(--muted)', padding: '10px 0 10px 16px' }}
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  )
}

export function Spinner({ center }: { center?: boolean }) {
  return center ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" />
    </div>
  ) : (
    <div className="spinner" />
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="empty-card" style={{ margin: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>불러오지 못했어요</div>
      <div className="hint">{(error as Error)?.message || '네트워크 연결을 확인해 주세요'}</div>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" style={{ padding: '0 18px' }} onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}

export function Sparkline({ pts, height = 48 }: { pts: number[]; height?: number }) {
  if (!pts.length) return null
  const mx = Math.max(...pts)
  const mn = Math.min(...pts)
  const r = mx - mn || 1
  const line = pts
    .map((g, i) => `${(pts.length > 1 ? (i / (pts.length - 1)) * 100 : 50).toFixed(1)},${(92 - ((g - mn) / r) * 84).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ flex: 1, height, overflow: 'visible' }}>
      <polyline points={line} fill="none" stroke="#0148AB" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function QrGrid({ cells, n, size }: { cells: boolean[]; n: number; size: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        width: size,
        height: size,
        flex: 'none',
      }}
    >
      {cells.map((on, i) => (
        <span key={i} style={{ background: on ? '#16181D' : 'transparent' }} />
      ))}
    </div>
  )
}
