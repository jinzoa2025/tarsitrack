"""Generate the installable app icons from simple brand geometry."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1] / "public"


def make(size: int) -> None:
    scale = size / 512
    image = Image.new("RGBA", (size, size), (3, 25, 48, 255))
    draw = ImageDraw.Draw(image)
    inset = round(36 * scale)
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=round(104 * scale),
        fill=(6, 63, 110, 255),
        outline=(40, 191, 246, 255),
        width=max(2, round(8 * scale)),
    )
    glow = Image.new("RGBA", image.size)
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((round(95 * scale), round(94 * scale), round(425 * scale), round(424 * scale)), fill=(24, 157, 231, 45))
    image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(round(54 * scale))))
    leaf = Image.new("RGBA", image.size)
    ld = ImageDraw.Draw(leaf)
    ld.line([(round(256 * scale), round(367 * scale)), (round(256 * scale), round(217 * scale))], fill=(126, 236, 252, 255), width=round(10 * scale))
    for box, angle in [
        ((200, 150, 270, 260), -38),
        ((251, 130, 322, 245), 39),
        ((181, 245, 265, 330), -54),
        ((255, 243, 340, 329), 54),
    ]:
        shape = Image.new("RGBA", (round(170 * scale), round(170 * scale)))
        sd = ImageDraw.Draw(shape)
        sd.ellipse((round(38 * scale), round(15 * scale), round(132 * scale), round(155 * scale)), fill=(72, 225, 246, 255))
        shape = shape.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
        center_x = round(((box[0] + box[2]) / 2) * scale)
        center_y = round(((box[1] + box[3]) / 2) * scale)
        leaf.alpha_composite(shape, (center_x - shape.width // 2, center_y - shape.height // 2))
    image = Image.alpha_composite(image, leaf)
    image.save(ROOT / f"icon-{size}.png")


if __name__ == "__main__":
    ROOT.mkdir(exist_ok=True)
    for dimension in (192, 512):
        make(dimension)
