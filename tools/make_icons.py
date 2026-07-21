# -*- coding: utf-8 -*-
"""生成 PWA 图标：深色底 + 「缠」字。输出 192/512/maskable 512/apple-touch 180。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]

BG = (16, 24, 32, 255)        # 深色底 #101820
FG = (233, 196, 106, 255)     # 金字 #E9C46A
ACCENT = (42, 111, 105, 255)  # 青绿圆环 #2A6F69


def load_font(size):
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    raise RuntimeError("未找到可用 CJK 字体")


def make(size, path, maskable=False):
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    pad = int(size * (0.16 if maskable else 0.06))
    # 圆环装饰
    ring_w = max(2, size // 64)
    d.ellipse([pad, pad, size - pad, size - pad], outline=ACCENT, width=ring_w)
    font = load_font(int(size * (0.46 if maskable else 0.52)))
    ch = "缠"
    bbox = d.textbbox((0, 0), ch, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), ch, font=font, fill=FG)
    img.save(path, "PNG")
    print(f"{path.name}: {size}x{size}")


make(192, OUT / "icon-192.png")
make(512, OUT / "icon-512.png")
make(512, OUT / "icon-maskable-512.png", maskable=True)
make(180, OUT / "apple-touch-icon.png")
