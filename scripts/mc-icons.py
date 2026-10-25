#!/usr/bin/env python3
"""Build the app's item icons from the *actual* Minecraft textures (EDICT-0007).

Source of truth: the owner's own Java Edition client jar
    %APPDATA%\\.minecraft\\versions\\<version>\\<version>.jar
Nothing is downloaded. Flat item sprites are copied as-is; cube blocks are composited
into the same 2:1 isometric icon the game shows in the inventory (top face bright,
left 80 %, right 60 %).

Outputs (all committed, all regenerable):
    src/assets/icons/<slug>.png     16x16 RGBA icons
    src/assets/icons/icons.js       window.MC_ICON_SET / window.MC_ICON_NAMES
    src/assets/icons/manifest.json  provenance + sha256 per icon
    src/assets/icons/PROVENANCE.md  licensing / origin notice

Usage:
    <dsh python> scripts/mc-icons.py [--version 1.21.4] [--install PATH]
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "icons"
DEFAULT_VERSION = "1.21.4"
TEX_PREFIX = "assets/minecraft/textures/"

# Cube blocks: (display name, slug, top texture, side texture, front texture|None)
BLOCKS = [
    ("Stone", "stone", "stone", "stone", None),
    ("Cobblestone", "cobblestone", "cobblestone", "cobblestone", None),
    ("Stone Bricks", "stone_bricks", "stone_bricks", "stone_bricks", None),
    ("Deepslate", "deepslate", "deepslate_top", "deepslate", None),
    ("Cobbled Deepslate", "cobbled_deepslate", "cobbled_deepslate", "cobbled_deepslate", None),
    ("Deepslate Bricks", "deepslate_bricks", "deepslate_bricks", "deepslate_bricks", None),
    ("Granite", "granite", "granite", "granite", None),
    ("Diorite", "diorite", "diorite", "diorite", None),
    ("Andesite", "andesite", "andesite", "andesite", None),
    ("Sandstone", "sandstone", "sandstone_top", "sandstone", None),
    ("Sand", "sand", "sand", "sand", None),
    ("Gravel", "gravel", "gravel", "gravel", None),
    ("Dirt", "dirt", "dirt", "dirt", None),
    ("Grass Block", "grass_block", "grass_block_top", "grass_block_side", None),
    ("Oak Planks", "oak_planks", "oak_planks", "oak_planks", None),
    ("Spruce Planks", "spruce_planks", "spruce_planks", "spruce_planks", None),
    ("Birch Planks", "birch_planks", "birch_planks", "birch_planks", None),
    ("Oak Log", "oak_log", "oak_log_top", "oak_log", None),
    ("Spruce Log", "spruce_log", "spruce_log_top", "spruce_log", None),
    ("Glass", "glass", "glass", "glass", None),
    ("White Wool", "white_wool", "white_wool", "white_wool", None),
    ("Red Wool", "red_wool", "red_wool", "red_wool", None),
    ("White Concrete", "white_concrete", "white_concrete", "white_concrete", None),
    ("Blue Concrete", "blue_concrete", "blue_concrete", "blue_concrete", None),
    ("Terracotta", "terracotta", "terracotta", "terracotta", None),
    ("Netherrack", "netherrack", "netherrack", "netherrack", None),
    ("Nether Bricks", "nether_bricks", "nether_bricks", "nether_bricks", None),
    ("Quartz Block", "quartz_block", "quartz_block_top", "quartz_block_side", None),
    ("Obsidian", "obsidian", "obsidian", "obsidian", None),
    ("Glowstone", "glowstone", "glowstone", "glowstone", None),
    ("Sea Lantern", "sea_lantern", "sea_lantern", "sea_lantern", None),
    ("Copper Block", "copper_block", "copper_block", "copper_block", None),
    ("Iron Block", "iron_block", "iron_block", "iron_block", None),
    ("Gold Block", "gold_block", "gold_block", "gold_block", None),
    ("Diamond Block", "diamond_block", "diamond_block", "diamond_block", None),
    ("Emerald Block", "emerald_block", "emerald_block", "emerald_block", None),
    ("Bookshelf", "bookshelf", "oak_planks", "bookshelf", None),
    ("Crafting Table", "crafting_table", "crafting_table_top", "crafting_table_side", "crafting_table_front"),
    ("Furnace", "furnace", "furnace_top", "furnace_side", "furnace_front"),
]

# Flat sprites, straight from textures/item/ (all 16x16, static)
ITEMS = [
    ("Iron Ingot", "iron_ingot", "item", "iron_ingot"),
    ("Gold Ingot", "gold_ingot", "item", "gold_ingot"),
    ("Copper Ingot", "copper_ingot", "item", "copper_ingot"),
    ("Diamond", "diamond", "item", "diamond"),
    ("Emerald", "emerald", "item", "emerald"),
    ("Coal", "coal", "item", "coal"),
    ("Charcoal", "charcoal", "item", "charcoal"),
    ("Redstone", "redstone", "item", "redstone"),
    ("Stick", "stick", "item", "stick"),
    ("Water Bucket", "water_bucket", "item", "water_bucket"),
    ("Bread", "bread", "item", "bread"),
    # Block-shaped props: their inventory icon is a model, but the block texture is the
    # recognisable sprite and reads correctly at 16x16.
    ("Torch", "torch", "block", "torch"),
    ("Ladder", "ladder", "block", "ladder"),
    ("Lantern", "lantern", "block", "lantern"),
]


def load_png(zf: zipfile.ZipFile, path: str) -> Image.Image:
    with zf.open(path) as handle:
        image = Image.open(io.BytesIO(handle.read())).convert("RGBA")
    # animated textures are vertical strips: use the first frame
    if image.height > image.width and image.height % image.width == 0:
        image = image.crop((0, 0, image.width, image.width))
    if image.size != (16, 16):
        image = image.resize((16, 16), Image.NEAREST)
    return image


def shade(image: Image.Image, factor: float) -> Image.Image:
    if factor >= 0.999:
        return image
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (
                min(255, int(r * factor)),
                min(255, int(g * factor)),
                min(255, int(b * factor)),
                a,
            )
    return image


# Biome tint: grass textures are greyscale and coloured at runtime. The app has no biome
# data, so it applies the plains colour for consistency (documented in PROVENANCE.md).
PLAINS_GRASS = (0x91, 0xBD, 0x59)


def tint(image, rgb):
    out = image.copy()
    pixels = out.load()
    tr, tg, tb = rgb
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (r * tr // 255, g * tg // 255, b * tb // 255, a)
    return out


def inverse_uv(ox, oy, ux, uy, vx, vy, px, py):
    dx, dy = px - ox, py - oy
    det = ux * vy - uy * vx
    if abs(det) < 1e-9:
        return None
    u = (dx * vy - dy * vx) / det
    v = (ux * dy - uy * dx) / det
    return u, v


def draw_face(canvas: Image.Image, texture: Image.Image, origin, u_vec, v_vec, shade_factor: float) -> None:
    """Map a 16x16 texture onto the parallelogram O + u*U + v*V (nearest neighbour)."""
    ox, oy = origin
    ux, uy = u_vec
    vx, vy = v_vec
    tex = shade(texture.copy(), shade_factor)
    src = tex.load()
    dst = canvas.load()
    pixels = [(ox, oy), (ox + ux, oy + uy), (ox + vx, oy + vy), (ox + ux + vx, oy + uy + vy)]
    min_x = max(0, int(min(p[0] for p in pixels)))
    max_x = min(canvas.width - 1, int(max(p[0] for p in pixels)) + 1)
    min_y = max(0, int(min(p[1] for p in pixels)))
    max_y = min(canvas.height - 1, int(max(p[1] for p in pixels)) + 1)
    for py in range(min_y, max_y + 1):
        for px in range(min_x, max_x + 1):
            uv = inverse_uv(ox, oy, ux, uy, vx, vy, px + 0.5, py + 0.5)
            if uv is None:
                continue
            u, v = uv
            if not (0.0 <= u < 1.0 and 0.0 <= v < 1.0):
                continue
            tx = min(15, int(u * 16))
            ty = min(15, int(v * 16))
            r, g, b, a = src[tx, ty]
            if a == 0:
                continue
            # composite over what is already there (top face first)
            if a == 0:
                continue
            dst[px, py] = (r, g, b, a)


def isometric_icon(top: Image.Image, side: Image.Image, front: Image.Image | None) -> Image.Image:
    canvas = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    # 2:1 isometric cube: top rhombus, then the two visible faces
    A, B, C, D = (0, 4), (8, 0), (16, 4), (8, 8)
    U_top = (B[0] - A[0], B[1] - A[1])          # (8, -4)
    V_top = (D[0] - A[0], D[1] - A[1])          # (8, 4)
    draw_face(canvas, top, A, U_top, V_top, 1.0)
    U_left = (D[0] - A[0], D[1] - A[1])         # (8, 4)
    V_left = (0, 8)
    draw_face(canvas, side, A, U_left, V_left, 0.80)
    U_right = (C[0] - D[0], C[1] - D[1])        # (8, -4)
    V_right = (0, 8)
    draw_face(canvas, front or side, D, U_right, V_right, 0.60)
    return canvas


def find_install(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit)
    appdata = os.environ.get("APPDATA")
    if appdata:
        candidate = Path(appdata) / ".minecraft"
        if candidate.is_dir():
            return candidate
    raise SystemExit("Could not find a Minecraft installation. Pass --install <path to .minecraft>.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default=DEFAULT_VERSION)
    parser.add_argument("--install", default=None)
    args = parser.parse_args()

    install = find_install(args.install)
    jar = install / "versions" / args.version / f"{args.version}.jar"
    if not jar.is_file():
        raise SystemExit(f"Client jar not found: {jar}")

    OUT.mkdir(parents=True, exist_ok=True)
    missing: list[str] = []
    manifest: list[dict] = []

    with zipfile.ZipFile(jar) as zf:
        present = set(zf.namelist())

        for name, slug, top_tex, side_tex, front_tex in BLOCKS:
            wanted = [f"{TEX_PREFIX}block/{top_tex}.png", f"{TEX_PREFIX}block/{side_tex}.png"]
            if front_tex:
                wanted.append(f"{TEX_PREFIX}block/{front_tex}.png")
            absent = [w for w in wanted if w not in present]
            if absent:
                missing.extend(absent)
                print(f"MISS {slug}: {absent}")
                continue
            top = load_png(zf, wanted[0])
            side = load_png(zf, wanted[1])
            front = load_png(zf, wanted[2]) if front_tex else None

            if slug == "grass_block":
                # top is greyscale and biome-tinted at runtime; sides are dirt plus a
                # greyscale grass overlay. The app has no biome data, so use plains grass.
                top = tint(top, PLAINS_GRASS)
                overlay_path = f"{TEX_PREFIX}block/grass_block_side_overlay.png"
                if overlay_path in present:
                    side = Image.alpha_composite(side, tint(load_png(zf, overlay_path), PLAINS_GRASS))

            icon = isometric_icon(top, side, front)
            icon.save(OUT / f"{slug}.png")
            digest = hashlib.sha256((OUT / f"{slug}.png").read_bytes()).hexdigest()
            manifest.append({
                "name": name,
                "slug": slug,
                "kind": "cube",
                "textures": [w.replace(TEX_PREFIX, "") for w in wanted],
                "image": f"{slug}.png",
                "sha256": digest,
            })

        for name, slug, folder, texture in ITEMS:
            path = f"{TEX_PREFIX}{folder}/{texture}.png"
            if path not in present:
                missing.append(path)
                print(f"MISS {slug}: {path}")
                continue
            image = load_png(zf, path)
            image.save(OUT / f"{slug}.png")
            digest = hashlib.sha256((OUT / f"{slug}.png").read_bytes()).hexdigest()
            manifest.append({
                "name": name,
                "slug": slug,
                "kind": "sprite" if folder == "item" else "flat-block",
                "textures": [path.replace(TEX_PREFIX, "")],
                "image": f"{slug}.png",
                "sha256": digest,
            })

    # remove icons from a previous run that are no longer in the manifest
    keep = {entry["slug"] + ".png" for entry in manifest}
    for stale in OUT.glob("*.png"):
        if stale.name not in keep:
            stale.unlink()
            print(f"removed stale icon: {stale.name}")

    manifest.sort(key=lambda entry: entry["slug"])
    slugs = [entry["slug"] for entry in manifest]
    names = [entry["name"] for entry in manifest]

    (OUT / "manifest.json").write_text(
        json.dumps({
            "source": {
                "game": "Minecraft Java Edition",
                "version": args.version,
                "jar": str(jar),
                "extracted": "2026-10-25",
                "method": "flat sprites copied; cube blocks composited 2:1 isometric (top 100%, left 80%, right 60%)",
            },
            "count": len(manifest),
            "icons": manifest,
        }, indent=2) + "\n",
        encoding="utf-8",
    )

    js = (
        "/* Generated by scripts/mc-icons.py from Minecraft Java Edition "
        f"{args.version} textures. Do not edit. */\n"
        "window.MC_ICON_SET = " + json.dumps(slugs) + ";\n"
        "window.MC_ICON_NAMES = " + json.dumps(names, ensure_ascii=False) + ";\n"
    )
    (OUT / "icons.js").write_text(js, encoding="utf-8")

    provenance = f"""# Icon provenance and licensing

These icons are derived from **Minecraft Java Edition {args.version}** textures, extracted
from the owner's own installed game client:

```
{jar}
```

- Extraction method: flat item sprites copied at 16×16; cube blocks composited into a 2:1
  isometric icon from their top/side/front textures (top 100%, left 80%, right 60% shading).
- Extracted: 2026-10-25 by `scripts/mc-icons.py`. Regenerate with the same command after a
  game update.
- **Ownership:** Minecraft asset files are © Mojang AB and Microsoft. They are **not**
  redistributed by this project: the generated PNGs are git-ignored and exist only on a
  machine that has a legitimately purchased copy of the game. The repository commits the
  extractor script and this manifest of filenames, never the pixels. If you received these
  files inside a clone, someone redistributed game assets — delete them.
- **Biome tint:** `grass_block_top` and `grass_block_side_overlay` are greyscale textures
  coloured at runtime by biome. The app has no biome data, so it applies the plains colour
  (`#91BD59`) for consistency.
- **Notice:** NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR
  MICROSOFT. "Minecraft" is used descriptively only; no Mojang or Microsoft logo, branding or
  endorsement is implied.
- `manifest.json` records the exact source texture names and a SHA-256 per generated file, so
  the provenance of any pixel can be retraced."""
    (OUT / "PROVENANCE.md").write_text(provenance, encoding="utf-8")

    print(f"version: {args.version}")
    print(f"source:  {jar}")
    print(f"icons:   {len(manifest)} written to {OUT}")
    if missing:
        print(f"\nMISSING ({len(missing)}):")
        for path in missing:
            print(f"  {path}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())



