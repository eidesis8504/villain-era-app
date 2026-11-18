// 모집용 추적 링크와 QR 만들기: node scripts/make-campaign-qr.mjs [출력 폴더]
// 각 경로(src)별 링크로 들어온 사람은 운영자 '검증 현황'의 유입 경로별 숫자에 따로 잡힌다.
// 출력은 저장소 밖(기본: ../VILLAIN ERA 검증 출시 (2026-11-19)/모집 링크)에 둔다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import qrcode from 'qrcode-generator'

const BASE = 'https://villain-era-app.netlify.app/'
const SOURCES = [
  ['instagram', '인스타그램 프로필·게시물'],
  ['community', '파충류 커뮤니티 글'],
  ['wagu-box', '와구와구 테스터 박스 동봉 카드'],
  ['friend', '지인 추천'],
]
const out = resolve(process.argv[2] ?? '../VILLAIN ERA 검증 출시 (2026-11-19)/모집 링크')
mkdirSync(out, { recursive: true })

const rows = []
const cards = []
for (const [src, where] of SOURCES) {
  const url = `${BASE}?src=${src}`
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const svg = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true })
  writeFileSync(join(out, `${src}.svg`), svg)
  rows.push(`| ${where} | \`${src}\` | ${url} | ${src}.svg |`)
  cards.push(`<figure><div class="qr">${svg}</div><figcaption><b>${where}</b><br><code>${url}</code></figcaption></figure>`)
}

writeFileSync(
  join(out, '링크.md'),
  `# VILLAIN ERA 모집 링크\n\n경로마다 다른 링크를 쓰면 운영자 화면(전체 › 검증 현황 › 유입 경로별)에서 어디서 온 사람이 많이 시작하고 다시 오는지 볼 수 있어요.\nQR 파일(.svg)은 크기를 키워도 깨지지 않아 인쇄용으로 좋아요.\n\n| 쓰는 곳 | src | 링크 | QR |\n|---|---|---|---|\n${rows.join('\n')}\n\n새 경로가 필요하면 \`?src=영문-이름\` 형식으로 붙이면 돼요 (예: \`?src=band\`).\n`,
)
writeFileSync(
  join(out, '모집 링크 인쇄용.html'),
  `<!doctype html><html lang="ko"><meta charset="utf-8"><title>VILLAIN ERA 모집 QR</title><style>body{font-family:system-ui,sans-serif;display:grid;grid-template-columns:repeat(2,1fr);gap:24px;padding:24px}figure{margin:0;border:1px solid #ddd;border-radius:12px;padding:16px;text-align:center}.qr svg{width:200px;height:200px}code{font-size:11px}</style>${cards.join('')}</html>`,
)
console.log(`QR ${SOURCES.length}개 → ${out}`)
