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
    """Generate a single OG card image with Soft Blue design.

    Renders at 2x resolution then downscales for smooth anti-aliasing.
    """
    S = 2  # supersampling scale
    W, H = WIDTH * S, HEIGHT * S

    # Load fonts (at 2x size)
    font_title = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-ExtraBold.ttf"), 54 * S)
    font_tag = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 18 * S)
    font_author = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Bold.ttf"), 30 * S)
    font_blog = ImageFont.truetype(str(FONTS_DIR / "MPLUSRounded1c-Regular.ttf"), 28 * S)

    # --- Background: vertical blue gradient ---
    img = Image.new("RGB", (W, H), WHITE)
    for y in range(H):
        t = y / H
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(W):
            img.putpixel((x, y), (r, g, b))

    # --- Decorative circles (subtle background) ---
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse([-80 * S, -80 * S, 200 * S, 200 * S], fill=CIRCLE_DECO)
    odraw.ellipse([W - 250 * S, H - 200 * S, W + 50 * S, H + 50 * S], fill=CIRCLE_DECO)
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    img = img_rgba.convert("RGB")
    draw = ImageDraw.Draw(img)

    # --- White card with shadow ---
    card_mx, card_my = 56 * S, 36 * S
    cx, cy = card_mx, card_my
    cw = W - card_mx * 2
    ch = H - card_my * 2
    radius = 20 * S

    # Shadow
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

    # Card body
    draw.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=radius, fill=WHITE)

    # --- Blue accent dot (top-right of card) ---
    dot_r = 8 * S
    draw.ellipse(
        [cx + cw - 48 * S, cy + 28 * S, cx + cw - 48 * S + dot_r * 2, cy + 28 * S + dot_r * 2],
        fill=ACCENT_BLUE,
    )

    # --- Author avatar + name (top-left inside card) ---
    avatar_size = 120 * S
    author_x = cx + 40 * S
    author_y = cy + 28 * S
    if ICON_PATH.exists():
        try:
            avatar = Image.open(ICON_PATH).convert("RGBA")
            avatar = avatar.resize((avatar_size, avatar_size), Image.LANCZOS)
            mask = Image.new("L", (avatar_size, avatar_size), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, avatar_size, avatar_size], fill=255)
            img.paste(avatar.convert("RGB"), (author_x, author_y), mask)
            draw = ImageDraw.Draw(img)
        except Exception:
            pass

    # Author name + blog name (right of avatar, stacked vertically)
    text_x = author_x + avatar_size + 20 * S
    author_bbox = font_author.getbbox(AUTHOR)
    author_h = author_bbox[3] - author_bbox[1]
    blog_bbox = font_blog.getbbox(BLOG_NAME)
    blog_h = blog_bbox[3] - blog_bbox[1]
    total_text_h = author_h + 8 * S + blog_h
    text_top_y = author_y + (avatar_size - total_text_h) // 2
    draw.text((text_x, text_top_y), AUTHOR, font=font_author, fill=TEXT_AUTHOR)
    draw.text((text_x, text_top_y + author_h + 8 * S), BLOG_NAME, font=font_blog, fill=TEXT_BLOG)

    # --- Title (below avatar area) ---
    title_x = cx + 60 * S
    title_max_w = cw - 120 * S
    lines = wrap_title(title, font_title, title_max_w)
    line_height = 74 * S
    title_start_y = author_y + avatar_size + 24 * S

    for i, line in enumerate(lines):
        draw.text(
            (title_x, title_start_y + i * line_height),
            line, font=font_title, fill=TEXT_DARK,
        )

    # --- Tags (below title) ---
    total_title_h = len(lines) * line_height
    tag_y = title_start_y + total_title_h + 20 * S
    tag_x = title_x
    for tag_text in tags[:5]:
        bbox = font_tag.getbbox(tag_text)
        t_left, t_top, t_right, t_bottom = bbox
        tw = t_right - t_left
        th = t_bottom - t_top
        pad_x, pad_y = 14 * S, 8 * S
        box_w = tw + pad_x * 2
        box_h = th + pad_y * 2
        if tag_x + box_w > cx + cw - 40 * S:
            break
        draw.rounded_rectangle(
            [tag_x, tag_y, tag_x + box_w, tag_y + box_h],
            radius=14 * S, fill=TAG_BG,
        )
        # Center text vertically within the pill
        text_y = tag_y + pad_y - t_top
        draw.text((tag_x + pad_x - t_left, text_y), tag_text, font=font_tag, fill=TAG_FG)
        tag_x += box_w + 10 * S

    # Downscale to final size for smooth anti-aliasing
    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)

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
