#!/usr/bin/env python3
"""Build the menu-style backdrop from the owner's own Minecraft installation (EDICT-0010).

Minecraft's title-screen panorama is six 1024x1024 faces. Important detail discovered
during planning: the **version jar ships 1x1 placeholders**; the real faces live in the
content-addressed asset store, located through `assets/indexes/<assetIndexId>.json`.
So the skill here is: resolve the index, read the objects, and refuse placeholders.

Two lawful sources, both from the owner's machine:
  * `panorama`    - the game's own title-screen faces (default, closest to the menu)
  * `screenshots` - the player's own in-game screenshots (fallback, their own world)

The output is git-ignored: Minecraft assets are not redistributed by this project.
Committed: this script, `manifest.json` (hashes/provenance) and `PROVENANCE.md`.

Usage:
    <dsh python> scripts/mc-backdrop.py                       # auto: panorama, else screenshots
    <dsh python> scripts/mc-backdrop.py --source panorama --version 1.21.4
    <dsh python> scripts/mc-backdrop.py --source screenshots --count 4
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "panorama"
TEX_GUI = "minecraft/textures/gui/title/background/"
FACES = [f"panorama_{i}.png" for i in range(4)]          # the four horizontal faces
MIN_FACE_PX = 512                                        # anything smaller is a decoy
WIDTH = 2560
BLUR_RATIO = 1 / 320                                     # radius = WIDTH / 220
CROSSFADE = 64


def find_install(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit)
    appdata = os.environ.get("APPDATA")
    if appdata:
        candidate = Path(appdata) / ".minecraft"
        if candidate.is_dir():
            return candidate
    raise SystemExit("Could not find a Minecraft installation. Pass --install <path to .minecraft>.")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


# ------------------------------------------------------------------ panorama
def resolve_faces(install: Path, version: str) -> tuple[list[Path], dict]:
    version_json = install / "versions" / version / f"{version}.json"
    if not version_json.is_file():
        raise SystemExit(f"Version not installed: {version_json}")
    meta = json.loads(version_json.read_text(encoding="utf-8"))
    index_id = (meta.get("assetIndex") or {}).get("id")
    if not index_id:
        raise SystemExit("That version has no assetIndex entry; try another version.")
    index_path = install / "assets" / "indexes" / f"{index_id}.json"
    if not index_path.is_file():
        raise SystemExit(f"Asset index missing: {index_path}")
    objects = json.loads(index_path.read_text(encoding="utf-8")).get("objects", {})

    paths: list[Path] = []
    for face in FACES:
        key = TEX_GUI + face
        entry = objects.get(key)
        if not entry:
            raise SystemExit(f"Asset index has no entry for {key}")
        obj = install / "assets" / "objects" / entry["hash"][:2] / entry["hash"]
        if not obj.is_file():
            raise SystemExit(f"Asset object missing (run the game once with this version): {obj}")
        with Image.open(obj) as image:
            if min(image.size) < MIN_FACE_PX:
                raise SystemExit(
                    f"{key} is {image.size} - that is a placeholder, not a real panorama face. "
                    "Try --source screenshots."
                )
        paths.append(obj)
    return paths, {"kind": "panorama", "version": version, "assetIndex": index_id}


def screenshots(install: Path, count: int) -> tuple[list[Path], dict]:
    folder = install / "screenshots"
    images = sorted(
        (p for p in folder.glob("*.png") if p.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )[:count]
    if not images:
        raise SystemExit(f"No screenshots found in {folder}; take a few in game or use --source panorama.")
    return images, {"kind": "screenshots", "count": len(images)}


def square_face(path: Path, size: int) -> Image.Image:
    with Image.open(path) as image:
        image = image.convert("RGB")
        side = min(image.size)
        left = (image.width - side) // 2
        top = (image.height - side) // 2
        return image.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def compose(paths: list[Path], width: int) -> Image.Image:
    height = width // len(paths)
    faces = [square_face(path, height) for path in paths]
    strip = Image.new("RGB", (width, height))
    step = width // len(paths)
    for index, face in enumerate(faces):
        x = index * step
        if index == 0:
            strip.paste(face, (x, 0))
            continue
        # crossfade the overlap so adjacent faces do not show a hard seam
        start = max(0, x - CROSSFADE // 2)
        strip.paste(face, (x, 0))
        for offset in range(CROSSFADE):
            blend_x = x + offset
            if blend_x >= width:
                break
            alpha = (offset + 1) / (CROSSFADE + 1)
            for y in range(height):
                left_px = strip.getpixel((blend_x, y))
                right_px = faces[index].getpixel((offset, y))
                strip.putpixel(
                    (blend_x, y),
                    (
                        int(left_px[0] * (1 - alpha) + right_px[0] * alpha),
                        int(left_px[1] * (1 - alpha) + right_px[1] * alpha),
                        int(left_px[2] * (1 - alpha) + right_px[2] * alpha),
                    ),
                )
    return strip


# --------------------------------------------------------------------- output
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install", default=None)
    parser.add_argument("--version", default="1.21.4")
    parser.add_argument("--source", default="auto", choices=["auto", "panorama", "screenshots"])
    parser.add_argument("--count", type=int, default=4, help="screenshots to stitch")
    parser.add_argument("--width", type=int, default=WIDTH)
    args = parser.parse_args()

    install = find_install(args.install)
    sources: list[Path] = []
    provenance_meta: dict = {}
    errors: list[str] = []

    if args.source in ("auto", "panorama"):
        try:
            sources, provenance_meta = resolve_faces(install, args.version)
        except SystemExit as error:
            errors.append(str(error))
            if args.source == "panorama":
                raise
    if not sources and args.source in ("auto", "screenshots"):
        sources, provenance_meta = screenshots(install, args.count)
    if not sources:
        print("No usable backdrop source found:", file=sys.stderr)
        for message in errors:
            print("  -", message, file=sys.stderr)
        return 1

    width = max(1280, min(args.width, 4096))
    strip = compose(sources, width)
    blurred = strip.filter(ImageFilter.GaussianBlur(radius=max(4, round(width * BLUR_RATIO))))
    blurred = ImageEnhance.Brightness(blurred).enhance(0.95)
    blurred = ImageEnhance.Color(blurred).enhance(0.92)

    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / "backdrop.webp"
    blurred.save(output, format="WEBP", quality=80, method=6)

    faces = [
        {
            "source": str(path),
            "sha256": sha256_file(path),
            "size": list(Image.open(path).size),
        }
        for path in sources
    ]
    manifest = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": provenance_meta,
        "install": str(install),
        "compose": {
            "faces": len(sources),
            "crossfade_px": CROSSFADE,
            "width": width,
            "height": blurred.height,
            "blur_radius": round(width * BLUR_RATIO),
            "pan_seconds": 120,
            "brightness": 0.95,
            "saturation": 0.92,
        },
        "inputs": faces,
        "output": {
            "file": output.name,
            "sha256": sha256_file(output),
            "size": list(blurred.size),
            "bytes": output.stat().st_size,
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    provenance = f"""# Backdrop provenance and licensing

The menu backdrop is derived from **Minecraft Java Edition {args.version}** using the
owner's own installation:

```
{install}
```

- Source: {provenance_meta.get('kind')} — {len(sources)} images
- Method: faces centre-cropped to squares, composited into a {manifest['compose']['width']}x{blurred.height}
  strip with {CROSSFADE}px crossfades, Gaussian blur radius {manifest['compose']['blur_radius']},
  brightness 0.95, saturation 0.92, encoded WebP quality 80.
- **Discovery note:** the version jar's `panorama_*.png` files are 1x1 placeholders in modern
  versions. The real 1024x1024 faces are located through `assets/indexes/<id>.json` and read
  from `assets/objects/<sha>`. This script refuses anything smaller than 512px.
- The generated `backdrop.webp` is **git-ignored** and exists only on a machine with a
  legitimately purchased copy of the game. Only this script, the manifest and this notice are
  committed; no Mojang pixels are redistributed.
- Regenerate after a game update: `python scripts/mc-backdrop.py`.
- **Notice:** NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR
  MICROSOFT. "Minecraft" is used descriptively only; no logo, branding or endorsement implied.
"""
    (OUT / "PROVENANCE.md").write_text(provenance, encoding="utf-8")

    print(f"source:  {provenance_meta.get('kind')} ({len(sources)} faces)")
    print(f"output:  {output}  {blurred.width}x{blurred.height}  {output.stat().st_size // 1024} KB")
    print(f"manifest: {OUT / 'manifest.json'}")
    print("The app picks it up automatically on reload; dirt stays as the fallback.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
