---
title: Minecraft asset provenance — extraction policy (snapshot)
type: raw-source
captured: 2026-10-25
origin: EDICT-0007 — scripts/mc-icons.py, src/assets/icons/PROVENANCE.md, delegated research report
capture_method: distilled from the shipped extractor, its manifest and the research findings
---

# Minecraft asset provenance — extraction policy

How the build tracker gets real Minecraft icons without redistributing Mojang's assets.

## Licensing

Minecraft Usage Guidelines distinguish personal use from redistribution:

- Personal use is explicitly tolerated: *"We are very relaxed about things you create for
  yourself. Pretty much anything goes there."*
- Redistribution is not: *"Do not redistribute our games or any alterations of our games or
  game files."* The EULA is binding; all rights remain with Mojang/Microsoft.

Consequence: copying textures out of the owner's own installed client into a folder only they
use is personal use. Committing those PNGs to a repository that may be pushed, shared or zipped
is redistribution — including "private" remotes, which become public by a single push.
Third-party asset mirrors are not legally cleaner: same assets, different host, plus version
drift.

**Policy adopted:** the repository commits the **extractor script**, a **manifest of source
filenames**, and **licensing text**; it never commits the pixels. Generated PNGs are
`gitignore`d. A clone without a Minecraft installation still runs — slots fall back to the
item's initial letter.

## Source

- Client jar: `%APPDATA%\.minecraft\versions\<version>\<version>.jar` — a plain zip.
- Textures inside: `assets/minecraft/textures/item/*.png` and
  `assets/minecraft/textures/block/*.png`.
- The content-addressed store `assets/objects/<2-hex>/<hash>` plus `assets/indexes/<ver>.json`
  also holds assets, but is hash-sharded and harder to map to names; the version jar is
  name-ordered and complete.
- Version used by the app: **Java Edition 1.21.4** (the same version the sample worlds record).

## Rendering rules (as implemented)

- **Item sprites** (ingots, gems, coal, stick, bucket, bread) are flat 16×16 PNGs — copied.
- **Blocks** are rendered by the game as a 3-face dimetric cube, not a flat texture. The
  extractor composites a 2:1 isometric icon from the block's top/side/front textures with the
  in-game face lighting: **top 100 %, left 80 %, right 60 %**.
- **Animated textures** (sea lantern, lantern, glowstone) are vertical frame strips; only
  frame 1 is used, so every icon stays 16×16.
- **Greyscale tint textures**: `grass_block_top` and `grass_block_side_overlay` are coloured at
  runtime by biome. With no biome data available, the extractor applies the **plains** colour
  `#91BD59` and records that choice.
- **No standalone texture exists** for chests, doors and fences — the game renders their 3D
  models. Those items keep the lettered fallback rather than a fabricated icon.

## Files

| File | Committed | Contents |
|------|-----------|----------|
| `scripts/mc-icons.py` | yes | extractor + isometric compositor + tint handling |
| `src/assets/icons/manifest.json` | yes | source version, jar path, method, per-icon texture names + SHA-256 |
| `src/assets/icons/icons.js` | yes | slugs and display names as a classic script (works from `file://`) |
| `src/assets/icons/PROVENANCE.md` | yes | licensing notice and extraction record |
| `src/assets/icons/*.png` | **no** | generated 16×16 icons, git-ignored |

## Notice shipped with the app

> NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
> "Minecraft" is used descriptively only; no Mojang or Microsoft logo, branding or endorsement
> is implied.
