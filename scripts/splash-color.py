#!/usr/bin/env python3
# 스플래시 영상의 색 표시를 sRGB로 바꾼다. 화면 데이터는 그대로 두고, 파일 안 표시 2곳
# (컨테이너 colr 상자, H.264 SPS의 VUI)의 transfer 값만 1(BT.709) → 13(sRGB)으로 고친다.
# 왜: BT.709로 표시된 영상은 맥·아이폰(사파리·크롬)에서 같은 RGB의 CSS 색보다 밝게 그려져,
#     PC에서 영상 양옆(CSS --blue #0148AB)과 영상 속 파란색이 달라 보인다. sRGB로 표시하면 어디서나 같게 보인다.
# 실행: python3 scripts/splash-color.py <원본.mp4> public/splash.mp4
import struct
import sys


def fail(msg: str) -> None:
    sys.exit(f'중단: {msg}')


class Bits:
    def __init__(self, data: bytes) -> None:
        self.d, self.p = data, 0

    def u(self, n: int) -> int:
        v = 0
        for _ in range(n):
            v = (v << 1) | ((self.d[self.p >> 3] >> (7 - (self.p & 7))) & 1)
            self.p += 1
        return v

    def ue(self) -> int:
        z = 0
        while self.u(1) == 0:
            z += 1
        return (1 << z) - 1 + self.u(z)

    def se(self) -> int:
        k = self.ue()
        return (k + 1) // 2 if k & 1 else -(k // 2)


def transfer_bit_offset(rbsp: bytes) -> int:
    """SPS(RBSP, NAL 머리 1바이트 뺌)에서 VUI transfer_characteristics가 시작하는 비트 위치"""
    r = Bits(rbsp)
    profile = r.u(8)
    r.u(16)
    r.ue()
    if profile in (100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135):
        chroma = r.ue()
        if chroma == 3:
            r.u(1)
        r.ue(), r.ue(), r.u(1)
        if r.u(1):  # scaling matrix
            for k in range(12 if chroma == 3 else 8):
                if r.u(1):
                    last = nxt = 8
                    for _ in range(16 if k < 6 else 64):
                        if nxt:
                            nxt = (last + r.se() + 256) % 256
                        last = nxt or last
    r.ue()
    poc = r.ue()
    if poc == 0:
        r.ue()
    elif poc == 1:
        r.u(1), r.se(), r.se()
        for _ in range(r.ue()):
            r.se()
    r.ue(), r.u(1), r.ue(), r.ue()
    if not r.u(1):
        r.u(1)
    r.u(1)
    if r.u(1):  # cropping
        for _ in range(4):
            r.ue()
    if not r.u(1):
        fail('SPS에 VUI가 없어요')
    if r.u(1) and r.u(8) == 255:
        r.u(32)
    if r.u(1):
        r.u(1)
    if not r.u(1):
        fail('SPS에 색 정보(video_signal_type)가 없어요')
    r.u(4)
    if not r.u(1):
        fail('SPS에 색 정보(colour_description)가 없어요')
    return r.p + 8  # colour_primaries(8비트) 다음


def main(src: str, dst: str) -> None:
    b = bytearray(open(src, 'rb').read())
    i = b.find(b'colrnclx')
    if i < 0:
        fail('colr(nclx) 상자가 없어요')
    b[i + 10 : i + 12] = struct.pack('>H', 13)

    a = b.find(b'avcC') + 4
    if a < 4 or b[a + 5] & 0x1F != 1:
        fail('avcC 안의 SPS가 1개가 아니에요')
    n = struct.unpack('>H', b[a + 6 : a + 8])[0]
    s = a + 8  # SPS NAL 시작(머리 1바이트 포함)
    rbsp, where, zeros = bytearray(), [], 0  # where[k] = RBSP k번째 바이트의 파일 위치
    for k in range(s + 1, s + n):
        if zeros >= 2 and b[k] == 3:
            zeros = 0
            continue
        rbsp.append(b[k])
        where.append(k)
        zeros = zeros + 1 if b[k] == 0 else 0
    pos = transfer_bit_offset(bytes(rbsp))
    for j in range(8):  # 8비트를 00001101(13)로
        bit = (13 >> (7 - j)) & 1
        q = pos + j
        byte, mask = where[q >> 3], 0x80 >> (q & 7)
        b[byte] = (b[byte] | mask) if bit else (b[byte] & ~mask)
    epb = set(range(s + 1, s + n)) - set(where)  # 원래 있던 방지 바이트(00 00 03의 03) 위치
    for k in range(s + 3, s + n):
        if b[k - 2] == 0 and b[k - 1] == 0 and b[k] <= 3 and k not in epb:
            fail('고친 SPS에 방지 바이트가 새로 필요해요')
    open(dst, 'wb').write(b)
    print(f'{dst}: 색 표시 transfer 1 → 13(sRGB), 화면 데이터는 그대로')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('사용법: python3 scripts/splash-color.py <원본.mp4> <결과.mp4>')
    main(sys.argv[1], sys.argv[2])
