---
title: Atmosphere and identity without shipping assets
type: synthesis
summary: Making a homemade tool feel like the game — real menu scenery and avatars — while committing no game pixels and surviving their absence.
updated: 2026-10-25
sources:
  - 2026-10-25-minecraft-panorama-provenance
  - 2026-10-25-minecraft-asset-provenance
  - 2026-10-25-minecraft-icon-render-provenance
  - 2026-10-25-minecraft-font-licence
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
   present, an animation named `backdrop-translate`, a scrim token, a frozen state under
   `prefers-reduced-motion`, a dirt fallback when the URL is blocked, and no console errors.
   Each is asserted in the browser suite. When the emperor asked for less blur (EDICT-0013), the
   taste was re-expressed as numbers: bake radius 8 → 2.5, CSS `blur(2px)` → `1px` (`1.5px` at
   ≤640 px), scrim 0.12 → 0.2, and edge-variance 1,132.6 → 1,379.9 on the same 1,280×900 strip
   ([[In-game GUI design]]). EDICT-0014 added the motion half: six resolved inputs, four side
   faces stitched with a wrap crossfade into a 2,560×640 strip, baked at 2.0, displayed as two
   copies translated −50 % over 180 s — a seamless one-direction loop in place of the 120 s
   ping-pong. EDICT-0015 diagnosed the still-static background (this machine reports
   `prefers-reduced-motion: reduce`, and the strip was drawn at 50 % × 100 % instead of its 4:1
   aspect) and replaced the two copies with one 800vh layer drifting over 120 s, with a WCAG pause
   control; reduce now defaults the layer to paused with the frame painted, never `animation: none`.

## Identity: item icon or upload

Worlds and builds carry one optional icon: a slug from the locally extracted **1,368-icon
catalog** — the game's 256×256 inventory renders (EDICT-0011), expanded from the curated 53 in
EDICT-0013 — or an uploaded picture centre-cropped to 128×128 and stored as an inline
WebP/PNG data URL (≤120 000 chars). Uploads therefore travel with backups but count against
browser storage; the cap is enforced in the model, so a bad import cannot bloat or corrupt the
state. A missing icon file falls back to the subject's initial rather than a broken image. The
picker pages 120 tiles at a time and keeps appending until all 1,368 are rendered, recent picks
lead the unfiltered list, and a deterministic suggestion can mark a tile with a stated reason —
without ever replacing a manual choice.

## Typography is identity

The interface face is now the game's own bitmap font rather than a re-drawn pixel font
(EDICT-0013): lowercase as small capitals, the slightly awkward spacing and the 107-codepoint
map read as "the game" in a way Pixelify Sans approximated. The cost is coverage — arrows,
dashes, ellipsis, `×`, `·`, `≥`, `≤` are missing from the game face and come from the fallback.
The licence is freeware ("100% Free" on DaFont, Craftron Gaming) and is recorded rather than
assumed: a sealed raw source and a licence file beside the TTF ([[Vanilla assets without
redistribution]]).

## Tensions

- **Richness vs. repository purity.** Every good-looking asset is a local artifact that a
  fresh clone does not have. The README treats extraction as a setup step and the UI degrades
  honestly; screenshots in the QA evidence show the rich state, not the default.
- **Storage honesty.** Inline images trade a server for browser quotas. Many uploads make
  exports large and can hit `localStorage` limits; the app surfaces quota errors but cannot
  prevent them ([[Local-first tracking]]).
- **Authenticity has a taste dimension.** Pan speed, blur radius and scrim alpha were tuned
  against screenshots, not measured. EDICT-0013 settled the sharpness (bake 2.5, CSS 1 px, scrim
  0.2), EDICT-0014 the seamless direction, and EDICT-0015 made the motion a single 800vh layer
  drifting over 120 s with a pause control and a default-paused state under reduce; none of that
  settles the comparison — nobody has watched it beside the real title screen on a physical
  display, so "menu-like" remains partly a judgement ([[Open questions]]).
- **A large identity catalog is a discovery problem.** 1,368 icons in one dialog is search-first:
  the picker pages 120 tiles at a time and never stops short, with curated/common items first,
  recents from the browser, and a deterministic suggestion. That fixes reachability but not
  finding: there is no letter jump or virtual list, so an obscure item still depends on search
  ([[Open questions]]).
- **The suggestion is editorial.** A frozen keyword table ranks name, notes, world name and
  material list and explains its pick; it is deterministic and cheap, not intelligent, and a
  plausible wrong icon is always possible. The reason string is the honesty mechanism
  ([[Open questions]]).
- **Emulation is not a device.** 390 px and the reduce preference are emulated in headless Chrome;
  the pause control is the tested escape hatch, but no phone or physical OS motion preference was
  observed.
- **Resolution is a one-off local upgrade.** The 256 px identity icons depend on an export of
  the owner's game that the repository cannot regenerate; a fresh machine still gets the
  lower-resolution fallback or letters ([[Vanilla assets without redistribution]]).

## Relations

- Implements the product-facing side of [[Vanilla assets without redistribution]].
- Extends [[In-game GUI design]] from chrome into atmosphere and identity.
- Verified by [[Testing a UI like a user]] (80 browser flows at the time).
- Extended by EDICT-0014's interaction pass: paging, recents and the suggestion make a
  1,368-icon identity catalog usable; the backdrop became a seamless 180 s loop.
- Extended by EDICT-0015's layout pass: the identity catalog is unchanged, but the scenery is now
  a single 800vh layer over 120 s with a pause control and a default-paused state under reduce;
  custom items join the catalogue as a local, typed extension
  ([[Status-ranked build ordering]], [[Material registry]]).
