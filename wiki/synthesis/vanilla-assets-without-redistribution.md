---
title: Vanilla assets without redistribution
type: synthesis
summary: How to use a game's real artwork in a personal tool without shipping it — extractor, filename manifest, git-ignore, graceful fallback.
updated: 2026-10-25
sources:
  - 2026-10-25-minecraft-asset-provenance
  - 2026-10-25-minecraft-gui-design-system
tags: [licensing, asset-pipeline, pattern]
---

# Vanilla assets without redistribution

Written after getting this wrong once. The first implementation of the [[Minecraft Build
Tracker]]'s icons **committed Mojang-derived PNGs** to the repository; a delegated research pass
flagged that as redistribution, and the architecture changed before anything was pushed.

## The rule

A game's assets may be used by the owner locally, but they may not be redistributed. Therefore:

1. **Commit the extractor, not the output.** `scripts/mc-icons.py` reads the owner's own client
   jar; the generated `*.png` files are git-ignored.
2. **Commit a manifest of names, not pixels.** `manifest.json` records the source version, the
   jar path, the method, the source texture filenames and a SHA-256 per file. Provenance is
   public; artwork is not.
3. **Make absence survivable.** A clone without the game must not show broken images. The app
   falls back to a lettered slot, and the acceptance suite asserts that fallback exists.
4. **Say it out loud.** `PROVENANCE.md` ships with the app: what was extracted, from where, and
   the "not an official Minecraft product" notice.

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
- **Model-only items remain excluded** (chest, doors, fences): no flat texture exists, and
  rendering 3D models is out of scope for an icon set that already reads correctly.
- **The same pattern generalises** to fonts, sounds and other licensed assets — extract locally,
  commit instructions, degrade gracefully.

## Relations

- Applies to [[Minecraft Build Tracker]] and [[In-game GUI design]].
- Depends on the storage decisions in [[Local-first tracking]] only insofar as the app must run
  without network.
- Recorded from [[LLM Wiki pattern]]'s practice of filing decisions back into the wiki.
