#!/usr/bin/env python3
"""Generate the Minecraft-style pixel assets for the build tracker (EDICT-0005).

Everything is drawn procedurally at 16x16 and nearest-neighbour scaled by the CSS
(`image-rendering: pixelated`), so the repository carries no external art.

Run with the bundled Python that has Pillow:
    <dsh python> scripts/gen-assets.py

Deterministic: fixed random seeds, no timestamps in output.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEX = ROOT / "src" / "assets" / "textures"
ICONS = ROOT / "src" / "assets" / "icons"
S = 16


def px(im: Image.Image, x: int, y: int, colour: tuple[int, ...]) -> None:
    im.putpixel((x % S, y % S), colour)


def noise_block(seed: int, base: tuple[int, int, int], variants: list[tuple[int, int, int]],
                specks: list[tuple[int, int, int]]) -> Image.Image:
    rng = random.Random(seed)
    im = Image.new("RGBA", (S, S), base + (255,))
    for y in range(S):
        for x in range(S):
            roll = rng.random()
            if roll < 0.42:
                px(im, x, y, rng.choice(variants) + (255,))
            elif roll < 0.52:
                px(im, x, y, rng.choice(specks) + (255,))
    return im


DIRT_BASE = (134, 96, 67)
DIRT_VAR = [(121, 85, 58), (150, 111, 79), (108, 76, 51)]
DIRT_SPECK = [(90, 63, 43), (163, 124, 92)]


def dirt(seed: int = 7) -> Image.Image:
    return noise_block(seed, DIRT_BASE, DIRT_VAR, DIRT_SPECK)


def stone(seed: int = 11) -> Image.Image:
    return noise_block(seed, (127, 127, 127), [(117, 117, 117), (138, 138, 138), (109, 109, 109)],
                       [(150, 150, 150), (96, 96, 96)])


def cobblestone(seed: int = 13) -> Image.Image:
    im = noise_block(seed, (122, 122, 122), [(104, 104, 104), (140, 140, 140)], [(88, 88, 88)])
    rng = random.Random(seed + 1)
    for _ in range(9):  # mortar-ish dark seams between "stones"
        x, y = rng.randrange(S), rng.randrange(S)
        for i in range(rng.randint(2, 4)):
            px(im, x + i, y, (86, 86, 86, 255))
    return im


def planks(seed: int = 17) -> Image.Image:
    rng = random.Random(seed)
    im = Image.new("RGBA", (S, S), (176, 139, 90, 255))
    for y in range(S):
        for x in range(S):
            roll = rng.random()
            c = (176, 139, 90)
            if roll < 0.3:
                c = (163, 128, 82)
            elif roll < 0.45:
                c = (190, 152, 100)
            px(im, x, y, c + (255,))
    for y in (3, 7, 11, 15):
        for x in range(S):
            px(im, x, y, (120, 94, 61, 255))
    for (x, y0) in ((5, 0), (12, 4), (3, 8), (9, 12)):
        for y in range(y0, y0 + 3):
            px(im, x, y, (120, 94, 61, 255))
    return im


def log(seed: int = 19) -> Image.Image:
    rng = random.Random(seed)
    im = Image.new("RGBA", (S, S), (107, 79, 42, 255))
    for x in range(S):
        shade = (94, 69, 36) if (x % 4 in (1, 2)) else (122, 90, 48)
        for y in range(S):
            px(im, x, y, shade + (255,))
    for _ in range(18):
        px(im, rng.randrange(S), rng.randrange(S), (78, 57, 30, 255))
    return im


def bricks(seed: int = 23) -> Image.Image:
    im = noise_block(seed, (138, 138, 138), [(126, 126, 126), (150, 150, 150)], [(110, 110, 110)])
    for y in range(S):
        for x in range(S):
            if y in (5, 6, 11, 12):
                px(im, x, y, (96, 96, 96, 255))
            elif y < 5 and x == 8:
                px(im, x, y, (96, 96, 96, 255))
            elif 6 < y < 11 and x == 0:
                px(im, x, y, (96, 96, 96, 255))
            elif 12 < y and x == 8:
                px(im, x, y, (96, 96, 96, 255))
    return im


def glass() -> Image.Image:
    im = Image.new("RGBA", (S, S), (200, 230, 240, 45))
    frame = (74, 92, 104, 255)
    for i in range(S):
        px(im, i, 0, frame)
        px(im, i, S - 1, frame)
        px(im, 0, i, frame)
        px(im, S - 1, i, frame)
    for (x, y) in ((2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (3, 11), (4, 12), (10, 3), (11, 4), (12, 5)):
        px(im, x, y, (245, 255, 255, 235))
    for (x, y) in ((9, 11), (10, 10), (11, 9), (12, 8)):
        px(im, x, y, (170, 205, 220, 160))
    return im


def grass_top(seed: int = 29) -> Image.Image:
    return noise_block(seed, (91, 143, 58), [(79, 130, 50), (105, 160, 67)], [(70, 116, 44), (120, 175, 78)])


def grass_side(seed: int = 31) -> Image.Image:
    im = dirt(seed)
    rng = random.Random(seed)
    for x in range(S):
        depth = rng.choice([3, 3, 4, 4, 5])
        for y in range(depth):
            px(im, x, y, rng.choice([(91, 143, 58), (79, 130, 50), (105, 160, 67)]) + (255,))
    return im


PALETTE = {
    ".": (0, 0, 0, 0),
    "k": (24, 24, 24, 255),
    "w": (255, 255, 255, 255),
    "g": (200, 200, 200, 255),
    "G": (160, 160, 160, 255),
    "d": (110, 110, 110, 255),
    "D": (70, 70, 70, 255),
    "b": (96, 96, 96, 255),
    "r": (200, 60, 50, 255),
    "R": (150, 36, 30, 255),
    "y": (250, 200, 60, 255),
    "Y": (206, 150, 30, 255),
    "n": (120, 80, 40, 255),
    "N": (86, 56, 26, 255),
    "c": (110, 220, 235, 255),
    "C": (60, 170, 190, 255),
    "e": (90, 240, 110, 255),
    "E": (40, 170, 70, 255),
}


def from_ascii(rows: list[str]) -> Image.Image:
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            im.putpixel((x, y), PALETTE[ch])
    return im


INGOT = [
    "................",
    "................",
    "................",
    "....kkkkkkkk....",
    "...kggggggggk...",
    "..kgwwgggggggk..",
    "..kgggggggggGk..",
    "..kggggggggGGk..",
    "..kgggggggGGdk..",
    "..kGgggggGGddk..",
    "..kGGGGGGGGddk..",
    "...kkkkkkkkkk...",
    "................",
    "................",
    "................",
    "................",
]

DIAMOND = [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....kcccccck....",
    "...kccwwcccck...",
    "..kcccwcccccck..",
    ".kcccccccccccck.",
    "..kcccccccccck..",
    "...kcccccccck...",
    "....kcccccck....",
    ".....kkkkkk.....",
    "................",
    "................",
    "................",
    "................",
]

TORCH = [
    "................",
    "................",
    "......kkkk......",
    ".....kyyyyk.....",
    "....kyywwyyk....",
    "....kyywwyyk....",
    ".....kyyyyk.....",
    "......kNNk......",
    "......kNnk......",
    "......kNnk......",
    "......kNnk......",
    "......kNnk......",
    "......kNnk......",
    "......kkkk......",
    "................",
    "................",
]

BUCKET = [
    "................",
    "................",
    "....kkkkkkkk....",
    "....kggggggk....",
    "....kcccccck....",
    "...kgccccccgk...",
    "...kgccccccGk...",
    "...kgccccccGk...",
    "...kGccccccGk...",
    "....kGccccGk....",
    "....kGGGGGGk....",
    ".....kkkkkk.....",
    "................",
    "................",
    "................",
    "................",
]

CHEST = [
    "................",
    "................",
    "...kkkkkkkkkk...",
    "..kNNNNNNNNNNk..",
    "..kNnnnnnnnnNk..",
    "..kNnnnnnnnnNk..",
    "..kkkkkkkkkkkk..",
    "..kNnnnnnnnnNk..",
    "..kNnnnyynnNNk..",
    "..kNnnnyynnNNk..",
    "..kNnnnnnnnnNk..",
    "..kNNNNNNNNNNk..",
    "...kkkkkkkkkk...",
    "................",
    "................",
    "................",
]

CRAFTING = [
    "................",
    "...kkkkkkkkkk...",
    "..knnnnnnnnnnk..",
    "..kNkkkkkkkkNk..",
    "..kNknnknnkkNk..",
    "..kNkkkkkkkkNk..",
    "..kNknnknnkkNk..",
    "..kNkkkkkkkkNk..",
    "..kNknnknnkkNk..",
    "..kNkkkkkkkkNk..",
    "..knnnnnnnnnnk..",
    "...kkkkkkkkkk...",
    "................",
    "................",
    "................",
    "................",
]

COAL = [
    "................",
    "................",
    "................",
    "......kkkk......",
    ".....kDDDDk.....",
    "....kDDkkDDk....",
    "...kDDkkkkDDk...",
    "...kDkkkkkkDk...",
    "...kDkkkkkkDk...",
    "....kDkkkkDk....",
    ".....kDDDDk.....",
    "......kkkk......",
    "................",
    "................",
    "................",
    "................",
]

REDSTONE = [
    "................",
    "................",
    "......r..r......",
    "....r.rr.r.r....",
    "...r.rrrrrr.r...",
    "...rr.rrrr.rr...",
    "..r.rrrrrrrr.r..",
    "..rr.rrrrrr.rr..",
    "..rrrrrrrrrrrr..",
    "...rr.rrrr.rr...",
    "...r.rrrrrr.r...",
    "....r.rr.r.r....",
    "......R..R......",
    "................",
    "................",
    "................",
]

BREAD = [
    "................",
    "................",
    "................",
    "....kkkkkkkk....",
    "...knnnnnnnnk...",
    "..knyynnnnyynk..",
    "..knyynnnnyynk..",
    "..knnnnnnnnnnk..",
    "..knnnnnnnnnNk..",
    "..knnnnnnnnNNk..",
    "..kNNNNNNNNNNk..",
    "...kkkkkkkkkk...",
    "................",
    "................",
    "................",
    "................",
]


def pad(im: Image.Image) -> Image.Image:
    assert im.size == (S, S)
    return im


def write(name: str, im: Image.Image, folder: Path = ICONS) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    pad(im).save(folder / name, optimize=True)


def main() -> None:
    TEX.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    textures = {
        "dirt.png": dirt(),
        "stone.png": stone(),
        "cobblestone.png": cobblestone(),
        "planks.png": planks(),
        "log.png": log(),
        "stone_bricks.png": bricks(),
        "glass.png": glass(),
        "grass_top.png": grass_top(),
        "grass_side.png": grass_side(),
    }
    for name, im in textures.items():
        write(name, im, TEX)

    # Real Minecraft icons (scripts/mc-icons.py) take precedence: never overwrite them
    # with generated approximations, or the app silently loses its vanilla look.
    if (ICONS / "manifest.json").exists() or (ICONS / "icons.js").exists():
        print("refusing to generate placeholder icons: vanilla icons are installed in src/assets/icons")
        print("(delete src/assets/icons/manifest.json and icons.js first if you really want placeholders)")
        icons = {}
    else:
        icons = {
            "dirt.png": dirt(41),
            "grass_block.png": grass_side(43),
            "cobblestone.png": cobblestone(47),
            "stone.png": stone(53),
            "stone_bricks.png": bricks(59),
            "oak_log.png": log(61),
            "oak_planks.png": planks(67),
            "glass.png": glass(),
            "iron_ingot.png": from_ascii(INGOT),
            "diamond.png": from_ascii(DIAMOND),
            "torch.png": from_ascii(TORCH),
            "water_bucket.png": from_ascii(BUCKET),
            "chest.png": from_ascii(CHEST),
            "crafting_table.png": from_ascii(CRAFTING),
            "coal.png": from_ascii(COAL),
            "redstone.png": from_ascii(REDSTONE),
            "bread.png": from_ascii(BREAD),
        }
        # recolour a copy of the ingot so gold is visibly distinct from iron
        gold_icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        src = from_ascii(INGOT)
        mapping = {
            (200, 200, 200, 255): (250, 214, 90, 255),
            (160, 160, 160, 255): (214, 166, 48, 255),
            (110, 110, 110, 255): (170, 120, 30, 255),
        }
        for y in range(S):
            for x in range(S):
                gold_icon.putpixel((x, y), mapping.get(src.getpixel((x, y)), src.getpixel((x, y))))
        icons["gold_ingot.png"] = gold_icon
        for name, im in icons.items():
            write(name, im)

    # favicon: a tiny grass block side, 16x16 (browsers scale it)
    write("favicon.png", grass_side(71), ROOT / "src" / "assets")

    print(f"textures: {len(textures)} -> {TEX}")
    print(f"icons:    {len(icons)} -> {ICONS}")
    print(f"favicon:  {ROOT / 'src' / 'assets' / 'favicon.png'}")


if __name__ == "__main__":
    main()
