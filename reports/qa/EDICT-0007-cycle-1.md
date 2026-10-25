# QA Evidence — EDICT-0007 · Cycle 1 · **QA_FAIL**

| Field | Value |
|-------|-------|
| Edict | EDICT-0007 — real Minecraft item icons |
| Cycle | 1 of 2 |
| Artifact under test | `scripts/mc-icons.py`, `src/assets/icons/**`, `src/app.js` icon wiring, `.gitignore`, design docs |
| Submitted by | 兵部 (extractor, renderer, app), 礼部 (provenance text) |
| Verifier | 测试部 + adversarial review of the research report's licensing finding |
| Environment | Windows, Node 22.14.0, Python 3.13, Pillow 12.3, Chrome 141 headless; local Minecraft Java 1.21.4 |
| Entry criteria `G1` | ✓ local client jar pinned by path + version |

## Findings

| Id | Severity | Finding | Evidence |
|----|----------|---------|----------|
| `D1` | **Blocking (legal)** | The first implementation **committed the Mojang-derived PNGs** to the repository. The Minecraft Usage Guidelines forbid redistributing game files; a public push would violate them. The delegated research agent caught this before any push. | `git status` showed 53 PNGs staged; research report §1 |
| `D2` | **Blocking (visual)** | `grass_block` rendered grey: `grass_block_top` is a greyscale biome-tinted texture, and the side was plain dirt because `grass_block_side_overlay` was not composited. | Icon check: top sample `(172,172,172)`; screenshot showed grey top |
| `D3` | Major | A fresh clone (no game installed) has no PNGs, so every `<img>` would 404 into a broken-image glyph. | No `error` handling existed in `slotHtml` |
| `D4` | Major | `sea_lantern` (16×80) and `lantern` (16×48) are animated strips; using them raw breaks the 16×16 contract. | Pillow size check |
| `D5` | Minor | The demo seed included `Chest`, the one item vanilla has no standalone texture for, so the default screenshot showed a letter among real icons. | Materials screenshot |

## Assessment

- `D1` is the most valuable finding of the project so far: it was found by **delegated research
  plus a second pair of eyes**, not by a test, and it changed the architecture (extractor +
  git-ignore + fallback) rather than a line of code.
- `D2`/`D4` are texture-format realities: Minecraft stores tint masks and animation strips, not
  final icons. A real icon pipeline must understand both.
- `D3` matters only after `D1`'s fix created the "icons may be absent" state; the fallback is
  now part of the contract test.

## Verdict

```
VERDICT: QA_FAIL
cases: total=72 pass=67 fail=5   (15 unit + 16 acceptance + 41 audit; 5 defects above)
defects: blocking=2 major=2 minor=1
open_questions: model-only items (chest/door/fence) remain lettered fallbacks
```

Returned to 尚书省 → 兵部/礼部: git-ignore the pixels, extractor-only commit, biome tint +
side overlay, animated first-frame crop, `<img>` error fallback, and a demo seed that does not
showcase the one known gap.
