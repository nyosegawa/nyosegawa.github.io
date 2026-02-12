#!/usr/bin/env python3
"""Generate OG card images for all blog posts.

Usage:
    python3 scripts/gen-og-images.py

Reads all .md files in posts/, extracts frontmatter,
and generates 1200x630 OG card images to og/.
"""

import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow not found. Install with: pip install Pillow")
    sys.exit(1)

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
POSTS_DIR = PROJECT_DIR / "posts"
OG_DIR = PROJECT_DIR / "og"
FONTS_DIR = SCRIPT_DIR / "fonts"
ICON_PATH = PROJECT_DIR / "icon.png"

# --- Constants ---
WIDTH, HEIGHT = 1200, 630
BLOG_URL = "nyosegawa.github.io"
AUTHOR = "逆瀬川ちゃん"

# --- Colors ---
BG_WARM = (252, 247, 240)
BG_COOL = (240, 244, 250)
WHITE = (255, 255, 255)
TEXT_DARK = (26, 26, 46)
TEXT_MID = (100, 100, 110)
TEXT_LIGHT = (160, 160, 170)
TAG_FG = (220, 90, 50)
TAG_BG = (255, 240, 232)


def parse_frontmatter(filepath: Path) -> dict:
    """Extract YAML frontmatter from a markdown file."""
    text = filepath.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return {}

    data = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key == "tags":
                # Parse [tag1, tag2, ...] format
                val = [t.strip() for t in val.strip("[]").split(",")]
            data[key] = val
    return data


def wrap_title(title: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Wrap title text to fit within max_width pixels."""
    lines = []
    current = ""

    for char in title:
        test = current + char
        bbox = font.getbbox(test)
        if bbox[2] - bbox[0] > max_width:
            lines.append(current)
            current = char
        else:
            current = test

    if current:
        lines.append(current)

    return lines[:4]  # Max 4 lines


def generate_card(title: str, tags: list[str], output_path: Path):
    """Generate a single OG card image."""
    # Load fonts
    font_title = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-ExtraBold.ttf"), 52)
    font_tag = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 18)
    font_author = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 24)
    font_blog = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Regular.ttf"), 20)

    # Create base image with gradient
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_WARM)

    # Soft diagonal gradient
    for y in range(HEIGHT):
        for x in range(WIDTH):
            t = x / WIDTH * 0.6 + y / HEIGHT * 0.4
            r = int(BG_WARM[0] + (BG_COOL[0] - BG_WARM[0]) * t)
            g = int(BG_WARM[1] + (BG_COOL[1] - BG_WARM[1]) * t)
            b = int(BG_WARM[2] + (BG_COOL[2] - BG_WARM[2]) * t)
            img.putpixel((x, y), (r, g, b))

    draw = ImageDraw.Draw(img)

    # White card
    margin = 40
    cx, cy = margin, margin
    cw, ch = WIDTH - margin * 2, HEIGHT - margin * 2
    radius = 24

    # Shadow
    shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [cx + 2, cy + 4, cx + cw + 2, cy + ch + 4],
        radius=radius, fill=(0, 0, 0, 18),
    )
    base = Image.new("RGBA", img.size, (0, 0, 0, 0))
    composited = Image.alpha_composite(base, shadow).convert("RGB")
    img.paste(composited, mask=shadow.split()[3])

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        [cx, cy, cx + cw, cy + ch],
        radius=radius, fill=WHITE,
    )

    # Left accent bar (orange → red gradient)
    bar_x, bar_y, bar_h, bar_w = cx, cy + 56, 80, 6
    for i in range(bar_h):
        t = i / bar_h
        r = int(255)
        g = int(153 + (94 - 153) * t)
        b = int(102 + (98 - 102) * t)
        draw.rectangle([bar_x, bar_y + i, bar_x + bar_w, bar_y + i + 1], fill=(r, g, b))
    draw.ellipse([bar_x, bar_y - 2, bar_x + bar_w, bar_y + 4], fill=(255, 153, 102))
    draw.ellipse([bar_x, bar_y + bar_h - 4, bar_x + bar_w, bar_y + bar_h + 2], fill=(255, 94, 98))

    # Title
    title_x = cx + 72
    title_y = cy + 60
    max_title_width = cw - 72 - 60

    lines = wrap_title(title, font_title, max_title_width)
    y_offset = title_y
    for line in lines:
        draw.text((title_x, y_offset), line, font=font_title, fill=TEXT_DARK)
        bbox = font_title.getbbox(line)
        y_offset += bbox[3] - bbox[1] + 14

    # Tags
    tag_y = y_offset + 20
    tag_x = title_x
    for tag_text in tags[:5]:  # Max 5 tags
        bbox = font_tag.getbbox(tag_text)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        pad_x, pad_y = 16, 8

        if tag_x + tw + pad_x * 2 > cx + cw - 60:
            break  # Don't overflow

        draw.rounded_rectangle(
            [tag_x, tag_y, tag_x + tw + pad_x * 2, tag_y + th + pad_y * 2],
            radius=16, fill=TAG_BG,
        )
        draw.text((tag_x + pad_x, tag_y + pad_y - 2), tag_text, font=font_tag, fill=TAG_FG)
        tag_x += tw + pad_x * 2 + 12

    # Bottom: Author + Blog URL
    bottom_y = cy + ch - 80

    # Avatar
    if ICON_PATH.exists():
        try:
            avatar = Image.open(ICON_PATH).convert("RGBA")
            avatar = avatar.resize((52, 52), Image.LANCZOS)
            mask = Image.new("L", (52, 52), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, 52, 52], fill=255)
            img.paste(avatar.convert("RGB"), (title_x, bottom_y), mask)
            draw = ImageDraw.Draw(img)
            draw.ellipse(
                [title_x - 1, bottom_y - 1, title_x + 53, bottom_y + 53],
                outline=(230, 230, 230), width=2,
            )
        except Exception:
            pass

    # Author name
    draw.text((title_x + 68, bottom_y + 12), AUTHOR, font=font_author, fill=TEXT_MID)

    # Blog URL (right aligned)
    blog_bbox = font_blog.getbbox(BLOG_URL)
    blog_w = blog_bbox[2] - blog_bbox[0]
    draw.text((cx + cw - 72 - blog_w, bottom_y + 16), BLOG_URL, font=font_blog, fill=TEXT_LIGHT)

    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), "PNG")


def main():
    if not POSTS_DIR.exists():
        print(f"posts/ directory not found at {POSTS_DIR}")
        sys.exit(1)

    OG_DIR.mkdir(exist_ok=True)

    posts = sorted(POSTS_DIR.glob("*.md"))
    if not posts:
        print("No posts found.")
        return

    generated = 0
    for post_path in posts:
        slug = post_path.stem
        output_path = OG_DIR / f"{slug}.png"

        # Skip if image is newer than post
        if output_path.exists() and output_path.stat().st_mtime > post_path.stat().st_mtime:
            print(f"  skip (up to date): {slug}")
            continue

        fm = parse_frontmatter(post_path)
        title = fm.get("title", slug)
        tags = fm.get("tags", [])

        print(f"  generating: {slug}")
        generate_card(title, tags, output_path)
        generated += 1

    print(f"Done. {generated} image(s) generated, {len(posts) - generated} skipped.")


if __name__ == "__main__":
    main()
