#!/usr/bin/env python3
"""Generate the portfolio (homepage) OG card for both languages.

Creates:
- og/portfolio.jpg     ("逆瀬川ちゃんのほーむぺーじ")
- og/en/portfolio.jpg  ("Sakasegawa's Homepage")
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OG_DIR = PROJECT_DIR / "og"
FONTS_DIR = SCRIPT_DIR / "fonts"
ICON_PATH = PROJECT_DIR / "icon.png"

WIDTH, HEIGHT = 1200, 630
BG_TOP = (235, 244, 252)
BG_BOTTOM = (210, 228, 245)
WHITE = (255, 255, 255)
TEXT_DARK = (26, 26, 46)
ACCENT_BLUE = (107, 163, 199)
PILL_BG = (228, 239, 248)
PILL_FG = (107, 163, 199)
CIRCLE_DECO = (200, 222, 242, 50)


def render(title: str, output_path: Path):
    S = 2
    W, H = WIDTH * S, HEIGHT * S

    font_title = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-ExtraBold.ttf"), 64 * S)
    font_pill = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 22 * S)

    # Background gradient
    img = Image.new("RGB", (W, H), WHITE)
    for y in range(H):
        t = y / H
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(W):
            img.putpixel((x, y), (r, g, b))

    # Decorative circles
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse([-80 * S, -80 * S, 200 * S, 200 * S], fill=CIRCLE_DECO)
    odraw.ellipse([W - 250 * S, H - 200 * S, W + 50 * S, H + 50 * S], fill=CIRCLE_DECO)
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    img = img_rgba.convert("RGB")
    draw = ImageDraw.Draw(img)

    # White card with shadow
    card_mx, card_my = 56 * S, 36 * S
    cx, cy = card_mx, card_my
    cw = W - card_mx * 2
    ch = H - card_my * 2
    radius = 20 * S

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [cx + 2 * S, cy + 4 * S, cx + cw + 2 * S, cy + ch + 4 * S],
        radius=radius, fill=(0, 0, 0, 12),
    )
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, shadow)
    img = img_rgba.convert("RGB")
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=radius, fill=WHITE)

    # Top-right accent dot
    dot_r = 8 * S
    draw.ellipse(
        [cx + cw - 48 * S, cy + 28 * S, cx + cw - 48 * S + dot_r * 2, cy + 28 * S + dot_r * 2],
        fill=ACCENT_BLUE,
    )

    # Avatar (centered horizontally)
    avatar_size = 240 * S
    avatar_x = (W - avatar_size) // 2
    avatar_y = cy + 60 * S
    if ICON_PATH.exists():
        avatar = Image.open(ICON_PATH).convert("RGBA")
        avatar = avatar.resize((avatar_size, avatar_size), Image.LANCZOS)
        mask = Image.new("L", (avatar_size, avatar_size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, avatar_size, avatar_size], fill=255)
        img.paste(avatar.convert("RGB"), (avatar_x, avatar_y), mask)
        draw = ImageDraw.Draw(img)

    # Title (centered below avatar)
    title_bbox = font_title.getbbox(title)
    title_w = title_bbox[2] - title_bbox[0]
    title_h = title_bbox[3] - title_bbox[1]
    title_x = (W - title_w) // 2 - title_bbox[0]
    title_y = avatar_y + avatar_size + 40 * S
    draw.text((title_x, title_y), title, font=font_title, fill=TEXT_DARK)

    # Social pills (centered below title)
    pills = ["GitHub", "X", "Zenn", "Email"]
    pill_pad_x, pill_pad_y = 18 * S, 8 * S
    pill_gap = 14 * S

    pill_metrics = []
    for label in pills:
        bbox = font_pill.getbbox(label)
        w = bbox[2] - bbox[0] + pill_pad_x * 2
        h = bbox[3] - bbox[1] + pill_pad_y * 2
        pill_metrics.append((label, bbox, w, h))

    pills_total_w = sum(m[2] for m in pill_metrics) + pill_gap * (len(pills) - 1)
    pill_y = title_y + title_h + 30 * S
    pill_x = (W - pills_total_w) // 2

    for label, bbox, w, h in pill_metrics:
        draw.rounded_rectangle(
            [pill_x, pill_y, pill_x + w, pill_y + h],
            radius=14 * S, fill=PILL_BG,
        )
        text_x = pill_x + pill_pad_x - bbox[0]
        text_y = pill_y + pill_pad_y - bbox[1]
        draw.text((text_x, text_y), label, font=font_pill, fill=PILL_FG)
        pill_x += w + pill_gap

    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), "JPEG", quality=85, optimize=True)
    print(f"  generated: {output_path.relative_to(PROJECT_DIR)}")


def main():
    render("逆瀬川ちゃんのほーむぺーじ", OG_DIR / "portfolio.jpg")
    render("Sakasegawa's Homepage", OG_DIR / "en" / "portfolio.jpg")


if __name__ == "__main__":
    main()
