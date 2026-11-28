// 상담 카드: 체중·급여·최근 30일 증상·최근 진료를 한 장으로. 커뮤니티 글 첨부와 이미지 저장에 같이 쓴다.
import { yd } from '../lib/date'
import { HEALTH_NOTICE, LEVEL_LABEL, type HealthAttach } from '../lib/health'
import { Sparkline } from '../ui/kit'

export function HealthCardView({ data, photoUrls = [] }: { data: Omit<HealthAttach, 'photos'>; photoUrls?: string[] }) {
  return (
    <div className="card" data-test="consult-card" style={{ borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>상담 카드</span>
        <span className="mono" style={{ color: 'var(--muted)' }}>
          {data.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 'none' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>체중 (최근 {data.weights.length}회)</div>
          <div className="mono" style={{ fontWeight: 600, fontSize: 18 }}>
            {data.lastW}
          </div>
        </div>
        {data.weights.length > 1 && <Sparkline pts={data.weights} />}
      </div>
      <div style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--muted)' }}>급여 </span>
        {data.lastFed ? (
          <>
            {yd(data.lastFed)} {data.lastFedResult}
            {data.refuseStreak > 0 && <b style={{ color: 'var(--warn)' }}> · 연속 거부 {data.refuseStreak}회</b>}
          </>
        ) : (
          '기록 없음'
        )}
      </div>
      <div style={{ fontSize: 13 }}>
        <div style={{ color: 'var(--muted)', marginBottom: 2 }}>최근 30일 증상</div>
        {data.symptoms.length ? (
          data.symptoms.slice(0, 6).map((s, i) => (
            <div key={i}>
              <span className="mono">{yd(s.d)}</span> {s.area} · {LEVEL_LABEL[s.level as 1 | 2 | 3]}
              {s.note && <span style={{ color: 'var(--sub)' }}> — {s.note}</span>}
            </div>
          ))
        ) : (
          <div>기록 없음</div>
        )}
      </div>
      <div style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--muted)' }}>최근 진료 </span>
        {data.vet ? `${yd(data.vet.d)} ${data.vet.clinic || '병원'}${data.vet.diagnosis ? ' · ' + data.vet.diagnosis : ''}` : '없음'}
      </div>
      {photoUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {photoUrls.map((u) => (
            <img key={u} src={u} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover' }} />
          ))}
        </div>
      )}
      <div className="hint">{HEALTH_NOTICE}</div>
    </div>
  )
}

// 이미지로 저장: 화면 캡처 대신 캔버스에 직접 그린다 (외부 라이브러리 없이)
export async function consultPng(data: Omit<HealthAttach, 'photos'>): Promise<Blob> {
  await document.fonts?.ready
  const W = 1080
  const pad = 64
  const lines: { text: string; font: string; color: string; gap: number }[] = []
  const add = (text: string, font: string, color = '#16181D', gap = 14) => lines.push({ text, font, color, gap })
  const sans = (w: number, s: number) => `${w} ${s}px 'IBM Plex Sans KR', sans-serif`
  add('VILLAIN ERA · 상담 카드', sans(700, 30), '#0148AB', 10)
  add(data.label, sans(600, 40), '#16181D', 30)
  add(`체중 (최근 ${data.weights.length}회)  ${data.lastW}`, sans(600, 34), '#16181D', data.weights.length > 1 ? 220 : 24)
  add(
    '급여  ' + (data.lastFed ? `${yd(data.lastFed)} ${data.lastFedResult}${data.refuseStreak ? ` · 연속 거부 ${data.refuseStreak}회` : ''}` : '기록 없음'),
    sans(500, 32),
    data.refuseStreak >= 3 ? '#B4540A' : '#16181D',
    24,
  )
  add('최근 30일 증상', sans(600, 32), '#3D4148', 12)
  if (data.symptoms.length) {
    for (const s of data.symptoms.slice(0, 6)) {
      add(`${yd(s.d)}  ${s.area} · ${LEVEL_LABEL[s.level as 1 | 2 | 3]}${s.note ? ' — ' + s.note : ''}`, sans(400, 30), '#16181D', 10)
    }
  } else add('기록 없음', sans(400, 30), '#16181D', 10)
  add(
    '최근 진료  ' + (data.vet ? `${yd(data.vet.d)} ${data.vet.clinic || '병원'}${data.vet.diagnosis ? ' · ' + data.vet.diagnosis : ''}` : '없음'),
    sans(500, 30),
    '#16181D',
    30,
  )
  add(HEALTH_NOTICE, sans(400, 24), '#6B6F76', 0)

  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  // 줄바꿈 계산
  const wrapped: { text: string; font: string; color: string; gap: number; chart?: boolean }[] = []
  for (const l of lines) {
    ctx.font = l.font
    const words = l.text.split(' ')
    let cur = ''
    const parts: string[] = []
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w
      if (ctx.measureText(next).width > W - pad * 2 && cur) {
        parts.push(cur)
        cur = w
      } else cur = next
    }
    parts.push(cur)
    parts.forEach((p, i) => wrapped.push({ ...l, text: p, gap: i === parts.length - 1 ? l.gap : 6 }))
  }
  const lineH = (font: string) => Number(/(\d+)px/.exec(font)?.[1] ?? 30) * 1.35
  const H = pad * 2 + wrapped.reduce((n, l) => n + lineH(l.font) + l.gap, 0)
  c.width = W
  c.height = Math.ceil(H)
  ctx.fillStyle = '#FAF9F6'
  ctx.fillRect(0, 0, W, c.height)
  let y = pad
  for (const l of wrapped) {
    ctx.font = l.font
    ctx.fillStyle = l.color
    ctx.textBaseline = 'top'
    ctx.fillText(l.text, pad, y)
    y += lineH(l.font)
    // 체중 줄 아래에 그래프
    if (l.text.startsWith('체중 (') && data.weights.length > 1) {
      const top = y + 20
      const h = 160
      const mx = Math.max(...data.weights)
      const mn = Math.min(...data.weights)
      const span = mx - mn || 1
      ctx.strokeStyle = '#0148AB'
      ctx.lineWidth = 5
      ctx.beginPath()
      data.weights.forEach((g, i) => {
        const x = pad + (i / (data.weights.length - 1)) * (W - pad * 2)
        const yy = top + h - ((g - mn) / span) * h
        if (i) ctx.lineTo(x, yy)
        else ctx.moveTo(x, yy)
      })
      ctx.stroke()
    }
    y += l.gap
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지를 만들지 못했어요'))), 'image/png'))
}
