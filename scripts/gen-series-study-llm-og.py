#!/usr/bin/env python3
"""Generate the OG card for /series/study-llm/.

Creates: og/series-study-llm.jpg
"""

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OG_DIR = PROJECT_DIR / "og"
FONTS_DIR = SCRIPT_DIR / "fonts"

WIDTH, HEIGHT = 1200, 630
BG_TOP = (240, 247, 253)
BG_BOTTOM = (205, 225, 244)
WHITE = (255, 255, 255)
TEXT_DARK = (30, 42, 56)
TEXT_SUB = (88, 110, 132)
ACCENT = (74, 136, 176)


def render(output_path: Path):
    S = 2
    W, H = WIDTH * S, HEIGHT * S

    font_title = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-ExtraBold.ttf"), 88 * S)
    font_sub = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 30 * S)
    font_tag = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 20 * S)

    img = Image.new("RGB", (W, H), WHITE)
    for y in range(H):
        t = y / H
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(W):
            img.putpixel((x, y), (r, g, b))

    draw = ImageDraw.Draw(img)

    # Attention-style grid in top-right (matches gpt-2 card)
    random.seed(7)
    grid_n = 8
    cell = 38 * S
    gx0 = W - cell * grid_n - 60 * S
    gy0 = 60 * S
    for i in range(grid_n):
        for j in range(grid_n):
            if j <= i:
                v = 0.25 + random.random() * 0.75 * (1 - abs(i - j) * 0.15)
                v = max(0.05, min(v, 1.0))
            else:
                v = 0.02
            r = int(240 + (74 - 240) * v)
            g = int(247 + (136 - 247) * v)
            b = int(253 + (176 - 253) * v)
            draw.rectangle(
                [gx0 + j * cell, gy0 + i * cell,
                 gx0 + (j + 1) * cell - 2, gy0 + (i + 1) * cell - 2],
                fill=(r, g, b),
            )

    tag = "SERIES"
    draw.text((80 * S, 90 * S), tag, font=font_tag, fill=ACCENT)

    title_line1 = "Study LLM"
    y = 130 * S
    draw.text((76 * S, y), title_line1, font=font_title, fill=TEXT_DARK)

    sub_lines = [
        "GPT-2 から現代 Coding Agent まで",
        "可視化と実践で LLM を解き明かす連載",
    ]
    y += 130 * S
    for line in sub_lines:
        draw.text((80 * S, y), line, font=font_sub, fill=TEXT_SUB)
        y += 46 * S

    footer = "nyosegawa.com/series/study-llm"
    draw.text((80 * S, H - 72 * S), footer, font=font_sub, fill=ACCENT)

    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), "JPEG", quality=88, optimize=True)
    print(f"generated: {output_path.relative_to(PROJECT_DIR)}")


if __name__ == "__main__":
    render(OG_DIR / "series-study-llm.jpg")
