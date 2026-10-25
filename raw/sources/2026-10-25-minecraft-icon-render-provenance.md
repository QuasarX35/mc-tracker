---
title: Minecraft item icons — high-resolution render provenance (snapshot)
type: raw-source
captured: 2026-10-25
origin: EDICT-0011 — scripts/mc-icons.py, src/assets/icons/{manifest.json,PROVENANCE.md}, IconExporter export
capture_method: distilled from the local IconExporter export set, the shipped extractor and the QA record
---

# Minecraft item icons — high-resolution render provenance

How the build tracker gets the game's real item icons at 256×256 without redistributing a
single Mojang pixel.

## The source that was already on the machine

The EDICT-0007 extractor rendered icons itself from the client jar's 16×16 textures: flat
sprites copied, cube blocks composited as a 2:1 isometric icon with face shading. That was the
best a texture-only pipeline could do, and the result was visibly approximate — skewed cube
geometry on logs and furnaces, no 3D item models for torch/ladder/lantern.

The owner's game installation also contained an **IconExporter (CyclopsMC) export set**:

```
%APPDATA%\.minecraft\icon-exports-x256\
    minecraft__stone.png          256×256 RGBA
    minecraft__grass_block.png    …
    minecraft__torch.png          …        1609 item renders + 5 fluid renders
```

- Files are `minecraft__<registry id>.png`, 256×256 RGBA, one per item.
- They are the game's **inventory renderer output**, not upscaled textures: the actual 3D item
  model is projected exactly as in an inventory slot, at 16× the GUI pixel. Each texture texel
  becomes a 16 px block for block items; 2D sprites keep their in-game relative size.
- Export evidence: the files are dated 2025-05-06, the same minute the NeoForge
  21.4.135 (`1.21.4`) launcher profile was last used, and the installed mod is
  `iconexporter-1.21.4-neoforge-1.3.1-135.jar`. The exported item set contains 1.21.4-only
  items (`pale_oak_planks`, `resin_brick`, `creaking_spawn_egg`), so the renders are from
  **Java Edition 1.21.4**, matching the version the app records.
- Coverage: all 53 slugs the app curates exist in the export set. The full export is much
  larger (1609 items); the app deliberately uses the curated 53-material set.

## Why copy instead of re-composite

The export is already the exact frame the game draws in a slot: the isometric projection,
front-face selection, item-model geometry and relative sizes are the game's, not an
approximation. Copying the PNGs byte-for-byte keeps that fidelity and removes the
compositor's failure modes. The old compositor remains only as the fallback for a machine
with the game but no IconExporter export.

## Display policy: smooth downscale

The app draws a slot icon at 22 px and avatars at 28/32/40/48 px, so a 256 px source is
downscaled by the browser. `image-rendering: pixelated` would nearest-scale the render and
alias badly; the item icons therefore use `image-rendering: auto` (smooth), while the tiled
block textures and the rest of the pixel-art chrome keep `image-rendering: pixelated`. The
"integer scale only" rule of EDICT-0005 was written for 16×16 textures; it is retired for item
icons and preserved for tiled textures (design-system MASTER, EDICT-0011).

## Manifest contract (committed) and pixels (never committed)

- `src/assets/icons/manifest.json` records `source.mode` (`hires-exports` or `jar-fallback`),
  the game/exporter provenance, `pixels`, and per icon: name, slug, kind, image filename,
  pixels, source render path and SHA-256.
- `src/assets/icons/*.png` stay git-ignored; the extractor, manifest, `icons.js` and
  `PROVENANCE.md` are committed. The licensing position is unchanged from EDICT-0007: personal
  use of assets from an owned copy, no redistribution, notice shipped with the app.
- Regenerating after a game update means re-exporting with IconExporter (one export per
  version) and re-running `scripts/mc-icons.py`; without an export the script falls back to the
  jar path and records `jar-fallback` + `pixels: 16`.

## Limits

- The export is a point-in-time artifact: it is not reproducible from the repository, only
  from the owner's game. Game updates silently change item models until re-exported.
- The high-resolution path depends on a third-party mod (IconExporter); the fallback path
  keeps the app usable without it at lower resolution.
- The curated 53-item set is unchanged. Model-only items (chest, doors, fences) could now be
  rendered, but adding them is a separate product decision.
