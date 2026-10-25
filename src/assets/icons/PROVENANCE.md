# Icon provenance and licensing

These icons are derived from **Minecraft Java Edition 1.21.4** on the owner's own
installation:

- Game client: `C:\Users\KZ\AppData\Roaming\.minecraft\versions\1.21.4\1.21.4.jar`.
- Inventory render export: `C:\Users\KZ\AppData\Roaming\.minecraft\icon-exports-x256` (`icon-exports-x256/` from IconExporter).
- Rendering: IconExporter 1.3.1 for Minecraft 1.21.4 rendered each item exactly as the game draws it in an
  inventory slot, at **256×256** (16x the GUI pixel). The renders were exported
  2025-05-06 and are copied **byte-for-byte** —
  no scaling, tinting or re-encoding by this project.

- The app shows them at 22 px in material slots (including icon-picker tiles) and inside 24/28/36/44 px avatar images in 28/32/40/48 px boxes; the 256 px source keeps every size sharp, including high-DPI screens.
- Extracted: 2026-10-25 by `scripts/mc-icons.py`. Regenerate with the same command
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
  provenance of any pixel can be retraced.