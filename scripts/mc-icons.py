#!/usr/bin/env python3
"""Build the app's item icons from the *actual* game (EDICT-0007, EDICT-0011).

Preferred source — high resolution: the owner's own inventory icon export.
**IconExporter** (CyclopsMC) renders each item the way the game draws it in an inventory slot
and writes a 256x256 PNG per item to

    %APPDATA%\\.minecraft\\icon-exports-x256\\minecraft__<slug>.png

When that folder exists the PNGs are copied **byte-for-byte** (no resampling): they are the
game's exact inventory appearance at 16x the GUI pixel, and the app displays them smoothly
scaled down. This is the high-resolution mode.

Fallback source — lower resolution: the client jar's 16x16 textures, composited into the
game's 2:1 isometric cube for block items (the original EDICT-0007 method). This keeps the
extractor usable on a machine that has the game but not the export; the manifest records
which mode produced the files.

Outputs (all committed, all regenerable):
    src/assets/icons/<slug>.png     inventory renders (256x256) or fallback textures (16x16)
    src/assets/icons/icons.js       window.MC_ICON_SET / window.MC_ICON_NAMES
    src/assets/icons/manifest.json  provenance + sha256 per icon
    src/assets/icons/PROVENANCE.md  licensing / origin notice

Usage:
    <dsh python> scripts/mc-icons.py                     # auto: export if present, else jar
    <dsh python> scripts/mc-icons.py --exports <dir>     # explicit IconExporter export folder
    <dsh python> scripts/mc-icons.py --jar               # force the 16x16 jar fallback
    <dsh python> scripts/mc-icons.py --version 1.21.5    # game version recorded/inspected
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import io
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "icons"
DEFAULT_VERSION = "1.21.4"
TEX_PREFIX = "assets/minecraft/textures/"
EXPORT_DIRNAME = "icon-exports-x256"
EXPORT_PREFIX = "minecraft__"
MIN_EXPORT_PX = 128          # high-resolution contract: refuse a downscaled export set
EXPECTED_EXPORT_PX = 256     # documented IconExporter export size used by the app

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
    # Block-shaped props: their inventory icon is a 3D model. IconExporter renders that model,
    # which is exactly what the player sees in the inventory; the jar fallback uses the block
    # texture, the recognisable sprite at 16x16.
    ("Torch", "torch", "block", "torch"),
    ("Ladder", "ladder", "block", "ladder"),
    ("Lantern", "lantern", "block", "lantern"),
]


# --------------------------------------------------------------- high-resolution exports
def find_exports(explicit: str | None, install: Path | None) -> Path | None:
    """Return the IconExporter export folder, or None when it is not available."""
    if explicit:
        path = Path(explicit)
        if not path.is_dir():
            raise SystemExit(f"Export folder not found: {path}")
        return path
    if install:
        candidate = install / EXPORT_DIRNAME
        if candidate.is_dir():
            return candidate
    return None


def detect_renderer(install: Path | None, exports: Path, version: str) -> tuple[str, str | None]:
    """Best-effort IconExporter version from the installed mod jars, plus the export date."""
    mod_version = None
    if install:
        patterns = [
            "mods/icon export/iconexporter-*.jar",
            "mods/iconexporter/*/iconexporter-*.jar",
        ]
        found: list[Path] = []
        for pattern in patterns:
            found.extend(sorted(install.glob(pattern)))
        preferred = [p for p in found if version in p.name] or found
        if preferred:
            # Jar names look like iconexporter-1.21.4-neoforge-1.3.1-135.jar or
            # IconExporter-1.16.5-1.2.3.jar: the last three-part number is the mod version.
            tokens = preferred[0].name[:-4].split("-")
            semvers = [t for t in tokens if re.fullmatch(r"\d+\.\d+\.\d+", t)]
            if semvers:
                mod_version = semvers[-1]
    exporter = f"IconExporter {mod_version}" if mod_version else "IconExporter (CyclopsMC)"
    return f"{exporter} for Minecraft {version}", export_date(exports)


def export_date(exports: Path) -> str | None:
    """The day the renders were written, from the export files' timestamps."""
    stamps = [p.stat().st_mtime for p in exports.glob(f"{EXPORT_PREFIX}*.png")]
    if not stamps:
        return None
    return datetime.date.fromtimestamp(min(stamps)).isoformat()


def infer_export_version(exports: Path) -> str | None:
    """Infer the game version from items that only exist from a given release onward."""
    hints = [
        ("1.21.5", "wildflowers"),
        ("1.21.4", "pale_oak_planks"),
        ("1.21", "trial_key"),
    ]
    for version, slug in hints:
        if (exports / f"{EXPORT_PREFIX}{slug}.png").exists():
            return version
    return None


def check_export(path: Path) -> int:
    """Validate one exported render and return its pixel size."""
    with Image.open(path) as image:
        width, height = image.size
    if width != height:
        raise SystemExit(f"Export is not square: {path} ({width}x{height})")
    if width < MIN_EXPORT_PX:
        raise SystemExit(
            f"Export is too small: {path} ({width}x{width}); expected at least {MIN_EXPORT_PX}px. "
            "Re-export the icons at 256x256 with IconExporter."
        )
    return width


def build_high_res(exports: Path) -> tuple[list[dict], list[str], int]:
    manifest: list[dict] = []
    missing: list[str] = []
    pixels: int | None = None
    entries = [(name, slug, "block") for name, slug, _t, _s, _f in BLOCKS]
    entries += [(name, slug, "item") for name, slug, _folder, _texture in ITEMS]
    for name, slug, kind in entries:
        source = exports / f"{EXPORT_PREFIX}{slug}.png"
        if not source.is_file():
            missing.append(f"{EXPORT_DIRNAME}/{EXPORT_PREFIX}{slug}.png")
            print(f"MISS {slug}: {source}")
            continue
        size = check_export(source)
        if pixels is None:
            pixels = size
        elif size != pixels:
            raise SystemExit(
                f"Export set mixes sizes: {source} is {size}px but earlier renders were {pixels}px. "
                "Re-export the whole set at one resolution."
            )
        target = OUT / f"{slug}.png"
        shutil.copyfile(source, target)
        manifest.append({
            "name": name,
            "slug": slug,
            "kind": kind,
            "image": f"{slug}.png",
            "pixels": size,
            "source": f"{EXPORT_DIRNAME}/{EXPORT_PREFIX}{slug}.png",
            "sha256": sha256(target),
        })
    return manifest, missing, pixels or EXPECTED_EXPORT_PX


# ------------------------------------------------------------------- jar fallback (16x16)
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


def build_fallback(jar: Path) -> tuple[list[dict], list[str]]:
    manifest: list[dict] = []
    missing: list[str] = []
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
            manifest.append({
                "name": name,
                "slug": slug,
                "kind": "cube",
                "image": f"{slug}.png",
                "pixels": 16,
                "textures": [w.replace(TEX_PREFIX, "") for w in wanted],
                "sha256": sha256(OUT / f"{slug}.png"),
            })

        for name, slug, folder, texture in ITEMS:
            path = f"{TEX_PREFIX}{folder}/{texture}.png"
            if path not in present:
                missing.append(path)
                print(f"MISS {slug}: {path}")
                continue
            image = load_png(zf, path)
            image.save(OUT / f"{slug}.png")
            manifest.append({
                "name": name,
                "slug": slug,
                "kind": "sprite" if folder == "item" else "flat-block",
                "image": f"{slug}.png",
                "pixels": 16,
                "textures": [path.replace(TEX_PREFIX, "")],
                "sha256": sha256(OUT / f"{slug}.png"),
            })
    return manifest, missing


# ------------------------------------------------------------------------------- shared
def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_install(explicit: str | None) -> Path | None:
    if explicit:
        return Path(explicit)
    appdata = os.environ.get("APPDATA")
    if appdata:
        candidate = Path(appdata) / ".minecraft"
        if candidate.is_dir():
            return candidate
    return None


def write_manifest(manifest: list[dict], source: dict, pixels: int) -> None:
    manifest.sort(key=lambda entry: entry["slug"])
    (OUT / "manifest.json").write_text(
        json.dumps({"source": source, "count": len(manifest), "pixels": pixels, "icons": manifest},
                   indent=2) + "\n",
        encoding="utf-8",
    )


def write_icons_js(manifest: list[dict], version: str, mode: str) -> None:
    slugs = [entry["slug"] for entry in manifest]
    names = [entry["name"] for entry in manifest]
    detail = "256x256 inventory renders" if mode == "hires-exports" else "16x16 jar textures"
    js = (
        "/* Generated by scripts/mc-icons.py from Minecraft Java Edition "
        f"{version} {detail}. Do not edit. */\n"
        "window.MC_ICON_SET = " + json.dumps(slugs) + ";\n"
        "window.MC_ICON_NAMES = " + json.dumps(names, ensure_ascii=False) + ";\n"
    )
    (OUT / "icons.js").write_text(js, encoding="utf-8")


def write_provenance(manifest: list[dict], source: dict, jar: Path | None, exports: Path | None) -> None:
    mode = source["mode"]
    if mode == "hires-exports":
        source_lines = f"""- Game client: `{jar}`.
- Inventory render export: `{exports}` (`{EXPORT_DIRNAME}/` from IconExporter).
- Rendering: {source["renderer"]} rendered each item exactly as the game draws it in an
  inventory slot, at **256×256** (16x the GUI pixel). The renders were exported
  {source["exported"] or "from the owner's installation"} and are copied **byte-for-byte** —
  no scaling, tinting or re-encoding by this project."""
        method_line = (
            "256×256 inventory item renders exported by IconExporter from the owner's own game; "
            "copied unchanged. The app displays them smoothly downscaled (image-rendering: auto)."
        )
        resolution_line = (
            "The app shows them at 22 px in material slots (including icon-picker tiles) and inside "
            "24/28/36/44 px avatar images in 28/32/40/48 px boxes; the 256 px source keeps every "
            "size sharp, including high-DPI screens."
        )
    else:
        source_lines = f"""- Game client: `{jar}`.
- Rendering: the client jar's own 16×16 textures. Flat item sprites are copied; cube blocks
  are composited into a 2:1 isometric icon from their top/side/front textures (top 100 %,
  left 80 %, right 60 %). Animated textures use frame 1; grass uses the plains tint because
  the app has no biome data.
- **This is the low-resolution fallback**: IconExporter's high-resolution export folder was
  not found, so `manifest.json` records `mode: jar-fallback`."""
        method_line = (
            "flat item sprites copied at 16×16; cube blocks composited 2:1 isometric "
            "(top 100 %, left 80 %, right 60 %); animated textures use frame 1"
        )
        resolution_line = "Icons are 16×16 sources; the app scales them up in integer-friendly steps."

    provenance = f"""# Icon provenance and licensing

These icons are derived from **Minecraft Java Edition {source["version"]}** on the owner's own
installation:

{source_lines}

- {resolution_line}
- Extracted: {source["extracted"]} by `scripts/mc-icons.py`. Regenerate with the same command
  after a game update (re-export the IconExporter set for high resolution).
- **Ownership:** Minecraft asset files are © Mojang AB and Microsoft. They are **not**
  redistributed by this project: the generated PNGs are git-ignored and exist only on a
  machine that has a legitimately purchased copy of the game. The repository commits the
  extractor script and this manifest of filenames, never the pixels. If you received these
  files inside a clone, someone redistributed game assets — delete them.
- **Fallback:** without the high-resolution export the extractor falls back to the 16×16
  client-jar textures (the EDICT-0007 method); `manifest.json` then records
  `mode: jar-fallback` and `pixels: 16` instead of the 256 px renders.
- **Notice:** NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR
  MICROSOFT. "Minecraft" is used descriptively only; no Mojang or Microsoft logo, branding or
  endorsement is implied.
- `manifest.json` records the source render name and a SHA-256 per generated file, so the
  provenance of any pixel can be retraced."""
    (OUT / "PROVENANCE.md").write_text(provenance, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default=DEFAULT_VERSION)
    parser.add_argument("--install", default=None)
    parser.add_argument("--exports", default=None)
    parser.add_argument("--jar", action="store_true", help="force the 16x16 jar fallback")
    args = parser.parse_args()

    install = find_install(args.install)
    if install is not None and not install.is_dir():
        raise SystemExit(f"Minecraft installation not found: {install}")

    jar: Path | None = None
    if install:
        jar = install / "versions" / args.version / f"{args.version}.jar"
        if not jar.is_file():
            jar = None

    exports = None if args.jar else find_exports(args.exports, install)
    if args.jar and args.exports:
        raise SystemExit("Choose one source: --jar or --exports, not both.")
    if args.exports and exports is None:
        raise SystemExit(f"Export folder not found: {args.exports}")

    OUT.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today().isoformat()

    if exports is not None:
        version = infer_export_version(exports) or args.version
        renderer, exported = detect_renderer(install, exports, version)
        print(f"mode:   hires-exports ({exports})")
        print(f"source: {renderer}")
        if version != args.version:
            print(f"note:   exports look like {version} (inferred from the item set), recording that")
        manifest, missing, pixels = build_high_res(exports)
        source = {
            "game": "Minecraft Java Edition",
            "version": version,
            "mode": "hires-exports",
            "renderer": renderer,
            "exports": str(exports),
            "jar": str(jar) if jar else "not resolved (export mode does not need the jar)",
            "exported": exported,
            "extracted": today,
            "method": "owner's own 256x256 inventory item renders exported by IconExporter; "
                      "copied unchanged; app displays them smoothly downscaled (image-rendering: auto)",
        }
    else:
        if jar is None:
            raise SystemExit(
                "Could not find a Minecraft installation or an IconExporter export. "
                "Pass --install <path to .minecraft> and/or --exports <path to icon-exports-x256>."
            )
        version = args.version
        print(f"mode:   jar-fallback ({jar}) - lower resolution; run IconExporter for 256px renders")
        manifest, missing = build_fallback(jar)
        pixels = 16
        source = {
            "game": "Minecraft Java Edition",
            "version": version,
            "mode": "jar-fallback",
            "jar": str(jar),
            "extracted": today,
            "method": "flat sprites copied; cube blocks composited 2:1 isometric "
                      "(top 100%, left 80%, right 60%)",
        }

    # remove icons from a previous run that are no longer in the manifest
    keep = {entry["slug"] + ".png" for entry in manifest}
    for stale in OUT.glob("*.png"):
        if stale.name not in keep:
            stale.unlink()
            print(f"removed stale icon: {stale.name}")

    write_manifest(manifest, source, pixels)
    write_icons_js(manifest, version, source["mode"])
    write_provenance(manifest, source, jar, exports)

    print(f"version: {version}")
    print(f"icons:   {len(manifest)} written to {OUT} ({pixels}x{pixels})")
    if missing:
        print(f"\nMISSING ({len(missing)}):")
        for path in missing:
            print(f"  {path}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
