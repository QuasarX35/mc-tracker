# Backdrop provenance and licensing

The menu backdrop is derived from **Minecraft Java Edition 1.21.4** using the
owner's own installation:

```
C:\Users\KZ\AppData\Roaming\.minecraft
```

- Source: panorama — 4 images
- Method: faces centre-cropped to squares, composited into a 2560x640
  strip with 64px crossfades, Gaussian blur radius 8,
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
