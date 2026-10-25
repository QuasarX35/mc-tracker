---
title: Atmosphere and identity without shipping assets
type: synthesis
summary: Making a homemade tool feel like the game — real menu scenery and avatars — while committing no game pixels and surviving their absence.
updated: 2026-10-25
sources:
  - 2026-10-25-minecraft-panorama-provenance
  - 2026-10-25-minecraft-asset-provenance
tags: [design, provenance, product]
---

# Atmosphere and identity without shipping assets

The [[Minecraft Build Tracker]] got two things in EDICT-0010 that pull in opposite directions:
it should feel *more* like the game (the title-screen scenery, per-world and per-build avatars),
while its repository must keep containing **zero** Minecraft pixels. The resolution is a
pattern rather than a one-off.

## The pattern

1. **Extract locally, commit instructions.** `scripts/mc-backdrop.py` and
   `scripts/mc-icons.py` read the owner's own installation; the resulting images are
   git-ignored. The repository ships the extractors, the filename/hash manifests and
   `PROVENANCE.md` notices ([[Vanilla assets without redistribution]]).
2. **Probe at runtime, never assume.** The backdrop is revealed by a successful `Image()`
   probe of `assets/panorama/backdrop.webp`; if it fails the dirt texture simply stays. The
   absence of game assets is a supported state, not an error ([[Local-first tracking]]).
3. **Choose the format the game actually uses.** The menu "panorama" is six cube faces, and
   the jar copies are 1×1 decoys — the real ones live in the asset store behind the asset
   index ([[In-game GUI design]]). A tool that reads `panorama_*.png` from the jar ships a
   blank screen.
4. **Convert taste into measurable properties.** "Just like the menu" became: a blurred layer
   present, an animation named `panorama-drift`, a scrim token, a frozen state under
   `prefers-reduced-motion`, a dirt fallback when the URL is blocked, and no console errors.
   Each is asserted in the browser suite.

## Identity: item icon or upload

Worlds and builds carry one optional icon: a slug from the locally extracted 53-icon set, or
an uploaded picture centre-cropped to 128×128 and stored as an inline WebP/PNG data URL
(≤120 000 chars). Uploads therefore travel with backups but count against browser storage;
the cap is enforced in the model, so a bad import cannot bloat or corrupt the state. A missing
icon file falls back to the subject's initial rather than a broken image.

## Tensions

- **Richness vs. repository purity.** Every good-looking asset is a local artifact that a
  fresh clone does not have. The README treats extraction as a setup step and the UI degrades
  honestly; screenshots in the QA evidence show the rich state, not the default.
- **Storage honesty.** Inline images trade a server for browser quotas. Many uploads make
  exports large and can hit `localStorage` limits; the app surfaces quota errors but cannot
  prevent them ([[Local-first tracking]]).
- **Authenticity has a taste dimension.** Pan speed, blur radius and scrim alpha were tuned
  against screenshots, not measured; "menu-like" remains a judgement.
- **Emulation is not a device.** 390 px and reduced-motion are emulated in headless Chrome;
  no phone or OS-level motion preference was physically observed.

## Relations

- Implements the product-facing side of [[Vanilla assets without redistribution]].
- Extends [[In-game GUI design]] from chrome into atmosphere and identity.
- Verified by [[Testing a UI like a user]] (36 browser flows at the time).
