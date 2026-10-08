import jsQR from 'jsqr'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useKeeper } from '../data/keeper'
import { nm } from '../lib/format'
import { parseScan } from '../lib/qr'

type Cam = { st: 'off' | 'wait' | 'on' | 'err'; msg: string }

export default function ScanPage() {
  const nav = useNavigate()
  const ui = useUI()
  const k = useKeeper()
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [cam, setCam] = useState<Cam>({ st: 'off', msg: '' })
  const [manual, setManual] = useState('')
  const [err, setErr] = useState('')
  const kRef = useRef(k)
  useEffect(() => {
    kRef.current = k
  })

  const stop = useCallback(() => {
    window.clearTimeout(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stop()
    }
  }, [stop])

  const handle = useCallback(
    (text: string) => {
      const r = parseScan(text)
      if (r?.kind === 'transfer') {
        stop()
        nav(`/transfer?code=${r.code}`)
        return true
      }
      if (r?.kind === 'animal') {
        const a = kRef.current.byCode.get(r.code)
        if (a) {
          stop()
          navigator.vibrate?.(60)
          ui.toast(`${a.code} 라벨 인식`)
          nav(`/animals/${a.id}`)
          return true
        }
        setErr(`인식한 코드: ${r.code} — 내 목록에 없는 개체예요`)
        return false
      }
      setErr(`인식한 코드: ${text.slice(0, 40)} — VILLAIN ERA 라벨이 아니에요`)
      return false
    },
    [nav, stop, ui],
  )

  const start = async () => {
    const md = navigator.mediaDevices
    if (!md?.getUserMedia) {
      return setCam({ st: 'err', msg: window.isSecureContext ? '이 브라우저는 카메라를 지원하지 않아요' : '카메라는 HTTPS 주소에서만 쓸 수 있어요' })
    }
    setCam({ st: 'wait', msg: '카메라 권한을 확인하는 중…' })
    try {
      const s = await md.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      // 권한을 기다리는 사이 다른 화면으로 나갔다면 카메라를 바로 끈다
      if (!mounted.current) return s.getTracks().forEach((t) => t.stop())
      stream.current = s
      const v = video.current!
      v.srcObject = s
      v.muted = true
      await v.play().catch(() => undefined)
      setCam({ st: 'on', msg: 'QR 라벨을 프레임 안에 맞춰주세요' })
      // 프레임마다 QR을 찾는다 (인식 실패 코드면 1.5초 쉬고 다시)
      const tick = () => {
        if (!stream.current) return
        if (v.readyState < 2 || !v.videoWidth) {
          timer.current = window.setTimeout(tick, 200)
          return
        }
        const W = 480
        const H = Math.round((W * v.videoHeight) / v.videoWidth)
        const c = (canvas.current ??= document.createElement('canvas'))
        c.width = W
        c.height = H
        const x = c.getContext('2d', { willReadFrequently: true })!
        x.drawImage(v, 0, 0, W, H)
        const r = jsQR(x.getImageData(0, 0, W, H).data, W, H, { inversionAttempts: 'dontInvert' })
        if (r?.data && handle(r.data)) return
        timer.current = window.setTimeout(tick, r?.data ? 1500 : 180)
      }
      tick()
    } catch (e) {
      const name = (e as DOMException)?.name
      setCam({
        st: 'err',
        msg:
          name === 'NotAllowedError'
            ? '카메라 권한이 거부됐어요 · 브라우저 설정에서 허용해 주세요'
            : name === 'NotFoundError'
              ? '사용할 수 있는 카메라가 없어요'
              : `카메라를 열 수 없어요 (${name})`,
      })
    }
  }

  const lookup = () => {
    let v = manual.trim().toUpperCase()
    if (/^\d{1,4}$/.test(v)) v = 'VE-' + v.padStart(4, '0')
    else if (/^[A-Z0-9]{10}$/.test(v)) v = 'VE-' + v
    if (!v) return setErr('ID를 입력해 주세요')
    const a = k.byCode.get(v)
    if (!a) return setErr(`${v} — 등록된 개체가 없어요`)
    setManual('')
    setErr('')
    nav(`/animals/${a.id}`)
  }

  const on = cam.st === 'on'
  return (
    <Screen title="스캔" back="/">
      <div className="page">
        <div style={{ height: 290, borderRadius: 22, background: 'var(--ink)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <video ref={video} muted playsInline autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: on ? 'block' : 'none' }} />
          <div style={{ width: 180, height: 180, position: 'relative' }}>
            {(
              [
                { top: 0, left: 0, borderTop: 1, borderLeft: 1, radius: '8px 0 0 0' },
                { top: 0, right: 0, borderTop: 1, borderRight: 1, radius: '0 8px 0 0' },
                { bottom: 0, left: 0, borderBottom: 1, borderLeft: 1, radius: '0 0 0 8px' },
                { bottom: 0, right: 0, borderBottom: 1, borderRight: 1, radius: '0 0 8px 0' },
              ] as const
            ).map((c, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  width: 32,
                  height: 32,
                  top: 'top' in c ? 0 : undefined,
                  bottom: 'bottom' in c ? 0 : undefined,
                  left: 'left' in c ? 0 : undefined,
                  right: 'right' in c ? 0 : undefined,
                  borderTop: 'borderTop' in c ? '3px solid var(--cream)' : undefined,
                  borderBottom: 'borderBottom' in c ? '3px solid var(--cream)' : undefined,
                  borderLeft: 'borderLeft' in c ? '3px solid var(--cream)' : undefined,
                  borderRight: 'borderRight' in c ? '3px solid var(--cream)' : undefined,
                  borderRadius: c.radius,
                }}
              />
            ))}
            <span style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 2, background: '#4F86D6' }} />
          </div>
          <div style={{ position: 'absolute', bottom: 16, left: 12, right: 12, textAlign: 'center', fontSize: 12, color: 'rgba(250,249,246,.92)' }}>
            {cam.msg || '카메라를 켜고 QR 라벨을 프레임 안에 맞춰주세요'}
          </div>
        </div>
        <button
          type="button"
          data-test="cam-toggle"
          className="btn"
          style={{ height: 48, border: '1px solid var(--blue)', background: on ? '#fff' : 'var(--blue)', color: on ? 'var(--blue)' : 'var(--cream)' }}
          onClick={() => {
            if (on) {
              stop()
              setCam({ st: 'off', msg: '' })
            } else if (cam.st !== 'wait') start()
          }}
        >
          {on ? '카메라 끄기' : cam.st === 'wait' ? '카메라 여는 중…' : '카메라 켜기'}
        </button>

        <div>
          <div className="label">ID 직접 입력</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input mono"
              style={{ flex: 1, minWidth: 0 }}
              value={manual}
              onChange={(e) => {
                setManual(e.target.value)
                setErr('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="예: VE-7K2Q9X4M1B"
            />
            <button type="button" className="btn btn-primary" style={{ width: 76, height: 46, fontSize: 14, flex: 'none' }} onClick={lookup}>
              조회
            </button>
          </div>
          {err && (
            <div className="err" style={{ marginTop: 6 }}>
              {err}
            </div>
          )}
        </div>

        {k.owned.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              내 개체 바로 열기
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {k.owned.slice(0, 8).map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => nav(`/animals/${a.id}`)}
                  style={{ fontSize: 12, fontWeight: 600, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--input)', background: '#fff' }}
                >
                  <span className="mono" style={{ color: 'var(--blue)' }}>
                    {a.code}
                  </span>{' '}
                  {nm(a)}
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={() => nav('/transfer')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', textAlign: 'center' }}>
          분양 코드로 개체 받기 ›
        </button>
      </div>
    </Screen>
  )
}
