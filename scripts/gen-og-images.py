#!/usr/bin/env python3
"""Generate OG card images for all blog posts.

Design: "Soft Blue Atmosphere"
- Light blue gradient background with white rounded card
- Author avatar + name at top-left, blog name at top-right
- Large bold title in center, tags below
- Blue accent dot decoration

Usage:
    python3 scripts/gen-og-images.py
    python3 scripts/gen-og-images.py --force   # regenerate all

Reads all .md files in posts/, extracts frontmatter,
and generates 1200x630 OG card images to og/.
"""

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
BLOG_NAME = "逆瀬川ちゃんのブログ"
AUTHOR = "逆瀬川ちゃん"

# --- Colors ---
BG_TOP = (235, 244, 252)
BG_BOTTOM = (210, 228, 245)
WHITE = (255, 255, 255)
TEXT_DARK = (26, 26, 46)
TEXT_AUTHOR = (80, 80, 95)
TEXT_BLOG = (160, 175, 190)
ACCENT_BLUE = (107, 163, 199)
TAG_FG = (107, 163, 199)
TAG_BG = (228, 239, 248)
CIRCLE_DECO = (200, 222, 242, 50)


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
    return lines[:4]


def generate_card(title: str, tags: list[str], output_path: Path):
    """Generate a single OG card image with Soft Blue design."""
    # Load fonts
    font_title = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-ExtraBold.ttf"), 50)
    font_tag = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 18)
    font_author = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 22)
    font_blog = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Regular.ttf"), 20)

    # --- Background: vertical blue gradient ---
    img = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(WIDTH):
            img.putpixel((x, y), (r, g, b))

    # --- Decorative circles (subtle background) ---
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse([-80, -80, 200, 200], fill=CIRCLE_DECO)
    odraw.ellipse([WIDTH - 250, HEIGHT - 200, WIDTH + 50, HEIGHT + 50], fill=CIRCLE_DECO)
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    img = img_rgba.convert("RGB")
    draw = ImageDraw.Draw(img)

    # --- White card with shadow ---
    card_mx, card_my = 56, 36
    cx, cy = card_mx, card_my
    cw = WIDTH - card_mx * 2
    ch = HEIGHT - card_my * 2
    radius = 20

    # Shadow
    shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [cx + 2, cy + 4, cx + cw + 2, cy + ch + 4],
        radius=radius, fill=(0, 0, 0, 12),
    )
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, shadow)
    img = img_rgba.convert("RGB")
    draw = ImageDraw.Draw(img)

    # Card body
    draw.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=radius, fill=WHITE)

    # --- Blue accent dot (top-left of card) ---
    dot_r = 8
    draw.ellipse(
        [cx + 28, cy + 28, cx + 28 + dot_r * 2, cy + 28 + dot_r * 2],
        fill=ACCENT_BLUE,
    )

    # --- Author avatar + name (top-left inside card) ---
    author_x = cx + 60
    author_y = cy + 32
    if ICON_PATH.exists():
        try:
            avatar = Image.open(ICON_PATH).convert("RGBA")
            avatar = avatar.resize((40, 40), Image.LANCZOS)
            mask = Image.new("L", (40, 40), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, 40, 40], fill=255)
            img.paste(avatar.convert("RGB"), (author_x, author_y), mask)
            draw = ImageDraw.Draw(img)
        except Exception:
            pass
    draw.text((author_x + 52, author_y + 8), AUTHOR, font=font_author, fill=TEXT_AUTHOR)

    # --- Blog name (top-right inside card) ---
    blog_bbox = font_blog.getbbox(BLOG_NAME)
    blog_w = blog_bbox[2] - blog_bbox[0]
    draw.text((cx + cw - 40 - blog_w, author_y + 10), BLOG_NAME, font=font_blog, fill=TEXT_BLOG)

    # --- Title (upper-center inside card) ---
    title_x = cx + 60
    title_max_w = cw - 120
    lines = wrap_title(title, font_title, title_max_w)
    line_height = 70
    title_start_y = cy + 100

    for i, line in enumerate(lines):
        draw.text(
            (title_x, title_start_y + i * line_height),
            line, font=font_title, fill=TEXT_DARK,
        )

    # --- Tags (below title) ---
    total_title_h = len(lines) * line_height
    tag_y = title_start_y + total_title_h + 20
    tag_x = title_x
    for tag_text in tags[:5]:
        bbox = font_tag.getbbox(tag_text)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        pad_x, pad_y = 14, 7
        if tag_x + tw + pad_x * 2 > cx + cw - 40:
            break
        draw.rounded_rectangle(
            [tag_x, tag_y, tag_x + tw + pad_x * 2, tag_y + th + pad_y * 2],
            radius=14, fill=TAG_BG,
        )
        draw.text((tag_x + pad_x, tag_y + pad_y - 2), tag_text, font=font_tag, fill=TAG_FG)
        tag_x += tw + pad_x * 2 + 10

    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), "PNG")


def main():
    force = "--force" in sys.argv

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

        if not force and output_path.exists() and output_path.stat().st_mtime > post_path.stat().st_mtime:
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
