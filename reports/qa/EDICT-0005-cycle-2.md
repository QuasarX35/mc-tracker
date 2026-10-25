# QA Evidence — EDICT-0005 · Cycle 2 · **QA_PASS**

| Field | Value |
|-------|-------|
| Edict | EDICT-0005 — Minecraft Build Tracker |
| Cycle | 2 of 2 (budget exhausted; a further failure would escalate to `X1`) |
| Artifact under test | same pinned set as cycle 1, plus fixes and the new regression test |
| Submitted by | 兵部 (seed, token, icon, tests), 礼部 (MASTER contrast note) |
| Verifier | 测试部 |
| Environment | Windows, Node v22.14.0, Python 3.13 + Pillow, Chrome 141 headless |
| Entry criteria `G1` | ✓ pinned paths, commands and versions recorded |

## Defect closure

| Id | Status | Verification |
|----|--------|--------------|
| `D1` | **Fixed** | `AC-16` regression: Iron Farm has exactly 4 materials; Stone Bricks 384/200 present. Rendered shopping list now sums 8 items / 2 280 needed / 900 gathered. |
| `D2` | **Fixed** | `--mc-text-muted` → `#4a4a4a`; audit case `contrast/mc-text-muted-on-mc-panel` passes at **5.19:1**. |
| `D3` | **Fixed** | Glass icon regenerated with a dark frame + highlights; visible on the grey slot in the materials render. |
| `T1` | **Fixed** | Arrays normalised across the realm boundary (`plain()`), all 15 unit cases green. |
| `E1` | **Worked around, documented** | 390px verified through `.tmp/mobile-harness.html` (iframe); the constraint is recorded in EDICT-0005 §7 and in the design system checklist. |

## Acceptance traceability

| AC | Result | Evidence |
|----|--------|----------|
| Shopping list = sum of builds | Pass | `AC-2` recomputes expectations independently |
| Remaining never negative | Pass | `AC-3` over-farm case |
| Duplicate items merge | Pass | `AC-4` case-insensitive merge |
| Delete world leaves no dangling active world | Pass | `AC-5` |
| Backup round-trip / bad file refused | Pass | `AC-6` |
| Offline, `file://`, local assets only | Pass | `AC-8`, `AC-9`, audit `html/offline`, `html/local-font` |
| Icons and letter fallback | Pass | `AC-10` |
| Labelled controls, no inline handlers | Pass | `AC-11` |
| App touches only existing ids | Pass | `AC-12` |
| Tabs / landmarks / skip link | Pass | `AC-13`, audit `a11y/*` |
| Pixel contract (square, pixelated, bundled font) | Pass | `AC-14`, audit `html/square`, `html/pixelated` |
| Focus, reduced motion, live regions | Pass | `AC-15`, audit `html/focus-visible`, `html/reduced-motion` |
| Seed regression (D1) | Pass | `AC-16` |
| Contrast for every used pair | Pass | audit `contrast/*` — 11/11 pairs, min 4.5:1 |

## Visual verification

| Render | Viewport | Result |
|--------|----------|--------|
| `?tab=builds` | 1280×1250 | Panel, tabs, bevels, XP bar, item slots, tooltip styling all correct |
| `?tab=materials` | 1280×1000 | XP progress bars visible per row, icons legible, filters aligned |
| `?tab=worlds` | 1280×1000 | Active-world chip, per-world roll-ups, actions |
| `?tab=materials` | 390 px (iframe) | Single column, no horizontal overflow, table columns collapse correctly |

## Verdict

```
VERDICT: QA_PASS
cases: total=66 pass=66 fail=0   (15 unit + 16 acceptance + 30 audit + 5 visual)
defects: blocking=0 major=0 minor=0
open_questions: none blocking; mobile harness noted as an environment workaround
```

Released to `S6`; 早朝 reported to the Emperor.
