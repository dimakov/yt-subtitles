"""Draws the extension icons (extension/icons/icon{16,32,48,128}.png) and the
300 x 300 store logo (store/images/logo-300.png).

The artwork is a rounded indigo tile with a download arrow above two caption
bars. Each size is rendered at 8x and downscaled for clean anti-aliasing.

Usage: python3 scripts/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZES = (16, 32, 48, 128)
SCALE = 8
TILE = (52, 81, 209, 255)
INK = (255, 255, 255, 255)
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "extension" / "icons"
STORE_LOGO = ROOT / "store" / "images" / "logo-300.png"


def draw(size: int) -> Image.Image:
    s = size * SCALE
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    u = s / 32  # design grid: 32 x 32 units

    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=7 * u, fill=TILE)

    # Download arrow: shaft plus head.
    d.rectangle((14 * u, 5 * u, 18 * u, 13 * u), fill=INK)
    d.polygon([(9 * u, 12 * u), (23 * u, 12 * u), (16 * u, 19 * u)], fill=INK)

    # Caption bars: a long line over a shorter one.
    d.rounded_rectangle((6 * u, 21 * u, 26 * u, 24 * u), radius=1.5 * u, fill=INK)
    d.rounded_rectangle((10 * u, 26 * u, 22 * u, 29 * u), radius=1.5 * u, fill=INK)

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon{size}.png"
        draw(size).save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)}")
    STORE_LOGO.parent.mkdir(parents=True, exist_ok=True)
    draw(300).save(STORE_LOGO, optimize=True)
    print(f"wrote {STORE_LOGO.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
