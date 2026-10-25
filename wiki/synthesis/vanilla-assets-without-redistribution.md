---
title: Vanilla assets without redistribution
type: synthesis
summary: How to use a game's real artwork in a personal tool without shipping it — extractor, filename manifest, git-ignore, graceful fallback.
updated: 2026-10-25
sources:
  - 2026-10-25-minecraft-asset-provenance
  - 2026-10-25-minecraft-icon-render-provenance
  - 2026-10-25-iconexporter-dark-light-bug
  - 2026-10-25-minecraft-gui-design-system
  - 2026-10-25-minecraft-font-licence
tags: [licensing, asset-pipeline, pattern]
---

# Vanilla assets without redistribution

Written after getting this wrong once. The first implementation of the [[Minecraft Build
Tracker]]'s icons **committed Mojang-derived PNGs** to the repository; a delegated research pass
flagged that as redistribution, and the architecture changed before anything was pushed.

## The rule

A game's assets may be used by the owner locally, but they may not be redistributed. Therefore:

1. **Commit the extractor, not the output.** `scripts/mc-icons.py` reads the owner's own
   installation — the client jar and, when available, an IconExporter render export produced
   from it; the generated `*.png` files are git-ignored.
2. **Commit a manifest of names, not pixels.** `manifest.json` records the source mode (render
   export or jar fallback), the game/exporter provenance, the method and a SHA-256 per file.
   Provenance is public; artwork is not.
3. **Make absence survivable.** A clone without the game must not show broken images. The app
   falls back to a lettered slot, and the acceptance suite asserts that fallback exists.
4. **Say it out loud.** `PROVENANCE.md` ships with the app: what was extracted, from where, and
   the "not an official Minecraft product" notice.

## Source choice is part of fidelity

The rule puts no constraint on *how good* the local extraction may be. EDICT-0007 composited
cube icons by hand from 16×16 jar textures; the results were recognisable but geometrically
approximate. EDICT-0011 found a higher-quality local source that had been overlooked: the
game's own 256×256 inventory-render export. Copying those renders is still local extraction —
same licensing position — but the icons became the game's real projection instead of an
imitation. The lesson generalises: before building a renderer, check whether the game already
produced the images you want. Fallback still matters; the extractor labels the
lower-resolution path when the export is absent.

The EDICT-0011 → EDICT-0012 sequence adds a second lesson: **verify the extracted asset
against the game's own appearance.** The IconExporter 256 px renders came from the game yet
were ~a third too dark on 3D models, because a non-uniform pose scale flattens the GUI diffuse
lighting. "It came from the real client" did not guarantee fidelity; only a reference
measurement (the vanilla inventory face ratios 0.99 / 0.65 / 0.40 of the block texture) did.
The tracker now calibrates a per-face brightness gain against the jar, records it in the
manifest, and treats the corrected pixels as "the game's projection with restored vanilla
lighting" ([[Minecraft Build Tracker]]).

## Coverage: from curating 53 to reading the whole export

EDICT-0011 kept the product at 53 curated icons and recorded catalog expansion as a product
decision ([[Open questions]]). EDICT-0013 made that decision: the extractor now reads the whole
IconExporter export — 1,609 item renders — and collapses it to **1,368 addressable base items**
(1,363 plain names + 5 representatives of 246 component variants; the other 241 are
`collapsed_variants`). Curated common items lead the data; `MC_ICON_NAMES` is an object keyed by
slug and the manifest records name, stack, sha256 and lighting per icon. The licensing position
is unchanged — still zero committed pixels — but the manifest grew to 436,155 B and `icons.js` to
81 KB, which is the cost of coverage without a database. EDICT-0012's lighting classification
survives the migration (`block` 407 / `flat` 620 / `3d-other` 341); five flat sprites
(`enchanted_book`, `enchanted_golden_apple`, `end_crystal`, `experience_bottle`, `nether_star`)
are byte-for-byte copies disclosed as `flat_pixel_mismatches`.

The font is a second asset class testing the same pattern. `Minecraft.ttf` is freeware, not a
Mojang asset, but it is still third-party art with a licence claim: EDICT-0013 records the DaFont
listing and the file hash in a sealed raw source, ships a licence file beside the TTF, and
documents the 107-codepoint map so the Pixelify fallback is a deliberate choice rather than a bug.

EDICT-0014 puts the menu strip through the same accounting. The extractor resolves six panorama
inputs (the jar's `panorama_*.png` are 1×1 decoys, so the asset store is read through the asset
index), stitches the four side faces with a wrap crossfade into a 2,560×640 strip, and records the
top/bottom caps without stitching them. The manifest names every input with its hash and the
generator records bake 2.0, blur ceiling, crossfade, `faces: 6`, `sides: 4`, `loop_seconds: 180`
and `seamless: true`; the WebP itself is 55,096 B with sha256 `331253bd…bf1a5` and stays
git-ignored. The catalogue gains a small shape contract in the same pass: `MC_ICON_SET` remains an
array of slug strings while `MC_ICON_NAMES` and `MC_ICON_STACKS` are slug-keyed objects, so a
consumer cannot assume one shape for all three.

## Why this is better than the alternatives

| Approach | Problem |
|----------|---------|
| Commit the PNGs | Redistribution; the moment the repo is pushed or zipped for a friend it is a violation |
| Use a third-party asset mirror | Same assets, same legal footing, no version fidelity, and it hides the dependency |
| Draw approximations | No violation, but the product's whole point was the authentic look ([[In-game GUI design]]) |
| Load from the game at runtime via a local server | Over-engineering for a single-player tool; the repo can still ship the extractor |
| **Extractor + manifest + gitignore + fallback** | Needs one documented setup step; everything else improves |

## Tensions

- **Setup cost.** The app works out of the box but looks like letters until
  `scripts/mc-icons.py` runs once. Documented prominently; the fallback is honest rather than
  broken.
- **A false sense of safety.** The icons *are* on disk, so the machine is one `git add -f` away
  from re-committing them. The acceptance test guards the ignore rule, but the real safeguard is
  the manifest and the notice being obviously load-bearing.
- **Coverage is whole-export, with a collapsed tail.** 1,368 base items; the 246 potion,
  painting and similar component renders collapse to 5 representatives, so a specific variant is
  not pickable. Items the export lacks — including anything added to the game after the export —
  stay lettered. Broad coverage is not the same as every item.
- **The manifest is now product data.** 436 KB of names, stack sizes, hashes and lighting is
  committed beside 81 KB of `icons.js`; the stack table is curated (default 64, 16/1 exception
  categories), so a wrong entry is a plausibility bug that no pixel check will catch. The
  manifest is the source of truth for coverage and is regenerated, not hand-edited.
- **A freeware badge is a claim, not a clearance.** The font's DaFont listing says "100% Free";
  the wiki records the source and the file hash, not a legal opinion. If the font's terms change
  or are ambiguous, the fallback face is already bundled, which is the only mitigation this
  repository can offer.
- **A correct source can still be wrong.** The 256 px export came from the game yet was darker
  than the game's inventory; "it came from the real client" is not a fidelity guarantee. The
  extraction now carries a measured, documented brightness compensation for the upstream bug,
  and the audit checks the vanilla ratios ([[Minecraft Build Tracker]]).
- **High resolution depends on a third-party exporter.** The 256 px path needs IconExporter's
  export on the owner's machine; the repository cannot reproduce it. The fallback keeps the app
  honest, and the manifest labels which mode produced the pixels ([[Minecraft Build Tracker]]).
- **An animated strip makes tiling a correctness property.** The 180 s loop joins the last side
  face to the first with a crossfade, so a seam bug is visible every cycle rather than hidden at
  a pan endpoint; the manifest's `faces`/`sides`/`seamless` fields are what the acceptance check
  asserts. The top/bottom caps are recorded but cannot be stitched into a horizontal strip — a
  "360° scenery" claim is still the four side faces, not six.
- **The catalogue shape is mixed by design.** `MC_ICON_SET` is an array of slug strings, while
  `MC_ICON_NAMES` and `MC_ICON_STACKS` are slug-keyed objects; each shape is convenient for its
  consumer, but the contract must be read rather than guessed.
- **The same pattern generalises** to fonts, sounds and other licensed assets — extract locally,
  commit instructions, degrade gracefully.

## Relations

- Applies to [[Minecraft Build Tracker]] and [[In-game GUI design]].
- Extended by EDICT-0014 to the menu strip (six resolved inputs, four stitched sides, seamless
  180 s loop) and to a documented mixed catalogue shape.
- Depends on the storage decisions in [[Local-first tracking]] only insofar as the app must run
  without network.
- Recorded from [[LLM Wiki pattern]]'s practice of filing decisions back into the wiki.
