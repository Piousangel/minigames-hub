"""브랜드 최종판(11-20 오너 승인, 3차 V2 최종판 A '밝게') → 파비콘·앱 아이콘·헤더 마크. 생성 호출 0, 로컬 가공만.

원본(docs/design/brand-3/final/):
  master-1024.webp  노을 바탕 타일(링 #ba7b1a → #e8a048 로컬 보정, 무손실)
  mark-760.webp     타일에서 원판을 원형으로 오린 마크(바깥 투명, 무손실)
  simple-16.svg/png 16px 손 단순판(링 stroke #e8a048), png는 Chromium 16px 렌더
축소는 브랜드 3차 보드(prep.py)와 같은 방식(절반씩 BOX → LANCZOS)이라 보드에서 본 픽셀과 같다.

실행: python3 scripts/brand-icons.py   (Pillow 필요)
"""
import os
import numpy as np
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f'{R}/docs/design/brand-3/final'
OUT = f'{R}/src/brand'


def down(im, s):
    t = im
    while t.size[0] > s * 4:
        t = t.resize((t.size[0] // 2, t.size[1] // 2), Image.BOX)
    return t.resize((s, s), Image.LANCZOS)


tile = Image.open(f'{SRC}/master-1024.webp').convert('RGBA')
mark = Image.open(f'{SRC}/mark-760.webp').convert('RGBA').resize((512, 512), Image.LANCZOS)
simple16 = Image.open(f'{SRC}/simple-16.png').convert('RGBA')

# 탭: 16 = 손 단순판, 32·48 = 마크 크롭
m32, m48 = down(mark, 32), down(mark, 48)
m48.save(f'{R}/src/app/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[simple16, m32])
# 구글 검색 파비콘(96, 투명 바깥)
down(mark, 96).save(f'{OUT}/icon-96.png', optimize=True)
# iOS·PWA any: 노을 타일 그대로(불투명)
for s, name in ((180, 'apple-180'), (192, 'pwa-192'), (512, 'pwa-512')):
    down(tile, s).convert('RGB').save(f'{OUT}/{name}.png', optimize=True)

# PWA maskable: 같은 노을 그라데이션(ring.py 배경식) 위에 엠블럼(링 바깥 반지름 392/1024)을 지름 66%로
W = 1024
top, bot = np.array([255, 140, 108.0]), np.array([255, 190, 140.0])
t = np.linspace(0, 1, W)[:, None, None]
bg = Image.fromarray(((top * (1 - t) + bot * t) * np.ones((1, W, 1))).astype(np.uint8)).convert('RGBA')
yy, xx = np.mgrid[0:W, 0:W]
alpha = np.clip(396 - np.hypot(xx - 511.5, yy - 511.5), 0, 1)
em = np.array(tile.convert('RGB')).astype(float)
em = Image.fromarray(np.dstack([em, alpha * 255]).astype(np.uint8))
n = round(W * (0.66 * W / 784))
em = em.convert('RGBa').resize((n, n), Image.LANCZOS).convert('RGBA')
bg.alpha_composite(em, ((W - n) // 2, (W - n) // 2))
down(bg, 512).convert('RGB').save(f'{OUT}/pwa-maskable-512.png', optimize=True)

# 헤더·푸터 마크(표시 28·36·18px → 96px 한 장, 2x 이상)
down(mark, 96).save(f'{R}/public/brand/mark-96.webp', quality=88, method=6)
print('ok')
