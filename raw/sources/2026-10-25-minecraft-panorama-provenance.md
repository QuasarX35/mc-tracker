---
title: Minecraft panorama and identity assets — provenance policy (snapshot)
type: raw-source
captured: 2026-10-25
origin: EDICT-0010 — scripts/mc-backdrop.py, src/assets/panorama/PROVENANCE.md, model icon policy
capture_method: distilled from the shipped extractor, the model validation rules and the QA record
---

# Minecraft panorama and identity assets — provenance policy

How the build tracker gets the in-game menu look and per-entity identity while shipping no
game pixels.

## The decoy discovery

The planning assumption was that the title-screen panorama ships as six 1024×1024 PNGs inside
the client jar. **It does not.** In Minecraft Java 1.21.4 (and every nearby version checked),
`assets/minecraft/textures/gui/title/background/panorama_0…5.png` inside the version jar are
**1×1 placeholders**. The genuine faces live in the content-addressed asset store:

```
%APPDATA%\.minecraft\versions\<v>\<v>.json        → assetIndex.id
%APPDATA%\.minecraft\assets\indexes\<id>.json     → objects["minecraft/textures/gui/title/background/panorama_0.png"].hash
%APPDATA%\.minecraft\assets\objects\<2-char-prefix>\<hash>   → the real 1024×1024 face
```

The extractor resolves that chain and **refuses any face smaller than 512 px**, so the decoy
produces a clear error instead of a blank background.

## Composition rules (as implemented)

- Four side faces (`panorama_0…3`) stitched horizontally, 64 px crossfades at the seams.
- Square centre-crop per face → strip at 2560×640.
- Baked Gaussian blur, radius ≈ width/320 (≈8 px at 2560), brightness 0.95, saturation 0.92.
- Encoded WebP quality 80 (~14 KB), written to `src/assets/panorama/backdrop.webp`.
- Runtime CSS adds a 2 px blur, a `0.12` scrim plus vignette, and a 120 s ping-pong pan
  (30 % ↔ 70 % of the overflow) so it never shows a wrap seam. Reduced motion freezes it.
- Alternative source `--source screenshots`: the player's own in-game screenshots, centre-cropped
  and crossfaded into the same strip. Useful without a client panorama, or to feature one's own
  world.

## Identity images

- Worlds and builds may carry `{ kind:'item', slug }` (from the 53 locally extracted icons) or
  `{ kind:'image', dataUrl }`.
- Uploads are centre-cropped to square, drawn on a 128×128 canvas, and encoded WebP quality
  0.82 (PNG fallback). The data URL is capped at **120 000 characters** and must match
  `^data:image/(png|jpeg|webp);base64,…`; SVG/HTML MIME types are refused.
- Because the image lives inside the saved state, an export/import backup carries it; the
  cost is browser-storage usage and larger backups.

## Licensing policy (both features)

- Assets come only from the owner's own installation; nothing is downloaded.
- The repository commits the **extractors**, **filenames/hashes manifests** and **provenance
  notices**; it never commits pixels. `.gitignore` covers `src/assets/icons/*.png` and
  `src/assets/panorama/*.webp|png|jpg`.
- Uploaded pictures are user content, stored locally and included in the user's own backups.
- Notice shipped with the app: NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED
  WITH MOJANG OR MICROSOFT.

## Fallbacks

| Missing piece | Behaviour |
|---------------|-----------|
| Panorama file | runtime `Image()` probe fails → dirt texture stays; `window.__backdrop === 'dirt'`; no user-visible error |
| Panorama corrupted | same as missing (probe failure) |
| Item icon PNG not extracted | avatar shows the subject's initial (onerror wiring) |
| User rejects an upload | toast + inline form error; state unchanged |
