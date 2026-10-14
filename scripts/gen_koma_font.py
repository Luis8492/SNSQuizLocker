#!/usr/bin/env python3
# 詰将棋の駒フォント(extension/quizzes/tsume/fonts/koma.woff2)を生成する。
# Yuji Syuku (SIL OFL 1.1) を駒の文字だけにサブセットして数KBに縮める。
# 使い方:
#   npm pack @fontsource/yuji-syuku && tar xzf fontsource-yuji-syuku-*.tgz
#   pip install fonttools brotli
#   python3 scripts/gen_koma_font.py package extension/quizzes/tsume/fonts/koma.woff2
# fontsource は unicode-range ごとに分割配布なので、必要な分割だけ拾って結合する。
import os, re, sys, tempfile
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger

# tsume.js の CHAR(駒) と KANJI_NUM(持駒の枚数) に一致させる
CHARS = "歩香桂銀金角飛玉王と杏圭全馬竜龍" + "一二三四五六七八九十"

def main(pkg, out):
    css = open(os.path.join(pkg, "index.css"), encoding="utf-8").read()
    need = set(map(ord, CHARS))
    picked = []
    for block in css.split("@font-face")[1:]:
        m = re.search(r"files/([^)]+\.woff2)", block)
        r = re.search(r"unicode-range:([^;]+);", block)
        if not m or not r:
            continue
        cps = set()
        for part in r.group(1).split(","):
            part = part.strip()[2:]
            if "-" in part:
                a, b = part.split("-")
                cps |= set(range(int(a, 16), int(b, 16) + 1))
            else:
                cps.add(int(part, 16))
        if cps & need:
            picked.append(os.path.join(pkg, "files", m.group(1)))
            need -= cps
    if need:
        sys.exit("見つからない文字: " + "".join(map(chr, need)))
    tmpdir = tempfile.mkdtemp()
    parts = []
    for i, path in enumerate(picked):
        f = TTFont(path)
        f.flavor = None
        opts = subset.Options()
        opts.layout_features = []
        s = subset.Subsetter(opts)
        s.populate(text=CHARS)
        s.subset(f)
        t = os.path.join(tmpdir, "p%d.ttf" % i)
        f.save(t)
        parts.append(t)
    font = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
    font.flavor = "woff2"
    font.save(out)
    print(out, os.path.getsize(out), "bytes")

if __name__ == "__main__":
    main(*sys.argv[1:3])
