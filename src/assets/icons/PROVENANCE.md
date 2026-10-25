# Icon provenance and licensing

These icons are derived from **Minecraft Java Edition 1.21.4** textures, extracted
from the owner's own installed game client:

```
C:\Users\KZ\AppData\Roaming\.minecraft\versions\1.21.4\1.21.4.jar
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
  the provenance of any pixel can be retraced.