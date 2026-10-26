# EDICT-0016 — Visual density and compact builds view

- **Issued by:** 皇帝 (the founder)
- **Drafted:** 礼部, 2026-10-25 · **Audited:** 測試部 (S2 PASS-WITH-CASES) · **Built:** 兵部 (packages A/B)
- **Status:** `WITHDRAWN` — withdrawn by 皇帝 on 2026-10-26 before S5 verification; nothing shipped
- **Recorded:** 2026-10-26 (Asia/Singapore)
- **Relates:** [EDICT-0013](EDICT-0013.md), [EDICT-0014](EDICT-0014.md), [EDICT-0015](EDICT-0015.md)

## 1. Why this record exists

On 2026-10-25 the founder filed a fourteen-item request: larger type and controls, a world
sidebar inside the main panel, a notes presentation change, timestamps on user-created
records, number-field selection and keyboard behaviour, a `−`/`+` stepper replacing the
six-button strip, aligned section rules, and a "compact builds view" from
`D:\compact view reqs.md` (225-line FRD).

The round reached S2 (audit PASS-WITH-CASES, 96 frozen browser cases), both build packages
landed in the working tree, and the browser suite was carried to 96/96 while the tree was
under construction.

On **2026-10-26** the founder withdrew the request in full: the round had changed the size of
everything and replaced the deliberate small, compact, dense appearance that the original
design philosophy was built on. Their stated direction was to keep only two things: a
vanilla-panorama backdrop and the Minecraft.ttf typeface.

## 2. What was done with the work

- **Nothing from this round ships.** Every `src/` change was discarded; the tree was returned
  to `e1308d6` (EDICT-0015) and re-verified: `node scripts/app-qa.mjs run` → 80/80, stamp
  `verified — 2026-10-26T01:58:43.177Z (80 UI cases)`.
- The discarded working tree is preserved **outside the repository** (git stash
  `discarded: EDICT-0016 14-item round (founder withdrew)`, plus copies under `.tmp/discarded/`)
  so the round can be resumed if the founder ever reverses this decision. It is not part of
  the product's history and none of its tests, fixtures or evidence remain in `tests/**` or
  `reports/**`.
- Both things the founder asked to keep were **already shipped and verified** before this
  round: `src/assets/fonts/Minecraft.ttf` is the primary face (`--font-pixel: 'Minecraft',
  'Pixelify', …`) since EDICT-0013, and the backdrop is the stitched vanilla panorama
  (`src/assets/panorama/backdrop.webp`, six inputs, four sides stitched, `loop_seconds: 180`)
  since EDICT-0014. The revert restores exactly that state; no new source change was needed.

## 3. Limits

- The withdrawal is recorded, not audited; no S5 verdict exists for this round and none is
  owed.
- The design system and wiki were **not** updated for this round (they document shipped state
  only). The density question stays open in `wiki/synthesis/open-questions.md`.
- The 96 browser cases, fixtures and evidence generated during the round are archived under
  `.tmp/discarded/`, not in `tests/qa/` or `reports/qa/evidence/`.
