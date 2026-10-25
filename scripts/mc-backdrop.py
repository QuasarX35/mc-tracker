#!/usr/bin/env python3
"""Build the menu-style backdrop from the owner's own Minecraft installation (EDICT-0010).

Minecraft's title-screen panorama is a **cubemap of six 1024x1024 faces**
(`panorama_0` .. `panorama_5`). The four side faces (`panorama_0..3`) stitch into the
horizontal panorama; `panorama_4` and `panorama_5` are the top and bottom caps and are
recorded in the manifest but never stitched into the strip (EDICT-0014 R1).

Important detail discovered during planning: the **version jar ships 1x1 placeholders**;
the real faces live in the content-addressed asset store, located through
`assets/indexes/<assetIndexId>.json`. So the skill here is: resolve the index, read the
objects, and refuse placeholders.

Two lawful sources, both from the owner's machine:
  * `panorama`    - the game's own title-screen faces (default, closest to the menu)
  * `screenshots` - the player's own in-game screenshots (fallback, their own world)

The output is git-ignored: Minecraft assets are not redistributed by this project.
Committed: this script, `manifest.json` (hashes/provenance) and `PROVENANCE.md`.

Usage:
    <dsh python> scripts/mc-backdrop.py                       # auto: panorama, else screenshots
    <dsh python> scripts/mc-backdrop.py --source panorama --version 1.21.4
    <dsh python> scripts/mc-backdrop.py --source screenshots --count 4
    <dsh python> scripts/mc-backdrop.py --blur 2              # EDICT-0014: bake radius <= 2 px
    <dsh python> scripts/mc-backdrop.py --proof .tmp/panorama-tile-proof.png

The bake radius is an explicit knob since EDICT-0013 (the founder could not tell what the
faded background was) and EDICT-0014 sharpened it again: the default is 2.0 px at
2,560 px wide and the cap is 2.0 px. The old recipe derived the radius from the width
(8 px at 2,560) with a 4 px floor.

EDICT-0014 geometry: the four side faces are centre-cropped to 640x640 and stitched into a
2,560x640 strip whose wrap seam (face 3 -> face 0) is crossfaded too, so the strip tiles as
a circle and the app's `transform: translateX` loop over two copies has no visible seam.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "panorama"
TEX_GUI = "minecraft/textures/gui/title/background/"
SIDES = 4
SIDE_FACES = [f"panorama_{i}.png" for i in range(SIDES)]       # the four horizontal faces
CAP_FACES = [f"panorama_{i}.png" for i in range(SIDES, 6)]      # top, bottom: record only
ALL_FACES = SIDE_FACES + CAP_FACES
CAP_ROLES = ["top", "bottom"]
MIN_FACE_PX = 512                                        # anything smaller is a decoy
HEIGHT = 640                                             # EDICT-0014: 4 x 640 = 2,560 wide
BLUR_DEFAULT_PX = 2.0                                    # EDICT-0014: hard cap 2 px
BLUR_MAX_PX = 2.0
CROSSFADE = 64
LOOP_SECONDS = 180
BRIGHTNESS = 0.95
SATURATION = 0.92
WEBP_QUALITY = 80


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
def resolve_faces(install: Path, version: str) -> tuple[list[Path], list[str], dict]:
    """Resolve all six cubemap faces; refuse placeholders and mismatched sizes."""
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
    roles: list[str] = []
    sizes: list[tuple[int, int]] = []
    for index, face in enumerate(ALL_FACES):
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
            sizes.append(image.size)
        paths.append(obj)
        roles.append("side" if index < SIDES else CAP_ROLES[index - SIDES])
    if len(set(sizes)) != 1:
        detail = ", ".join(f"{name}={size[0]}x{size[1]}" for name, size in zip(ALL_FACES, sizes))
        raise SystemExit(f"The six panorama faces disagree in size ({detail}); refusing to bake.")
    return paths, roles, {"kind": "panorama", "version": version, "assetIndex": index_id}


def screenshots(install: Path, count: int) -> tuple[list[Path], list[str], dict]:
    folder = install / "screenshots"
    images = sorted(
        (p for p in folder.glob("*.png") if p.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )[:count]
    if not images:
        raise SystemExit(f"No screenshots found in {folder}; take a few in game or use --source panorama.")
    return images, ["side"] * len(images), {"kind": "screenshots", "count": len(images)}


def square_face(path: Path, size: int) -> Image.Image:
    with Image.open(path) as image:
        image = image.convert("RGB")
        side = min(image.size)
        left = (image.width - side) // 2
        top = (image.height - side) // 2
        return image.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def _gradient_mask(crossfade: int, height: int) -> Image.Image:
    """Horizontal alpha ramp: 0 at the left edge, 255 at the right edge."""
    ramp = Image.linear_gradient("L").rotate(90, expand=True)
    return ramp.resize((crossfade, height), Image.BILINEAR)


def compose_linear(paths: list[Path], height: int, crossfade: int = CROSSFADE) -> Image.Image:
    """Stitch arbitrary images left to right with a crossfade at every joint (screenshots)."""
    faces = [square_face(path, height) for path in paths]
    width = height * len(faces)
    strip = Image.new("RGB", (width, height))
    for index, face in enumerate(faces):
        strip.paste(face, (index * height, 0))
    mask = _gradient_mask(crossfade, height)
    for joint in range(1, len(faces)):
        x = joint * height
        left = strip.crop((x - crossfade, 0, x, height))
        right = strip.crop((x, 0, x + crossfade, height))
        strip.paste(Image.composite(right, left, mask), (x - crossfade, 0))
    return strip


def compose_circular(paths: list[Path], height: int, crossfade: int = CROSSFADE) -> Image.Image:
    """Stitch the four cubemap sides into a strip that tiles seamlessly 3 -> 0 -> 3.

    A duplicated copy of face 0 is painted after the last joint so the wrap crossfade can
    sample the head of the next copy; the strip is then cut in the middle of face 0, which
    makes the last column and the first column neighbouring samples of the same face.
    """
    faces = [square_face(path, height) for path in paths]
    sides = len(faces)
    width = height * sides
    canvas = Image.new("RGB", (width + crossfade, height))
    for index, face in enumerate(faces):
        canvas.paste(face, (index * height, 0))
    canvas.paste(faces[0], (width, 0))

    mask = _gradient_mask(crossfade, height)
    for joint in range(1, sides + 1):                     # joint `sides` is the 4 -> 1 wrap
        joint_x = joint * height
        left = canvas.crop((joint_x - crossfade, 0, joint_x, height))
        right = canvas.crop((joint_x, 0, joint_x + crossfade, height))
        canvas.paste(Image.composite(right, left, mask), (joint_x - crossfade, 0))

    offset = crossfade // 2                               # cut inside face 0 -> exact wrap
    return canvas.crop((offset, 0, offset + width, height))


def blur_wrapped(image: Image.Image, radius: float, pad: int = CROSSFADE) -> Image.Image:
    """Gaussian-blur a strip as if it were periodic, so the wrap edges blur consistently.

    A normal blur clamps at the left/right edge, which leaves the first and last columns
    blurred with one-sided information and shows up as a faint step when the app tiles the
    strip. Blurring a wrap-padded copy and cropping it back keeps the seam smooth.
    """
    padded = Image.new("RGB", (image.width + 2 * pad, image.height))
    padded.paste(image.crop((image.width - pad, 0, image.width, image.height)), (0, 0))
    padded.paste(image, (pad, 0))
    padded.paste(image.crop((0, 0, pad, image.height)), (pad + image.width, 0))
    blurred = padded.filter(ImageFilter.GaussianBlur(radius=radius))
    return blurred.crop((pad, 0, pad + image.width, image.height))


# --------------------------------------------------------------------- output
def manifest_payload(
    *,
    strip: Image.Image,
    output: Path,
    inputs: list[dict],
    source: dict,
    install: Path,
    blur_radius: float,
    circular: bool,
) -> dict:
    faces = len(inputs)
    sides = sum(1 for entry in inputs if entry["role"] == "side")
    top_level = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": {**source, "faces": faces, "sides": sides, "caps": faces - sides},
        "install": str(install),
        "faces": faces,
        "sides": sides,
        "seamless": circular,
        "loop_seconds": LOOP_SECONDS if circular else None,
        "width": strip.width,
        "height": strip.height,
        "blur_radius": blur_radius,
        "brightness": BRIGHTNESS,
        "saturation": SATURATION,
        "compose": {
            "faces": faces,
            "sides": sides,
            "seamless": circular,
            "crossfade_px": CROSSFADE,
            "width": strip.width,
            "height": strip.height,
            "blur_radius": blur_radius,
            "loop_seconds": LOOP_SECONDS if circular else None,
            "brightness": BRIGHTNESS,
            "saturation": SATURATION,
        },
        "inputs": inputs,
        "output": {
            "file": output.name,
            "sha256": sha256_file(output),
            "size": list(strip.size),
            "bytes": output.stat().st_size,
        },
    }
    return top_level


def verify(manifest: dict, output: Path, *, circular: bool) -> list[str]:
    """Independent read-back checks on the written manifest + WebP (EDICT-0014)."""
    problems: list[str] = []
    checks: list[tuple[str, bool]] = []

    with Image.open(output) as image:
        checks.append(("output is WebP", image.format == "WEBP"))
        checks.append((f"output is {manifest['width']}x{manifest['height']}",
                       image.size == (manifest["width"], manifest["height"])))
    data = output.read_bytes()
    checks.append(("sha256 matches manifest", hashlib.sha256(data).hexdigest() == manifest["output"]["sha256"]))
    checks.append(("byte size matches manifest", len(data) == manifest["output"]["bytes"]))
    checks.append(("blur radius <= 2", manifest["blur_radius"] <= 2))
    checks.append(("brightness kept", manifest["brightness"] == 0.95))
    checks.append(("saturation kept", manifest["saturation"] == 0.92))
    if circular:
        checks.append(("six input sha256 present", len(manifest["inputs"]) == 6
                       and all(len(entry.get("sha256", "")) == 64 for entry in manifest["inputs"])))
        checks.append(("six faces recorded", manifest["faces"] == 6))
        checks.append(("four sides stitched", manifest["sides"] == 4))
        checks.append(("width == 4 * height == 2560",
                       manifest["width"] == 4 * manifest["height"] == 2560))
        checks.append(("height == 640", manifest["height"] == 640))
        checks.append(("seamless == true", manifest["seamless"] is True))
        checks.append(("loop is 180 s", manifest["loop_seconds"] == 180))
    for label, ok in checks:
        print(f"{'ok  ' if ok else 'FAIL'} {label}")
        if not ok:
            problems.append(label)
    return problems


def tiling_proof(strip: Image.Image, destination: Path) -> Path:
    """Render the strip twice, side by side, so the 4 -> 1 wrap joint is visible as a seam."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    copies = Image.new("RGB", (strip.width * 2, strip.height))
    copies.paste(strip, (0, 0))
    copies.paste(strip, (strip.width, 0))
    width = 2560
    height = max(1, round(copies.height * width / copies.width))
    copies.resize((width, height), Image.LANCZOS).save(destination, format="PNG")
    return destination


def main() -> int:
    started = time.perf_counter()
    parser = argparse.ArgumentParser()
    parser.add_argument("--install", default=None)
    parser.add_argument("--version", default="1.21.4")
    parser.add_argument("--source", default="auto", choices=["auto", "panorama", "screenshots"])
    parser.add_argument("--count", type=int, default=4, help="screenshots to stitch")
    parser.add_argument("--height", type=int, default=HEIGHT,
                        help=f"strip height in pixels (default {HEIGHT}; width = 4 x height)")
    parser.add_argument("--width", type=int, default=None,
                        help="deprecated alias: derives the height as width / 4")
    parser.add_argument(
        "--blur", type=float, default=BLUR_DEFAULT_PX,
        help=f"Gaussian blur radius in output pixels (0 to {BLUR_MAX_PX:g}; default "
             f"{BLUR_DEFAULT_PX:g}). The CSS filter adds a little more at display time.",
    )
    parser.add_argument(
        "--proof", default=None,
        help="also write a tiling proof PNG (the strip repeated twice) and assert the manifest facts",
    )
    args = parser.parse_args()
    if not 0 <= args.blur <= BLUR_MAX_PX:
        raise SystemExit(f"--blur must be between 0 and {BLUR_MAX_PX:g} px (EDICT-0014).")

    height = args.height
    if args.width:
        height = args.width // SIDES
        print(f"note: --width is deprecated; using height {height} px (EDICT-0014 geometry)")
    height = max(128, min(height, 1024))

    install = find_install(args.install)
    sources: list[Path] = []
    roles: list[str] = []
    provenance_meta: dict = {}
    errors: list[str] = []

    if args.source in ("auto", "panorama"):
        try:
            sources, roles, provenance_meta = resolve_faces(install, args.version)
        except SystemExit as error:
            errors.append(str(error))
            if args.source == "panorama":
                raise
    circular = bool(sources) and provenance_meta.get("kind") == "panorama"
    if not sources and args.source in ("auto", "screenshots"):
        sources, roles, provenance_meta = screenshots(install, args.count)
    if not sources:
        print("No usable backdrop source found:", file=sys.stderr)
        for message in errors:
            print("  -", message, file=sys.stderr)
        return 1

    side_paths = [path for path, role in zip(sources, roles) if role == "side"]
    strip = (compose_circular if circular else compose_linear)(side_paths, height)
    blur_radius = round(float(args.blur), 2)
    if circular:
        blurred = blur_wrapped(strip, blur_radius)
    else:
        blurred = strip.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    blurred = ImageEnhance.Brightness(blurred).enhance(BRIGHTNESS)
    blurred = ImageEnhance.Color(blurred).enhance(SATURATION)

    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / "backdrop.webp"
    blurred.save(output, format="WEBP", quality=WEBP_QUALITY, method=6)

    inputs = [
        {
            "role": role,
            "name": path.name,
            "source": str(path),
            "sha256": sha256_file(path),
            "size": list(Image.open(path).size),
        }
        for path, role in zip(sources, roles)
    ]
    manifest = manifest_payload(
        strip=blurred,
        output=output,
        inputs=inputs,
        source=provenance_meta,
        install=install,
        blur_radius=blur_radius,
        circular=circular,
    )
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    provenance = f"""# Backdrop provenance and licensing

The menu backdrop is derived from **Minecraft Java Edition {args.version}** using the
owner's own installation:

```
{install}
```

- Source: {provenance_meta.get('kind')} — {len(inputs)} cubemap faces resolved
  ({manifest['sides']} side faces stitched, {manifest['faces'] - manifest['sides']} caps recorded only)
- Geometry: the four side faces (`panorama_0..3`, centre-cropped to squares) are stitched into a
  {manifest['width']}x{manifest['height']} strip with {CROSSFADE}px crossfades at every joint **and at the
  4 -> 1 wrap**, so the strip tiles as a circle and the app's `transform: translateX` loop over two
  copies has no visible seam ({LOOP_SECONDS}s loop).
- `panorama_4` / `panorama_5` are the cubemap top and bottom caps: they are hashed in the
  manifest but never stitched into the horizontal strip.
- Post-processing: Gaussian blur radius {manifest['blur_radius']} (EDICT-0014 cap: 2 px),
  brightness {BRIGHTNESS}, saturation {SATURATION}, encoded WebP quality {WEBP_QUALITY}.
- **Discovery note:** the version jar's `panorama_*.png` files are 1x1 placeholders in modern
  versions. The real 1024x1024 faces are located through `assets/indexes/<id>.json` and read
  from `assets/objects/<sha>`. This script refuses anything smaller than 512px, and refuses to
  bake when the six faces disagree in size.
- The generated `backdrop.webp` is **git-ignored** and exists only on a machine with a
  legitimately purchased copy of the game. Only this script, the manifest and this notice are
  committed; no Mojang pixels are redistributed.
- Regenerate after a game update: `python scripts/mc-backdrop.py`.
- **Notice:** NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR
  MICROSOFT. "Minecraft" is used descriptively only; no logo, branding or endorsement implied.
"""
    (OUT / "PROVENANCE.md").write_text(provenance, encoding="utf-8")

    problems = verify(manifest, output, circular=circular)
    if args.proof:
        proof = tiling_proof(blurred, Path(args.proof))
        print(f"proof:   {proof}  ({proof.stat().st_size // 1024} KB, strip repeated twice)")
    if problems:
        raise SystemExit(f"verification failed: {problems}")

    elapsed = time.perf_counter() - started
    print(f"source:  {provenance_meta.get('kind')} - {len(inputs)} faces found "
          f"({manifest['sides']} sides stitched, {manifest['faces'] - manifest['sides']} caps recorded)")
    print(f"output:  {output}  {blurred.width}x{blurred.height}  {output.stat().st_size} bytes "
          f"({output.stat().st_size // 1024} KB)")
    loop = f"{manifest['loop_seconds']} s" if manifest["loop_seconds"] else "n/a (not a cubemap loop)"
    print(f"blur:    {blur_radius} px (cap {BLUR_MAX_PX:g})   loop: {loop}   "
          f"seamless: {manifest['seamless']}")
    print(f"manifest: {OUT / 'manifest.json'}")
    print(f"runtime: {elapsed:.1f} s")
    print("The app picks it up automatically on reload; dirt stays as the fallback.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
