#!/usr/bin/env python3
# 스플래시 일러스트 만들기: 와구와구 카드엽서 원본 → 화면 크기별 WebP + 흐린 배경용 아주 작은 그림
# 실행: python3 scripts/make-splash.py [원본 폴더]   (기본: ~/Desktop/와구와구/카드엽서, Pillow 필요)
# 결과: src/assets/splash/*.webp, src/app/splashArt.ts (자동 생성 — 손으로 고치지 않는다)
# 그림을 바꾸거나 더하려면 아래 ARTS를 고치고 다시 실행한다. 원본보다 큰 크기는 만들지 않는다.
import base64
import io
import sys
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # 신뢰하는 로컬 원본(가장 큰 것이 약 1억 4천만 화소)

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else Path.home() / 'Desktop/와구와구/카드엽서'
OUT = ROOT / 'src/assets/splash'
TS = ROOT / 'src/app/splashArt.ts'

# (짧은 이름, 원본 파일 이름)
ARTS = [
    ('go-space', '카드엽서 1 - GO SPACE.png'),
    ('spooky-forest', '카드엽서 2 - SPOOKY FOREST.PNG'),
    ('nightmare', '카드엽서 3 - NIGHTMARE.jpeg'),
    ('new-caledonia', '카드엽서 4 - New caledonia map.png'),
    ('incursion', '카드엽서 5 - Incursion.png'),
    ('breaking-bad', '카드엽서 6 - Breaking bad.PNG'),
]
WIDTHS = [720, 1080, 1440]  # 휴대폰·태블릿·큰 화면
QUALITY = 82
BACKDROP_W = 24  # 흐린 배경은 아주 작게 만들어 앱 코드에 넣는다


def camel(slug: str) -> str:
    head, *rest = slug.split('-')
    return head + ''.join(p.title() for p in rest)


def resized(im: Image.Image, w: int) -> Image.Image:
    w0, h0 = im.size
    if w == w0:
        return im
    return im.resize((w, round(h0 * w / w0)), Image.LANCZOS, reducing_gap=3.0)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.webp'):
        old.unlink()
    imports: list[str] = []
    entries: list[str] = []
    for slug, name in ARTS:
        im = Image.open(SRC / name).convert('RGB')
        w0, h0 = im.size
        widths = sorted({w for w in WIDTHS if w < w0} | {min(w0, WIDTHS[-1])})
        sources = []
        for w in widths:
            path = OUT / f'{slug}-{w}.webp'
            resized(im, w).save(path, 'WEBP', quality=QUALITY, method=6)
            var = f'{camel(slug)}{w}'
            imports.append(f"import {var} from '../assets/splash/{path.name}'")
            sources.append(f'{{ url: {var}, w: {w} }}')
            print(f'{path.name}: {path.stat().st_size // 1024}KB')
        buf = io.BytesIO()
        resized(im, BACKDROP_W).save(buf, 'WEBP', quality=50)
        backdrop = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
        entries.append(
            '  {\n'
            f"    slug: '{slug}',\n"
            f'    ratio: {round(w0 / h0, 4)},\n'
            f"    sources: [{', '.join(sources)}],\n"
            f"    backdrop: '{backdrop}',\n"
            '  },'
        )
    TS.write_text(
        '// 자동 생성 파일: scripts/make-splash.py — 손으로 고치지 마세요\n'
        '// 스플래시 일러스트(와구와구 카드엽서): 화면 크기별 WebP와 흐린 배경용 아주 작은 그림\n'
        + '\n'.join(imports)
        + '\n\nexport type SplashSource = { url: string; w: number }\n'
        'export type SplashArt = { slug: string; ratio: number; sources: SplashSource[]; backdrop: string }\n\n'
        'export const SPLASH_ART: SplashArt[] = [\n' + '\n'.join(entries) + '\n]\n',
        encoding='utf-8',
    )
    print(f'{TS.relative_to(ROOT)}: {len(ARTS)}장')


if __name__ == '__main__':
    main()
