"""Generate small-size (sm) and dark-tone (ink) variants from the 256px 3D renders.

Both variants are derived from the existing 3D artwork; nothing is redrawn as flat
vector art. `sm` downscales the render to 64px (so sub-pixel tube detail becomes a
clean silhouette at 14-20px display), restores opacity weight with a light alpha
dilate, and applies a mild unsharp mask. `ink` remaps luminance onto a dark violet
ramp so on-light-card glyphs keep their 3D shading instead of being flattened by a
`brightness(0)` CSS filter.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

SRC = Path('public/icons/3d-v2')
GLYPHS = [
    'Cloud', 'Eye', 'EyeOff', 'ChevronDown', 'ChevronRight', 'ChevronLeft',
    'Plus', 'ArrowRight', 'ArrowUpRight', 'ArrowDownLeft', 'ArrowLeftRight',
    'Check', 'X', 'Info', 'Search', 'Cross', 'LoaderCircle', 'RefreshCw',
]
SM_SIZE = 64
DILATE = 3  # kernel size at the 64px render (~1px optical weight at 16-20px display)

INK_LO = (26, 19, 38)     # deep ink instead of pure black
INK_HI = (158, 140, 200)  # shaded lavender highlight


def luminance(px):
    r, g, b = px[:3]
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


def build_ink(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    alpha = im.split()[-1]
    lum = im.convert('L')
    # Normalise using only opaque pixels: transparent pixels are (0,0,0,0), and
    # including them would pin the range to 0-255 and flatten the artwork's
    # shading into a near-uniform silhouette.
    values = sorted(v for v, a in zip(lum.getdata(), alpha.getdata()) if a > 8)
    lo = values[int(len(values) * 0.04)]
    hi = values[int(len(values) * 0.96)]
    span = max(1, hi - lo)

    def shade(v: int) -> tuple[int, int, int]:
        t = min(1.0, max(0.0, (v - lo) / span))
        return tuple(round(INK_LO[i] + (INK_HI[i] - INK_LO[i]) * t) for i in range(3))

    ramp = [shade(x) for x in range(256)]
    flat = []
    for v in range(256):
        flat.extend(ramp[v])
    ink = Image.new('RGB', im.size)
    ink.putdata([tuple(flat[v * 3:v * 3 + 3]) for v in lum.getdata()])
    ink.putalpha(alpha)
    return ink


def build_sm(im: Image.Image) -> Image.Image:
    sm = im.convert('RGBA').resize((SM_SIZE, SM_SIZE), Image.LANCZOS)
    # Trim ~4% of the frame and re-expand: the render's own strokes gain ~8%
    # optical weight (the "simplified" small-size read) without a synthetic
    # outline or a black dilation ring.
    inset = round(SM_SIZE * 0.04)
    sm = sm.crop((inset, inset, SM_SIZE - inset, SM_SIZE - inset)).resize(
        (SM_SIZE, SM_SIZE), Image.LANCZOS
    )
    px = list(sm.getdata())
    opaque = sorted((0.2126 * r + 0.7152 * g + 0.0722 * b) for r, g, b, a in px if a > 8)
    lo = opaque[int(len(opaque) * 0.05)]
    hi = opaque[int(len(opaque) * 0.95)]
    span = max(1.0, hi - lo)
    out = []
    # A pale matte render flattens into a white line on the dark canvas. Deepen
    # the render's own light/shadow curve (no new outlines) so the bevel survives
    # at 14-20px; hue and silhouette are untouched.
    for r, g, b, a in px:
        if not a:
            out.append((0, 0, 0, 0))
            continue
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        f = 0.55 + 0.45 * min(1.0, max(0.0, (lum - lo) / span))
        out.append((min(255, round(r * f)), min(255, round(g * f)), min(255, round(b * f)), a))
    shade = Image.new('RGBA', (SM_SIZE, SM_SIZE))
    shade.putdata(out)
    # Directional bevel lit from the top-left: a height field taken from the
    # silhouette alpha is embossed and used as a light multiplier. This is the
    # step that keeps a tube's top highlight and underside shadow readable at
    # 14-21px instead of collapsing into one flat fill.
    alpha_channel = sm.split()[-1]
    emb = alpha_channel.filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.EMBOSS)
    lit = []
    for (r, g, b, al), e in zip(list(shade.getdata()), list(emb.getdata())):
        f = max(0.35, min(1.2, 1.0 + (e - 128) / 128.0 * 0.55))
        lit.append((min(255, round(r * f)), min(255, round(g * f)), min(255, round(b * f)), al))
    shade.putdata(lit)
    return shade.filter(ImageFilter.UnsharpMask(radius=1.0, percent=55, threshold=2))


def main() -> None:
    (SRC / 'sm').mkdir(exist_ok=True)
    (SRC / 'ink').mkdir(exist_ok=True)
    (SRC / 'ink-sm').mkdir(exist_ok=True)
    for name in GLYPHS:
        im = Image.open(SRC / f'{name}.webp')
        build_sm(im).save(SRC / 'sm' / f'{name}.webp', quality=88, method=6)
        ink = build_ink(im)
        ink.save(SRC / 'ink' / f'{name}.webp', quality=90, method=6)
        build_sm(ink).save(SRC / 'ink-sm' / f'{name}.webp', quality=88, method=6)
    print('variants written', len(GLYPHS))


if __name__ == '__main__':
    main()
