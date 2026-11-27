// 제품 QR 만들기: node scripts/make-product-qr.mjs [출력 폴더]
// 포장이나 동봉 카드의 QR을 찍으면 제품 시작 화면(/p/<slug>)이 열린다.
// 주소의 src(pack-<slug>)로 들어와 시작한 사람은 운영자 '검증 현황'의 유입 경로별 숫자에 따로 잡힌다.
// 제품 목록은 src/lib/products.ts와 같게 유지한다.
// 출력은 저장소 밖(기본: ../VILLAIN ERA 분양·채팅·등급 업데이트 (2026-11-27)/제품 QR)에 둔다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import qrcode from 'qrcode-generator'

const BASE = 'https://villain-era-app.netlify.app'
const PRODUCTS = [
  ['signature', '와구와구 Signature'],
  ['standard', '와구와구 Standard'],
]
const out = resolve(process.argv[2] ?? '../VILLAIN ERA 분양·채팅·등급 업데이트 (2026-11-27)/제품 QR')
mkdirSync(out, { recursive: true })

const rows = []
const cards = []
for (const [slug, name] of PRODUCTS) {
  const url = `${BASE}/p/${slug}?src=pack-${slug}`
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const svg = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true })
  writeFileSync(join(out, `${slug}.svg`), svg)
  rows.push(`| ${name} | ${url} | ${slug}.svg |`)
  cards.push(`<figure><div class="qr">${svg}</div><figcaption><b>${name}</b><br><code>${url}</code></figcaption></figure>`)
}

writeFileSync(
  join(out, '링크.md'),
  `# 와구와구 제품 QR\n\n포장이나 동봉 카드에 넣는 QR이에요. 찍으면 VILLAIN ERA의 제품 시작 화면이 열리고, 시작하면 그 사료가 급여 기록의 먹이로 먼저 골라져요.\nQR 파일(.svg)은 크기를 키워도 깨지지 않아 인쇄용으로 좋아요. 인쇄 크기는 한 변 2cm 이상을 권해요.\n\n| 제품 | 링크 | QR |\n|---|---|---|\n${rows.join('\n')}\n\n운영자 화면(전체 › 검증 현황 › 유입 경로별)에서 \`pack-제품이름\`으로 들어와 시작한 사람 수를 볼 수 있어요.\n`,
)
writeFileSync(
  join(out, '인쇄용.html'),
  `<!doctype html><html lang="ko"><meta charset="utf-8"><title>와구와구 제품 QR</title><style>body{font-family:system-ui,sans-serif;display:grid;grid-template-columns:repeat(2,1fr);gap:24px;padding:24px}figure{margin:0;border:1px solid #ddd;border-radius:12px;padding:16px;text-align:center}.qr svg{width:200px;height:200px}code{font-size:11px}</style>${cards.join('')}</html>`,
)
console.log(`QR ${PRODUCTS.length}개 → ${out}`)
