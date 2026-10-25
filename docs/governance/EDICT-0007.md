# EDICT-0007 — Real Minecraft item icons (extracted locally, never redistributed)

- **Issued by:** 皇帝 — *"use the actual Minecraft item icons instead"*
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (extractor + renderer + app wiring), 礼部 (licensing text, docs, wiki), 测试部 (`S5Q`)
- **Research:** a delegated research agent (see §2), used for provenance, filenames and isometric calibration
- **Recorded:** 2026-10-25 (Asia/Singapore)
- **Status:** `ENACTED` — `S6`
- **Amends:** [EDICT-0005](EDICT-0005.md) (icon pipeline only; product behaviour unchanged)

## 1. What changed

The app previously shipped 18 hand-drawn placeholder icons. It now renders **53 icons from
Minecraft's own textures**, extracted from the owner's installed Java Edition 1.21.4 client:

- **Flat item sprites** (11): ingots, diamond, emerald, coal, charcoal, redstone, stick,
  water bucket, bread — copied at 16×16.
- **Cube blocks** (39): stone, cobblestone, deepslate family, granite/diorite/andesite,
  sandstone, sand, gravel, dirt, grass block, planks, logs, glass, wools, concretes,
  terracotta, nether blocks, quartz, obsidian, glowstone, sea lantern, metal blocks,
  bookshelf, crafting table, furnace.
- **Flat block textures** (3): torch, ladder, lantern.

Blocks are composited as the game shows them in the inventory: a **2:1 isometric cube** with
the wiki-standard face lighting (top 100 %, left 80 %, right 60 %) and the correct
top/side/front textures per block. Animated textures (sea lantern, lantern) are cropped to
their first frame. `grass_block_top` and the side overlay are **greyscale and biome-tinted**;
the app has no biome data, so it applies the plains colour `#91BD59` and says so in
`PROVENANCE.md`.

## 2. The research that changed the plan

A delegated research agent answered six questions (licensing, local paths, mirrors, inventory
rendering geometry, exact filenames, recommendation). Two findings mattered:

1. **Licensing.** The Minecraft Usage Guidelines allow personal use ("pretty much anything
   goes") but forbid redistributing game files. Committing the PNGs to a git remote *is*
   redistribution, and third-party mirrors are not legally cleaner — same assets, different
   host. **Decision: commit the extractor and the filename manifest; git-ignore the pixels.**
   This overrode the first implementation, which had committed them.
2. **Geometry + tint.** Inventory blocks are 3D dimetric cubes, not flat faces; item sprites
   are flat 16×16; `grass_block_top` renders grey until biome-tinted. The first build had a
   grey grass block and a missing side overlay; both were fixed.

## 3. Review record

| # | Finding | Disposition |
|---|---------|-------------|
| R1 | First plan committed Mojang PNGs to the repo. | **Rejected.** Redistribution. Replaced by extractor + git-ignored output. |
| R2 | Flat block textures in slots would not look like the game. | Isometric compositing required (top/left/right, 1.0/0.8/0.6). |
| R3 | A fresh clone has no icons; `<img>` would show broken images. | `wireIconFallbacks()` degrades to the lettered slot; tested. |
| R4 | Animated textures are vertical strips; using them raw breaks 16×16. | First frame only, documented. |
| R5 | Chest/doors/fences have no standalone texture (models only). | Chest intentionally falls back to a letter; the demo seed no longer features it. Flagged in docs. |
| R6 | Greyscale textures are biome-tinted; unreadable icons otherwise. | Plains tint applied + documented. |

## 4. Verification (`S5Q`) — two cycles

| Cycle | Verdict | Findings |
|-------|---------|----------|
| 1 | **QA_FAIL** | `D1` licensing (committed pixels) — caught by the research review before push; `D2` grey grass top + missing side overlay; `D3` no fallback for a fresh clone; `D4` animated textures read as 16×80 strips; `D5` demo seed showcased the one lettered fallback (Chest) |
| 2 | **QA_PASS** | 53 icons, 39 isometric cubes; 15/15 unit, 16/16 acceptance (incl. git-ignore + hash + fallback contract), 41/41 UI audit; screenshots reviewed with real icons in the build and shopping-list views |

Evidence: [cycle 1](../../reports/qa/EDICT-0007-cycle-1.md) ·
[cycle 2](../../reports/qa/EDICT-0007-cycle-2.md) · icons contact sheet in
`reports/qa/evidence/edict-0007/`.

## 5. Reproducing it

```powershell
# once, on a machine with Minecraft Java Edition installed:
<dsh python> scripts/mc-icons.py           # default: %APPDATA%\.minecraft, version 1.21.4
<dsh python> scripts/mc-icons.py --version 1.21.5 --install "D:\games\minecraft"
```

The script writes `src/assets/icons/*.png` (git-ignored), `manifest.json` (source textures +
SHA-256 per file), `icons.js` (slugs + display names for `file://`-safe loading) and
`PROVENANCE.md`. Nothing is downloaded; the only source is the local client jar.

## 6. Deliberate limits

- **No chests/doors/fences** as icons: vanilla has no standalone texture for them. The lettered
  fallback is honest; a real fix means rendering their 3D models, which is not worth it yet.
- **One biome tint.** Plains only; savanna/badlands grass will look "wrong" to a player who
  cares, and this is documented rather than silently faked.
- **No 32× GUI scale.** Icons are 16×16 sources drawn into 22 px slots; a 2× native render
  would sharpen them further if needed.
- **No redistributable variant.** If the repo is ever published, the icons must be removed;
  the app still works with letters.
