"""Create the Tracker app icons from the simple two-leaf brand mark."""

from PIL import Image, ImageDraw, ImageFilter


def icon(size: int) -> Image.Image:
    scale = 4
    canvas = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    edge = size * scale
    draw.rounded_rectangle((0, 0, edge - 1, edge - 1), radius=edge * 0.25, fill="#17483e")
    draw.rounded_rectangle((edge * 0.03, edge * 0.03, edge * 0.97, edge * 0.97), radius=edge * 0.23, outline="#456f5d", width=max(1, int(edge * 0.009)))

    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((edge * 0.04, edge * 0.04, edge * 0.92, edge * 0.75), fill=(105, 187, 132, 48))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(edge * 0.14)))

    for x, y, width, height, angle, color in [
        (0.32, 0.23, 0.19, 0.55, 28, "#c8e7a8"),
        (0.57, 0.30, 0.18, 0.43, 28, "#84c7a0"),
    ]:
        leaf = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        leaf_draw = ImageDraw.Draw(leaf)
        box = (int(x * edge), int(y * edge), int((x + width) * edge), int((y + height) * edge))
        leaf_draw.rounded_rectangle(box, radius=int(width * edge * 0.36), fill=color)
        leaf = leaf.rotate(angle, resample=Image.Resampling.BICUBIC, center=(edge // 2, edge // 2))
        canvas.alpha_composite(leaf)

    return canvas.resize((size, size), Image.Resampling.LANCZOS)


if __name__ == "__main__":
    for dimension in (192, 512):
        icon(dimension).save(f"public/tracker-icon-{dimension}.png")
