"""Fraunces 정적 인스턴스 2개(roman/italic wght600 SOFT100 opsz72 WONK0) + Figtree variable, 라틴 서브셋 woff2.

허브 리디자인 v2 R1(src/app/fonts/). 재현 방법:
  1. 빈 폴더 SRC에 google/fonts 저장소 ofl/fraunces 의 Fraunces[SOFT,WONK,opsz,wght].ttf,
     Fraunces-Italic[SOFT,WONK,opsz,wght].ttf, ofl/figtree 의 Figtree[wght].ttf 를 받아
     각각 Fraunces-VF.ttf, Fraunces-Italic-VF.ttf, Figtree-VF.ttf 로 저장한다.
  2. python3 -m venv V && V/bin/pip install fonttools brotli
  3. V/bin/python -I scripts/fonts/build-garden-fonts.py SRC src/app/fonts
R1에 쓴 원본: google/fonts main cc5661d43cd4f9aad5567033a8e15ca28dc35c86 (2026-11-19),
  Fraunces Version 1.000;[b76b70a41], Figtree Version 2.002.
인스턴스의 name 테이블은 원본 그대로(updateFontNames=False) — 웹에서는 @font-face 서술자가 굵기·스타일을 정하므로 무관.
다른 굵기(예: 800)가 필요하면 instantiateVariableFont의 wght만 바꿔 파일을 하나 더 만든다.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

src, out = sys.argv[1], sys.argv[2]
UNICODES = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"


def axes(f):
    return {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in f["fvar"].axes}


def do_subset(font, path):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    opts.desubroutinize = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(UNICODES))
    s.subset(font)
    font.flavor = "woff2"
    font.save(path)


for name, outname in [("Fraunces-VF.ttf", "Fraunces-600.woff2"), ("Fraunces-Italic-VF.ttf", "Fraunces-600-Italic.woff2")]:
    f = TTFont(f"{src}/{name}")
    print(name, axes(f))
    inst = instancer.instantiateVariableFont(f, {"wght": 600, "SOFT": 100, "opsz": 72, "WONK": 0}, updateFontNames=False)
    do_subset(inst, f"{out}/{outname}")

f = TTFont(f"{src}/Figtree-VF.ttf")
print("Figtree", axes(f))
do_subset(f, f"{out}/Figtree-Variable.woff2")
