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
    src/assets/icons/<slug>.png     inventory renders (256x256, one per item type) or fallback
                                    textures (16x16)
    src/assets/icons/icons.js       window.MC_ICON_SET / window.MC_ICON_NAMES /
                                    window.MC_ICON_STACKS
    src/assets/icons/manifest.json  provenance + name/stack/sha256/bytes per icon
    src/assets/icons/PROVENANCE.md  licensing / origin notice

The catalog is the whole item list, not a hand-picked subset: every `minecraft__<slug>.png` in
the export becomes an icon, with component variants (potions, tipped arrows, paintings, ...)
collapsed onto their base item so the picker offers one entry per item type. The 53 curated
building materials are emitted first so the common blocks stay at the top of the picker.

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
import time
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "icons"
DEFAULT_VERSION = "1.21.4"
TEX_PREFIX = "assets/minecraft/textures/"
EXPORT_DIRNAME = "icon-exports-x256"
EXPORT_PREFIX = "minecraft__"
MIN_EXPORT_PX = 128          # high-resolution contract: refuse a downscaled export set
EXPECTED_EXPORT_PX = 256     # documented IconExporter export size used by the app

# IconExporter 1.3.1 renders 3D (block-model) icons too dark: it scales the pose by
# (f, f, 1), and PoseStack turns a non-uniform scale into a squashed normal matrix, which
# flattens Minecraft's GUI diffuse lighting (the 0.4 ambient part survives; the directional
# part mostly does not). Flat 2D sprites face the camera and are unaffected. The bug is fixed
# upstream in CyclopsMC/IconExporter PR #41 ("Scale the icon pose uniformly so block icons
# keep their shading"), but that fix is unreleased for 1.21.4, so the extractor restores the
# vanilla inventory brightness on the exported render itself. Upstream measurements put a
# vanilla inventory render at these fractions of the block texture's brightness:
VANILLA_FACE_FACTORS = {"top": 0.99, "left": 0.65, "right": 0.40}
# Used only when the client jar is unavailable for calibration (measured on 1.21.4's export).
FALLBACK_GAINS = {"top": 1.590, "left": 1.372, "right": 0.875}
LIGHTING_BUG = (
    "IconExporter 1.3.1 scales the icon pose non-uniformly, squashing vertex normals and "
    "flattening GUI diffuse lighting, so 3D icons export too dark; flat 2D sprites are "
    "unaffected. Fixed upstream in CyclopsMC/IconExporter PR #41 (unreleased at export time)."
)

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


# ------------------------------------------------------------------ catalog metadata
# The app reads `window.MC_ICON_SET` (slugs), `window.MC_ICON_NAMES` (parallel display names)
# and `window.MC_ICON_STACKS` (slug -> max stack size). Names must slugify back to their slug
# with the app's own algorithm, otherwise src/app.js drops the entry from the picker.
ACRONYMS = {"tnt": "TNT", "xp": "XP"}

# Max stack sizes of the vanilla Java 1.21.4 item registry: the numbers the in-game inventory
# enforces. Anything not matched below stacks to 64.
#   16 - eggs, snowballs, ender pearls, honey bottles, armor stands, the empty bucket, every
#        sign and hanging sign, every banner.
#   1  - tools and weapons, armour, shields, potions, filled buckets (water, lava, milk, fish,
#        powder snow, ...), boats and rafts, minecarts, shulker boxes, beds, cakes, stews and
#        soups, books that hold content, maps, bundles, saddles, elytra, totems, banner patterns,
#        goat horns and music discs.
STACK_DEFAULT = 64
STACK_16_EXACT = {"bucket", "egg", "blue_egg", "brown_egg", "snowball", "ender_pearl",
                  "honey_bottle", "armor_stand"}
STACK_16_SUFFIX = ("_sign", "_banner")
STACK_1_EXACT = {
    # tools, weapons, utility
    "shears", "flint_and_steel", "fishing_rod", "carrot_on_a_stick",
    "warped_fungus_on_a_stick", "bow", "crossbow", "trident", "mace", "brush",
    "spyglass", "shield", "elytra", "saddle", "wolf_armor", "bundle",
    # books, maps and patterns that carry their own content
    "knowledge_book", "enchanted_book", "written_book", "writable_book", "filled_map",
    "banner_pattern",
    # bottle-style consumables and bowl foods
    "potion", "splash_potion", "lingering_potion", "ominous_bottle", "dragon_breath",
    "mushroom_stew", "rabbit_stew", "beetroot_soup", "suspicious_stew",
    # single-use / placed-entity items
    "minecart", "shulker_box", "cake", "totem_of_undying", "goat_horn",
}
STACK_1_SUFFIX = ("_bucket", "_shulker_box", "_banner_pattern", "_sword", "_pickaxe", "_axe",
                  "_shovel", "_hoe", "_helmet", "_chestplate", "_leggings", "_boots",
                  "_horse_armor", "_boat", "_raft", "_minecart", "_bed")
STACK_1_PREFIX = ("music_disc",)

# Categories are emitted only where the slug family is unambiguous; the picker may ignore them.
CATEGORY_EXACT = {
    "shears": "tool", "flint_and_steel": "tool", "fishing_rod": "tool",
    "carrot_on_a_stick": "tool", "warped_fungus_on_a_stick": "tool",
    "bow": "tool", "crossbow": "tool", "trident": "tool", "mace": "tool",
    "brush": "tool", "spyglass": "tool",
    "shield": "armor", "elytra": "armor", "wolf_armor": "armor",
    "potion": "potion", "splash_potion": "potion", "lingering_potion": "potion",
}
CATEGORY_SUFFIX = (
    ("_spawn_egg", "spawn egg"),
    ("_helmet", "armor"), ("_chestplate", "armor"), ("_leggings", "armor"),
    ("_boots", "armor"), ("_horse_armor", "armor"),
    ("_sword", "tool"), ("_pickaxe", "tool"), ("_axe", "tool"), ("_shovel", "tool"),
    ("_hoe", "tool"),
    ("_boat", "vehicle"), ("_raft", "vehicle"), ("_minecart", "vehicle"),
)

VARIANT_RE = re.compile(r"^([a-z0-9_]+?)__\{")


def stack_size(slug: str) -> int:
    """Max stack size the vanilla inventory enforces for this item slug."""
    if slug in STACK_16_EXACT or slug.endswith(STACK_16_SUFFIX):
        return 16
    if slug in STACK_1_EXACT or slug.startswith(STACK_1_PREFIX) or slug.endswith(STACK_1_SUFFIX):
        return 1
    return STACK_DEFAULT


def category_for(slug: str) -> str | None:
    """Coarse picker category when the slug makes it unambiguous, else None."""
    if slug in CATEGORY_EXACT:
        return CATEGORY_EXACT[slug]
    if slug.startswith(STACK_1_PREFIX):
        return "music disc"
    for suffix, category in CATEGORY_SUFFIX:
        if slug.endswith(suffix):
            return category
    return None


def labelize(slug: str) -> str:
    """Display name for an item slug: `oak_log` -> `Oak Log`, `tnt_minecart` -> `TNT Minecart`."""
    return " ".join(ACRONYMS.get(word, word.capitalize()) for word in slug.split("_") if word)


def app_slugify(name: str) -> str:
    """The app's own slug algorithm (src/app.js slugifyItem), used to prove the round trip."""
    return re.sub(r"^_+|_+$", "", re.sub(r"[^a-z0-9]+", "_", name.strip().lower()))


def curated_entries() -> list[tuple[str, str, str]]:
    """(slug, display name, kind) of the hand-picked building materials, in curated order."""
    entries = [(slug, name, "block") for name, slug, _top, _side, _front in BLOCKS]
    entries += [(slug, name, "prop" if folder == "block" else "item")
                for name, slug, folder, _texture in ITEMS]
    return entries


def collapse_exports(exports: Path) -> tuple[dict[str, str], int, int]:
    """One icon per item type: ({slug: export filename}, collapsed variant count, render count).

    IconExporter writes a component-variant render per item *state*, for example
    `minecraft__potion__{'minecraft__potion_contents'__{potion__'minecraft__water'}}.png`.
    Those are the same item, so they collapse onto the base slug; the water variant is used as
    the representative when the family has one (a plain potion bottle), otherwise the first.
    """
    plain: dict[str, str] = {}
    variants: dict[str, list[str]] = {}
    total = 0
    for path in sorted(exports.glob(f"{EXPORT_PREFIX}*.png")):
        total += 1
        stem = path.name[len(EXPORT_PREFIX):-len(".png")]
        match = VARIANT_RE.match(stem)
        if match:
            variants.setdefault(match.group(1), []).append(path.name)
        else:
            plain[stem] = path.name
    collapsed = 0
    for slug, names in sorted(variants.items()):
        if slug in plain:
            collapsed += len(names)      # cosmetic variants of an item that has a base render
            continue
        preferred = next((name for name in names if "'minecraft__water'" in name), sorted(names)[0])
        plain[slug] = preferred
        collapsed += len(names) - 1
    return plain, collapsed, total


def catalog_order(available: dict[str, str]) -> list[tuple[str, str, str]]:
    """Every available item, curated first then alphabetical: (slug, display name, kind)."""
    curated = curated_entries()
    seen = {slug for slug, _name, _kind in curated}
    ordered = [(slug, name, kind) for slug, name, kind in curated if slug in available]
    ordered += [(slug, labelize(slug), "auto") for slug in sorted(available) if slug not in seen]
    return ordered


def verify_contract(manifest: list[dict]) -> None:
    """Abort if the catalog breaks the frozen data contract (.tmp/plan/contract.md §8)."""
    for entry in manifest:
        slug = app_slugify(entry["name"])
        if slug != entry["slug"]:
            raise SystemExit(
                f"Display name {entry['name']!r} slugifies to {slug!r}, not {entry['slug']!r}; "
                "the app would drop this icon from the picker."
            )
        for field in ("slug", "name", "stack", "sha256", "bytes", "source", "lighting"):
            if not entry.get(field):
                raise SystemExit(
                    f"{entry.get('slug')!r}: manifest entry is missing {field!r}; the catalog "
                    "data contract requires slug, name, stack, sha256, bytes, source and lighting."
                )
        if entry["lighting"] not in ("block", "flat", "3d-other"):
            raise SystemExit(
                f"{entry['slug']}: lighting {entry['lighting']!r} is not one of "
                "block/flat/3d-other."
            )
        if entry["stack"] not in (1, 16, 64):
            raise SystemExit(f"{entry['slug']}: stack {entry['stack']!r} is not 1, 16 or 64.")


# ------------------------------------------------- jar model classification (3D vs flat)
ITEM_DEFS = "assets/minecraft/items/"
ITEM_MODELS = "assets/minecraft/models/item/"


def _walk_definition(node, found: list[tuple[str | None, str]], special: list[bool]) -> None:
    """Collect the model references and flag special renderers in a client item definition."""
    if isinstance(node, dict):
        kind = node.get("type")
        if kind == "minecraft:special":
            special[0] = True
        for key in ("model", "base"):
            value = node.get(key)
            if isinstance(value, str) and value not in [model for _kind, model in found]:
                found.append((kind, value))
        for value in node.values():
            if isinstance(value, (dict, list)):
                _walk_definition(value, found, special)
    elif isinstance(node, list):
        for value in node:
            _walk_definition(value, found, special)


def _model_json(zf: zipfile.ZipFile, names: set[str], cache: dict[str, dict | None],
                path: str) -> dict | None:
    name = path.split(":", 1)[1] if ":" in path else path
    entry = f"assets/minecraft/models/{name}.json"
    if entry not in names:
        return None
    if entry not in cache:
        cache[entry] = json.loads(zf.read(entry))
    return cache[entry]


def _model_is_flat(zf: zipfile.ZipFile, names: set[str], cache: dict[str, dict | None],
                   path: str) -> bool | None:
    """True for an item/generated sprite, False for a block model or any model with geometry."""
    current = path.split(":", 1)[1] if ":" in path else path
    for _step in range(24):
        if current in ("item/generated", "item/handheld", "builtin/generated"):
            return True
        if current.startswith("block/"):
            return False
        data = _model_json(zf, names, cache, current)
        if data is None:
            return None
        if "elements" in data:
            return False
        parent = data.get("parent")
        if not parent:
            return "textures" in data
        current = parent.split(":", 1)[1] if ":" in parent else parent
    return None


def classify_models(zf: zipfile.ZipFile, slugs: list[str]) -> dict[str, str]:
    """Classify every item from the client jar's item definition and model parent chain.

    "block" is a block model (inventory cube), "flat" an item/generated sprite, "special" a
    special renderer (chest, bed, banner, shield, ...) and "unknown" when no usable chain exists.
    """
    names = set(zf.namelist())
    cache: dict[str, dict | None] = {}
    classes: dict[str, str] = {}
    for slug in slugs:
        found: list[tuple[str | None, str]] = []
        special = [False]
        definition = f"{ITEM_DEFS}{slug}.json"
        if definition in names:
            _walk_definition(json.loads(zf.read(definition)), found, special)
        elif f"{ITEM_MODELS}{slug}.json" in names:
            found.append((None, f"item/{slug}"))
        if special[0]:
            classes[slug] = "special"
            continue
        verdicts: set[str] = set()
        for _kind, model in found:
            if model.startswith(("minecraft:block/", "block/")):
                verdicts.add("block")
                continue
            flat = _model_is_flat(zf, names, cache, model)
            verdicts.add({True: "flat", False: "block", None: "unknown"}[flat])
        if "block" in verdicts:
            classes[slug] = "block"
        elif verdicts == {"flat"}:
            classes[slug] = "flat"
        else:
            classes[slug] = "unknown"
    return classes


def nearest_uniform(image: Image.Image, factors: tuple[int, ...] = (16, 32, 64, 128)) -> int | None:
    """Return f when the image is an exact NEAREST upscale by f (a flat 16px sprite), else None."""
    for factor in factors:
        if image.width % factor or image.height % factor:
            continue
        small = image.resize((image.width // factor, image.height // factor), Image.NEAREST)
        if small.resize(image.size, Image.NEAREST) == image:
            return factor
    return None


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


def load_block_texture(zf: zipfile.ZipFile, name: str) -> Image.Image:
    with zf.open(f"{TEX_PREFIX}block/{name}.png") as handle:
        image = Image.open(io.BytesIO(handle.read())).convert("RGBA")
    # animated textures are vertical strips: use the first frame
    if image.height > image.width and image.height % image.width == 0:
        image = image.crop((0, 0, image.width, image.width))
    return image


def mean_brightness(image: Image.Image, mask: Image.Image | None = None) -> float:
    src = image.load()
    msk = mask.load() if mask is not None else None
    total = count = 0
    for y in range(image.height):
        for x in range(image.width):
            if msk is not None and not msk[x, y]:
                continue
            r, g, b, a = src[x, y]
            if a > 200:
                total += (r + g + b) / 3
                count += 1
    return total / count if count else 0.0


def scale_brightness(image: Image.Image, factor: float) -> Image.Image:
    """Multiply RGB by factor (clamped) and keep the alpha channel untouched."""
    red, green, blue, alpha = image.split()
    transform = lambda channel: channel.point(
        lambda value: max(0, min(255, int(value * factor + 0.5)))
    )
    return Image.merge("RGBA", (transform(red), transform(green), transform(blue), alpha))


def cube_face_masks(reference: Image.Image) -> tuple[dict[str, Image.Image], dict[str, float]]:
    """Split an isometric cube render into its three visible faces.

    IconExporter draws the GUI block model with one fixed projection, so the silhouette is a
    hexagon: top vertex, the two upper side corners, the two lower side corners, bottom vertex.
    The three faces meet at the diamond's lower vertex (centre). Returns one alpha mask per
    face plus the face areas (opaque pixel counts) for weighting.
    """
    alpha = reference.getchannel("A")
    rows = []
    for y in range(reference.height):
        xs = [x for x in range(reference.width) if alpha.getpixel((x, y)) > 200]
        if xs:
            rows.append((y, min(xs), max(xs)))
    if len(rows) < 8:
        raise ValueError("no isometric cube silhouette found")
    y_top, y_bottom = rows[0][0], rows[-1][0]
    widest = max(right - left for _y, left, right in rows)
    band = [(y, left, right) for y, left, right in rows if right - left == widest]
    y_side_top, y_side_bottom = band[0][0], band[-1][0]
    x_min = min(left for _y, left, _right in rows)
    x_max = max(right for _y, _left, right in rows)
    centre_x = (x_min + x_max) / 2
    top = (centre_x, y_top)
    left = (x_min, y_side_top)
    right = (x_max, y_side_top)
    centre = (centre_x, 2 * y_side_top - y_top)
    left_bottom = (x_min, y_side_bottom)
    right_bottom = (x_max, y_side_bottom)
    bottom = (centre_x, y_bottom)
    polygons = {
        "top": [top, right, centre, left],
        "left": [left, centre, bottom, left_bottom],
        "right": [centre, right, right_bottom, bottom],
    }
    masks: dict[str, Image.Image] = {}
    for face, polygon in polygons.items():
        mask = Image.new("L", reference.size, 0)
        ImageDraw.Draw(mask).polygon(polygon, fill=255)
        masks[face] = mask
    return masks


def face_weights(masks: dict[str, Image.Image]) -> dict[str, int]:
    return {face: mask.histogram()[255] for face, mask in masks.items()}


def calibrate_lighting(zf: zipfile.ZipFile, exports: Path, masks: dict[str, Image.Image]) -> tuple[dict[str, float], dict[str, float]]:
    """Measure how dark the 3D exports are against the source textures, then derive gains.

    For every solid full-cube block the rendered face brightness is compared with the matching
    block texture's brightness; the median ratio is the exporter's current face factor. The
    gain that restores the vanilla inventory factor is target / current.
    """
    excluded = {"glass", "grass_block"}  # transparency and the biome tint muddy the mean
    samples: dict[str, list[float]] = {face: [] for face in VANILLA_FACE_FACTORS}
    for _name, slug, top_tex, side_tex, front_tex in BLOCKS:
        if slug in excluded:
            continue
        export = exports / f"{EXPORT_PREFIX}{slug}.png"
        if not export.is_file():
            continue
        render = Image.open(export).convert("RGBA")
        textures = {
            "top": load_block_texture(zf, top_tex),
            "left": load_block_texture(zf, side_tex),
            "right": load_block_texture(zf, front_tex or side_tex),
        }
        for face in samples:
            source = mean_brightness(textures[face])
            if source > 0:
                samples[face].append(mean_brightness(render, masks[face]) / source)
    if any(len(values) < 5 for values in samples.values()):
        raise ValueError("not enough reference blocks to calibrate the lighting")
    current = {}
    for face, values in samples.items():
        values.sort()
        current[face] = values[len(values) // 2]
    gains = {face: VANILLA_FACE_FACTORS[face] / current[face] for face in current}
    return current, gains


def silhouette_box(image: Image.Image) -> tuple[int, int, int, int]:
    return image.convert("RGBA").getchannel("A").getbbox() or (0, 0, 0, 0)


def build_high_res(exports: Path, jar: Path | None) -> tuple[list[dict], list[str], int, dict | None, dict]:
    """Copy every exported item render into the asset folder; returns the catalog and stats."""
    missing: list[str] = []
    pixels: int | None = None

    # The exporter's projection is identical for every full-cube icon, so the face masks and
    # the lighting calibration are derived once from the set itself.
    masks = None
    correction: dict | None = None
    gains: dict[str, float] = {}
    reference = exports / f"{EXPORT_PREFIX}stone.png"
    if reference.is_file():
        try:
            masks = cube_face_masks(Image.open(reference).convert("RGBA"))
            if jar is not None:
                with zipfile.ZipFile(jar) as zf:
                    measured, gains = calibrate_lighting(zf, exports, masks)
                calibrated_from = "the client jar's block textures"
            else:
                measured = {face: VANILLA_FACE_FACTORS[face] / FALLBACK_GAINS[face] for face in FALLBACK_GAINS}
                gains = dict(FALLBACK_GAINS)
                calibrated_from = "the built-in 1.21.4/IconExporter-1.3.1 measurements (client jar not available)"
            weights = face_weights(masks)
            total = sum(weights.values()) or 1
            gains["props"] = sum(gains[face] * weights[face] for face in masks) / total
            correction = {
                "applied": True,
                "reason": LIGHTING_BUG,
                "method": "per-face brightness gain on the exported render (block models get the "
                          "measured per-face gains, non-cube 3D models and special renderers the "
                          "face-area-weighted gain; flat 2D sprites are copied unchanged)",
                "target_vanilla_face_factors": dict(VANILLA_FACE_FACTORS),
                "measured_export_face_factors": {face: round(value, 4) for face, value in measured.items()},
                "gains": {key: round(value, 4) for key, value in gains.items()},
                "calibrated_from": calibrated_from,
            }
            print(
                "lighting: correcting IconExporter 1.3.1 dark 3D icons "
                f"(top x{gains['top']:.2f}, left x{gains['left']:.2f}, right x{gains['right']:.2f})"
            )
        except (ValueError, OSError, zipfile.BadZipFile) as error:
            print(f"note: lighting correction disabled ({error})")

    reference_box = silhouette_box(Image.open(reference).convert("RGBA")) if reference.is_file() else None
    # A true full-cube render has exactly the reference silhouette (every texel covered the same
    # way), which is far stricter than the bounding box: stairs, slabs, fences and leaves share
    # the box but not the silhouette.
    reference_alpha = (
        Image.open(reference).convert("RGBA").getchannel("A").tobytes() if reference.is_file() else None
    )

    available, collapsed, renders = collapse_exports(exports)
    entries = catalog_order(available)
    if not entries:
        raise SystemExit(f"No {EXPORT_PREFIX}*.png renders found in {exports}")
    for slug, _name, _kind in curated_entries():
        if slug not in available:
            missing.append(f"{EXPORT_DIRNAME}/{EXPORT_PREFIX}{slug}.png")
            print(f"MISS curated icon: {slug}")

    # What each render is: a block model, a flat item sprite or a special-renderer model. Read
    # from the jar's item definition / model parent chain (F3); without the jar the icon's own
    # pixels decide, because an exact 16x NEAREST upscale can only be a flat sprite.
    model_classes: dict[str, str] = {}
    if jar is not None:
        with zipfile.ZipFile(jar) as zf:
            model_classes = classify_models(zf, [slug for slug, _name, _kind in entries])
        summary = " ".join(
            f"{name} {sum(1 for value in model_classes.values() if value == name)}"
            for name in ("block", "flat", "special", "unknown")
        )
        print(f"model chain: {summary}")
    else:
        print("model chain: client jar not available, classifying from the exported pixels")

    manifest: list[dict] = []
    lighting_counts = {"block": 0, "flat": 0, "3d-other": 0}
    non_cube: list[str] = []
    specials: list[str] = []
    unknowns: list[str] = []
    mismatches: list[str] = []
    for slug, name, kind in entries:
        filename = available[slug]
        source = exports / filename
        size = check_export(source)
        if pixels is None:
            pixels = size
        elif size != pixels:
            raise SystemExit(
                f"Export set mixes sizes: {source} is {size}px but earlier renders were {pixels}px. "
                "Re-export the whole set at one resolution."
            )
        target = OUT / f"{slug}.png"
        icon = Image.open(source).convert("RGBA")
        correct = correction is not None and masks is not None
        # Full-cube silhouettes share IconExporter's projection exactly, so their face masks
        # (and the calibrated gains) can be applied safely. Curated entries keep the EDICT-0012
        # bounding-box rule so their pixels stay byte-identical to the previous edition.
        if kind == "auto":
            cube = reference_alpha is not None and icon.getchannel("A").tobytes() == reference_alpha
        else:
            cube = reference_box is not None and silhouette_box(icon) == reference_box
        model = model_classes.get(slug)
        if model is None:
            model = "flat" if nearest_uniform(icon) == 16 else "3d-other"
        elif model == "unknown":
            unknowns.append(slug)
            model = "flat" if nearest_uniform(icon) == 16 else "3d-other"
        elif model == "flat" and nearest_uniform(icon) != 16:
            mismatches.append(slug)
        if kind == "auto":
            kind = "cube" if (model == "block" and cube) else ("item" if model == "flat" else "model")
        if kind == "item":
            # Flat 2D sprites are unaffected by the 3D-transform darkening bug.
            shutil.copyfile(source, target)
            lighting = "flat"
        elif kind == "prop":
            # EDICT-0012 treated these three as 3D props; the treatment is kept for visual
            # continuity (F3's frozen case requires `torch` corrected) and disclosed as legacy.
            if correct:
                scale_brightness(icon, gains["props"]).save(target)
            else:
                shutil.copyfile(source, target)
            lighting = "3d-other"
        elif cube and correct:
            for face, mask in masks.items():
                icon = Image.composite(scale_brightness(icon, gains[face]), icon, mask)
            icon.save(target)
            lighting = "block"
        elif model != "flat" and correct:
            # Non-cube block models (stairs, slabs, fences, anvils, ...) and special renderers
            # (chest, bed, banner, shield, ...) share the flat face-area-weighted gain.
            scale_brightness(icon, gains["props"]).save(target)
            lighting = "3d-other"
            if model == "block":
                non_cube.append(slug)
            elif model == "special":
                specials.append(slug)
        else:
            shutil.copyfile(source, target)
            lighting = "flat" if model == "flat" else "3d-other"
        lighting_counts[lighting] += 1
        entry = {
            "name": name,
            "slug": slug,
            "kind": kind,
            "image": f"{slug}.png",
            "pixels": size,
            "lighting": lighting,
            "source": f"{EXPORT_DIRNAME}/{filename}",
            "sha256": sha256(target),
            "bytes": target.stat().st_size,
            "stack": stack_size(slug),
        }
        category = category_for(slug)
        if category:
            entry["category"] = category
        manifest.append(entry)

    stats = {
        "curated": sum(1 for slug, _name, _kind in curated_entries() if slug in available),
        "collapsed_variants": collapsed,
        "renders": renders,
        "lighting": lighting_counts,
        "models": {
            name: sum(1 for slug, _name, _kind in entries if model_classes.get(slug) == name)
            for name in ("block", "flat", "special", "unknown")
        },
        "non_cube_models": sorted(non_cube),
        "special_models": sorted(specials),
        "unknown_models": sorted(unknowns),
        "flat_pixel_mismatches": sorted(mismatches),
        "total_bytes": sum(entry["bytes"] for entry in manifest),
        "stack_overrides": sum(1 for entry in manifest if entry["stack"] != STACK_DEFAULT),
        "stacks": {size: sum(1 for entry in manifest if entry["stack"] == size) for size in (STACK_DEFAULT, 16, 1)},
    }
    return manifest, missing, pixels or EXPECTED_EXPORT_PX, correction, stats


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
    draw_face(canvas, top, A, U_top, V_top, VANILLA_FACE_FACTORS["top"])
    U_left = (D[0] - A[0], D[1] - A[1])         # (8, 4)
    V_left = (0, 8)
    draw_face(canvas, side, A, U_left, V_left, VANILLA_FACE_FACTORS["left"])
    U_right = (C[0] - D[0], C[1] - D[1])        # (8, -4)
    V_right = (0, 8)
    draw_face(canvas, front or side, D, U_right, V_right, VANILLA_FACE_FACTORS["right"])
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
            target = OUT / f"{slug}.png"
            icon.save(target)
            entry = {
                "name": name,
                "slug": slug,
                "kind": "cube",
                "image": f"{slug}.png",
                "pixels": 16,
                "lighting": "block",
                "textures": [w.replace(TEX_PREFIX, "") for w in wanted],
                "sha256": sha256(target),
                "bytes": target.stat().st_size,
                "stack": stack_size(slug),
            }
            category = category_for(slug)
            if category:
                entry["category"] = category
            manifest.append(entry)

        for name, slug, folder, texture in ITEMS:
            path = f"{TEX_PREFIX}{folder}/{texture}.png"
            if path not in present:
                missing.append(path)
                print(f"MISS {slug}: {path}")
                continue
            image = load_png(zf, path)
            target = OUT / f"{slug}.png"
            image.save(target)
            entry = {
                "name": name,
                "slug": slug,
                "kind": "sprite" if folder == "item" else "flat-block",
                "image": f"{slug}.png",
                "pixels": 16,
                "lighting": "flat",
                "textures": [path.replace(TEX_PREFIX, "")],
                "sha256": sha256(target),
                "bytes": target.stat().st_size,
                "stack": stack_size(slug),
            }
            category = category_for(slug)
            if category:
                entry["category"] = category
            manifest.append(entry)
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


def write_manifest(manifest: list[dict], source: dict, pixels: int, stats: dict) -> None:
    """Write the manifest: source block, catalog totals, then one entry per icon (curated first)."""
    payload = {
        "source": source,
        "count": len(manifest),
        "pixels": pixels,
        "curated": stats["curated"],
        "renders": stats["renders"],
        "collapsed_variants": stats["collapsed_variants"],
        "stack_default": STACK_DEFAULT,
        "stack_overrides": stats["stack_overrides"],
        "stack_groups": {str(size): count for size, count in stats["stacks"].items()},
        "lighting": stats["lighting"],
        "models": stats["models"],
        "total_bytes": stats["total_bytes"],
        "icons": manifest,
    }
    (OUT / "manifest.json").write_text(
        _manifest_text(payload) + "\n", encoding="utf-8")


def _manifest_text(payload: dict) -> str:
    """Pretty top level, one icon per line: readable diffs without the 10-line-per-entry bloat."""
    icons = payload["icons"]
    header = json.dumps({key: value for key, value in payload.items() if key != "icons"}, indent=2)
    header = header[:-1].rstrip()          # drop the closing brace
    lines = ",\n".join(
        "    " + json.dumps(entry, ensure_ascii=False, separators=(", ", ": ")) for entry in icons
    )
    return f'{header},\n  "icons": [\n{lines}\n  ]\n}}'


def write_icons_js(manifest: list[dict], version: str, mode: str) -> None:
    slugs = [entry["slug"] for entry in manifest]
    names = {entry["slug"]: entry["name"] for entry in manifest}
    stacks = {entry["slug"]: entry["stack"] for entry in manifest}
    categories = {entry["slug"]: entry["category"] for entry in manifest if entry.get("category")}
    detail = "256x256 inventory renders" if mode == "hires-exports" else "16x16 jar textures"
    js = (
        "/* Generated by scripts/mc-icons.py from Minecraft Java Edition "
        f"{version} {detail}. Do not edit. */\n"
        "/* MC_ICON_SET is the picker order (curated building materials first, then alphabetical).\n"
        "   MC_ICON_NAMES maps slug -> display name, MC_ICON_STACKS slug -> vanilla max stack size\n"
        "   (1, 16 or 64; absent key = 64), MC_ICON_CATEGORIES slug -> category only where the\n"
        "   slug makes it derivable. See .tmp/plan/contract.md section 8 / the edict. */\n"
        "window.MC_ICON_SET = " + json.dumps(slugs) + ";\n"
        "window.MC_ICON_NAMES = " + json.dumps(names, ensure_ascii=False) + ";\n"
        "window.MC_ICON_STACKS = " + json.dumps(stacks, separators=(",", ":")) + ";\n"
        "window.MC_ICON_CATEGORIES = "
        + json.dumps(categories, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    (OUT / "icons.js").write_text(js, encoding="utf-8")


def write_provenance(manifest: list[dict], source: dict, jar: Path | None, exports: Path | None,
                     stats: dict) -> None:
    mode = source["mode"]
    if mode == "hires-exports":
        correction = source.get("lighting_correction") or {}
        gains = correction.get("gains") or {}
        correction_line = (
            "- **Lighting correction for 3D models.** IconExporter 1.3.1 scales the icon pose "
            "non-uniformly, which squashes the vertex normals and flattens Minecraft's GUI "
            "diffuse lighting; 3D (block-model) icons therefore export roughly a third too dark, "
            "while flat 2D sprites are unaffected. The upstream fix (CyclopsMC/IconExporter "
            "PR #41) was unreleased at export time, so this project restores the vanilla "
            "inventory face brightness on the exported render: top 0.99, left 0.65, right 0.40 "
            "of the block texture"
            + (
                f" (gains top x{gains['top']}, left x{gains['left']}, right x{gains['right']}, "
                f"3D props x{gains['props']})"
                if gains
                else ""
            )
            + ". Flat item sprites are copied unchanged."
        )
        source_lines = f"""- Game client: `{jar}`.
- Inventory render export: `{exports}` (`{EXPORT_DIRNAME}/` from IconExporter).
- Rendering: {source["renderer"]} rendered each item as the game draws it in an inventory
  slot, at **256×256** (16x the GUI pixel). The renders were exported
  {source["exported"] or "from the owner's installation"}; they are copied with no scaling or
  tinting and are not re-encoded for flat 2D sprites.
{correction_line}"""
        resolution_line = (
            "The app shows them at 22 px in material slots (including icon-picker tiles) and inside "
            "24/28/36/44 px avatar images in 28/32/40/48 px boxes; the 256 px source keeps every "
            "size sharp, including high-DPI screens."
        )
    else:
        source_lines = f"""- Game client: `{jar}`.
- Rendering: the client jar's own 16×16 textures. Flat item sprites are copied; cube blocks
  are composited into a 2:1 isometric icon from their top/side/front textures with the vanilla
  inventory face brightness (top 0.99, left 0.65, right 0.40). Animated textures use frame 1;
  grass uses the plains tint because the app has no biome data.
- **This is the low-resolution fallback**: IconExporter's high-resolution export folder was
  not found, so `manifest.json` records `mode: jar-fallback`."""
        resolution_line = "Icons are 16×16 sources; the app scales them up in integer-friendly steps."

    if mode == "hires-exports":
        catalog_line = (
            f"- **Catalog:** {stats['curated']} curated building materials plus every other item in "
            f"the export, **{len(manifest)} icons** in total from {stats['renders']} renders. "
            f"{stats['collapsed_variants']} component-variant renders (potions, tipped arrows, "
            "paintings, fireworks, ...) were collapsed onto their base item, so the picker shows "
            "one icon per item type. Curated items come first, then alphabetical by slug. The "
            "catalog is export-driven: items whose render depends on components that the export "
            "did not cover (written book, filled map, knowledge book) have no icon."
        )
    else:
        catalog_line = (
            f"- **Catalog:** the {len(manifest)} curated building materials. The high-resolution "
            "export adds every other item; the jar fallback stays small on purpose."
        )
    stack_line = (
        f"- **Stack sizes:** every manifest entry records the vanilla max stack size (`stack`, "
        f"default {STACK_DEFAULT}) and `icons.js` exposes `window.MC_ICON_STACKS` for the same "
        f"data; {stats['stack_overrides']} items override the default (16: eggs, snowballs, "
        "ender pearls, honey bottles, armor stands, the empty bucket, signs, hanging signs and "
        "banners; 1: water/lava/milk/fish buckets, tools, armour, shields, potions, boats, "
        "minecarts, shulker boxes, beds, cakes, content-carrying books and maps, banner "
        "patterns, music discs, ...). Values follow the vanilla 1.21.4 item registry."
    )
    lighting_line = (
        "- **Lighting and classification:** each icon's `lighting` records what was done to the "
        "render. `block`: the client jar's item model chain resolves to a block model and the "
        "render is the inventory cube, corrected with the measured per-face gains. `flat`: an "
        "`item/generated` 2D sprite, copied byte-for-byte (the 3D darkening bug does not apply). "
        "`3d-other`: a non-cube block model (stairs, slabs, fences, anvils, ...) or a special "
        "renderer (chest, bed, banner, shield, ...), corrected with the face-area-weighted gain. "
        "The class is read from `assets/minecraft/items/<slug>.json` and its `models/` parent "
        "chain; without the jar an icon counts as `flat` only when its pixels are an exact 16x "
        "NEAREST upscale. The three curated props (torch, ladder, lantern) keep their EDICT-0012 "
        "face-area-weighted gain although the 1.21.4 jar classifies them `item/generated`; that "
        "legacy over-brightening is disclosed here rather than changed silently."
    )

    provenance = f"""# Icon provenance and licensing

These icons are derived from **Minecraft Java Edition {source["version"]}** on the owner's own
installation:

{source_lines}

{catalog_line}
{stack_line}
{lighting_line}

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
    started = time.perf_counter()

    if exports is not None:
        version = infer_export_version(exports) or args.version
        renderer, exported = detect_renderer(install, exports, version)
        print(f"mode:   hires-exports ({exports})")
        print(f"source: {renderer}")
        if version != args.version:
            print(f"note:   exports look like {version} (inferred from the item set), recording that")
        manifest, missing, pixels, correction, stats = build_high_res(exports, jar)
        source = {
            "game": "Minecraft Java Edition",
            "version": version,
            "mode": "hires-exports",
            "renderer": renderer,
            "exports": str(exports),
            "jar": str(jar) if jar else "not resolved (export mode does not need the jar)",
            "exported": exported,
            "extracted": today,
            "method": "owner's own 256x256 inventory item renders exported by IconExporter, one "
                      "icon per item type; the presentation class (block/flat/3d-other) is read "
                      "from the client jar's item model chain; flat 2D sprites are copied "
                      "unchanged, block models and non-cube 3D models are brightness-corrected "
                      "for the IconExporter 1.3.1 dark-lighting bug; the app displays them "
                      "smoothly downscaled (image-rendering: auto)",
        }
        if correction is not None:
            source["lighting_correction"] = correction
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
        stats = {
            "curated": len(manifest),
            "collapsed_variants": 0,
            "renders": 0,
            "lighting": {
                name: sum(1 for entry in manifest if entry["lighting"] == name)
                for name in ("block", "flat", "3d-other")
            },
            "models": {
                "block": sum(1 for entry in manifest if entry["lighting"] == "block"),
                "flat": sum(1 for entry in manifest if entry["lighting"] == "flat"),
                "special": 0,
                "unknown": 0,
            },
            "non_cube_models": [],
            "special_models": [],
            "unknown_models": [],
            "flat_pixel_mismatches": [],
            "total_bytes": sum(entry["bytes"] for entry in manifest),
            "stack_overrides": sum(1 for entry in manifest if entry["stack"] != STACK_DEFAULT),
            "stacks": {size: sum(1 for entry in manifest if entry["stack"] == size) for size in (STACK_DEFAULT, 16, 1)},
        }
        source = {
            "game": "Minecraft Java Edition",
            "version": version,
            "mode": "jar-fallback",
            "jar": str(jar),
            "extracted": today,
            "method": "flat sprites copied; cube blocks composited 2:1 isometric "
                      "(top 100%, left 80%, right 60%)",
        }

    verify_contract(manifest)

    # remove icons from a previous run that are no longer in the manifest
    keep = {entry["slug"] + ".png" for entry in manifest}
    for stale in OUT.glob("*.png"):
        if stale.name not in keep:
            stale.unlink()
            print(f"removed stale icon: {stale.name}")

    write_manifest(manifest, source, pixels, stats)
    write_icons_js(manifest, version, source["mode"])
    write_provenance(manifest, source, jar, exports, stats)

    runtime = time.perf_counter() - started
    lighting = ", ".join(f"{count} {name}" for name, count in stats["lighting"].items())
    models = ", ".join(f"{count} {name}" for name, count in stats["models"].items())
    print(f"version: {version}")
    print(f"icons:   {len(manifest)} written to {OUT} ({pixels}x{pixels})")
    print(f"catalog: {stats['curated']} curated first; {stats['renders']} renders, "
          f"{stats['collapsed_variants']} component variants collapsed to their item")
    print(f"stacks:  {stats['stack_overrides']} overrides of {STACK_DEFAULT} "
          f"({stats['stacks'][16]} x16, {stats['stacks'][1]} x1)")
    print(f"models:  {models}")
    print(f"lighting: {lighting}")
    for label, key in (
        ("non-cube 3D models (uniform gain)", "non_cube_models"),
        ("special renderers (uniform gain)", "special_models"),
        ("classified from pixels (no model chain)", "unknown_models"),
        ("flat renders that are not an exact 16x upscale", "flat_pixel_mismatches"),
    ):
        values = stats.get(key) or []
        if values:
            shown = ", ".join(values[:20])
            if len(values) > 20:
                shown += f", ... (+{len(values) - 20})"
            print(f"{label}: {len(values)}: {shown}")
    print(f"disk:    {stats['total_bytes'] / 1_000_000:.2f} MB of PNGs")
    print(f"runtime: {runtime:.1f} s")
    if missing:
        print(f"\nMISSING ({len(missing)}):")
        for path in missing:
            print(f"  {path}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
