# QA Evidence — EDICT-0007 · Cycle 2 · **QA_PASS**

| Field | Value |
|-------|-------|
| Edict | EDICT-0007 — real Minecraft item icons |
| Cycle | 2 of 2 (budget exhausted; a further failure escalates to `X1`) |
| Artifact under test | same pinned set plus fixes |
| Submitted by | 兵部 (pipeline, app), 礼部 (provenance/licensing text) |
| Verifier | 测试部 |
| Environment | Windows, Node 22.14.0, Python 3.13 + Pillow 12.3, Chrome 141 headless, Minecraft Java 1.21.4 client |
| Entry criteria `G1` | ✓ jar path, version and extraction commands recorded |

## Defect closure

| Id | Status | Verification |
|----|--------|--------------|
| `D1` | **Fixed** | `.gitignore` now ignores `src/assets/icons/*.png`; `git ls-files` returns **0** icon PNGs; acceptance `AC-10` asserts the ignore rule; `PROVENANCE.md` states no redistribution and carries the official notice. Extractor + manifest + `icons.js` remain committed (filenames only). |
| `D2` | **Fixed** | `grass_block_top` + `grass_block_side_overlay` tinted with plains `#91BD59`; top sample now `(74,97,45)`; screenshot shows green grass block. |
| `D3` | **Fixed** | `wireIconFallbacks()` replaces a failed `<img>` with the lettered slot; asserted by `AC-10` (`wireIconFallbacks` present) and exercised by design for a clone without icons. |
| `D4` | **Fixed** | Animated strips cropped to frame 1 inside `load_png()`; `sea_lantern`/`lantern` icons are 16×16. |
| `D5` | **Fixed** | Demo seed uses `Crafting Table` (real icon) instead of `Chest`; the lettered fallback remains documented as the chest/doors/fences limitation. |

## Acceptance traceability

| Check | Result |
|-------|--------|
| 53 icons declared, 53 PNGs generated, one display name each | Pass |
| Every icon is a valid 16×16 PNG with a SHA-256 matching `manifest.json` | Pass |
| Manifest records source game version, local jar path, isometric method | Pass |
| Blocks composited as isometric cubes (not flat faces) | Pass — 39 cubes |
| Animated textures cropped to first frame | Pass |
| Greyscale textures biome-tinted (grass) | Pass |
| Mojang pixels git-ignored; extractor + manifest committed | Pass — `git ls-files` shows 0 PNGs |
| Provenance/licensing notice names Mojang, forbids redistribution, disclaims affiliation | Pass |
| Missing icons degrade to lettered slots, never broken images | Pass |
| App loads the generated set under `file://` (classic script, no fetch) | Pass |
| Existing suites unaffected | 15/15 unit, 16/16 acceptance |
| UI audit | **41/41** (30 previous + 11 icon/provenance cases) |

## Visual verification

| Render | Result |
|--------|--------|
| Builds view, 1280×1250 | Stone Bricks / Iron Ingot / Glass / Torch render as real game icons |
| Materials view, 1280×1000 | Isometric cubes for cobblestone/planks/bricks; real sprites for ingot/torch; per-row XP bars intact |
| Icon contact sheet | 53/53 icons recognisable; grass green; glass translucent |

## Verdict

```
VERDICT: QA_PASS
cases: total=72 pass=72 fail=0
defects: blocking=0 major=0 minor=0
open_questions: model-only items (chest, doors, fences) stay lettered — documented, not hidden
```

Released to `S6`; shipped with the repo containing **no Mojang asset files**.
