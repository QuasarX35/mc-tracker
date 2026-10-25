# QA Evidence — EDICT-0013 · Cycle 1

| Field | Value |
|-------|-------|
| Edict | EDICT-0013 — interaction & asset pass: Minecraft face, inline title rename, coords copy, notes view/edit, needed steppers, full item catalog, one icon dialog, material item selector, themed native dropdowns, sharper backdrop |
| Cycle | 1 of 2 |
| Artifact under test | `src/index.html`, `src/styles.css`, `src/app.js`, `src/tracker/model.js`, `src/assets/fonts/Minecraft.ttf`, `src/assets/icons/{icons.js,manifest.json,PROVENANCE.md}`, `src/assets/panorama/{backdrop.webp,manifest.json,PROVENANCE.md}`; tests `tests/qa/ui.e2e.test.mjs` (49), `tests/qa/mc_ui_audit.py` (138), `tests/qa/edict-0013-assets.acceptance.test.mjs` (11), `tests/qa/tracker-{acceptance,icons,icon-resolution}.acceptance.test.mjs` (17/8/7) |
| Stamp | `app-qa: verified — 2026-10-25T10:02:35.160Z (49 UI cases)`, written by `node scripts/app-qa.mjs run` from a green suite; hashes cover the five app sources + the three new baked assets (8 files) |
| Submitted by | 兵部 (app), 工部 (catalog + panorama), 太子 (font licence raw source) |
| Verifier | 测试部 — independent cases + audit + evidence analysis. **Browser execution by the Lead seat** (`F5`: this seat cannot launch Chrome; disclosed, not hidden), judgment by 测试部 |
| Environment | Windows, Node v22.14.0, bundled Python 3.12.14 + Pillow 12.3.0, Chrome 155.0.8059.86 (headed for the `::picker(select)` probe), Minecraft Java 1.21.4, `file://` |
| Entry criteria `G1` | Artifacts frozen by 尚书省/Lead; six case corrections recorded before judgment in `docs/governance/EDICT-0013.md` §3.5a (browser-semantics fixes, app untouched, no AC weakened) |

## Verdict

**`QA_PASS, cycle 1`** — 49/49 browser cases, **138/138** audit checks, **60/60** unit cases,
**71/71** acceptance cases, stamp re-made from the green suite and valid for the current sources,
`lint` clean, `sync` 5/5. No blocking defect survives. Two evidence artefacts are relabelled
honestly below (`07`, `10`) — the acceptance claims rest on other artefacts and are unaffected.

## Status of the claims

- Browser: **49/49**, exit 0, 40.9 s, `node scripts/app-qa.mjs run` in the Lead seat; the stamp is
  the independent trace that the suite exited green **and** that the current `src/` hashes match.
- Audit: **138/138**, exit 0, bundled Python (contrast, icons, structure, identity, edict0013).
- Unit: **60/60** (app-qa 9, tracker-icons 9, tracker-model 22, wiki-core 10, wiki-sync 10).
- Acceptance: **71/71** (tracker 17, tracker-icons 8, tracker-icon-resolution 7, wiki 13,
  wiki-sync 8, app-qa 7, edict-0013-assets 11).
- `node src/wiki/cli.mjs index --check` → up to date; `lint` → clean (22 pages, 0/0);
  `sync` → 5/5 completed edicts ingested (EDICT-0013 is not `S6` yet, so it is not required yet).
- `node scripts/app-qa.mjs status` → `verified` (no source drift since the stamp).

## Evidence inventory — `reports/qa/evidence/edict-0013/` (27 files, 22 PNG)

| Artefact | Size | Verified content |
|----------|------|------------------|
| `picker-probe.json` | 424 B | `base-select:"true"`, `supports:true`, `chrome:"155"`, `pickerBackground:"rgb(111, 111, 111)"`, `pickerBorder:"2px solid rgb(0, 0, 0)"`, `pickerFont:"Minecraft, Pixelify, ui-monospace, monospace"`, `optionCheckedColour:"rgb(255, 255, 255)"`, `cssSyntaxPicker:"true"`, `pickerOpenInHeaded:"false"` (honest: the final probe did not hold the popup open; AC9 does not need it — see below) |
| `01-builds-1280x900.png` | 322,476 B | second build selected; pencil **left** of Delete beside the title; icon-only copy button right of coords; notes as text; six steppers per row `+1 +10 +stack -1 -10 -stack`; closed `#world-select` visible in the topbar (AC9's closed-control screenshot) |
| `02-builds-notes-edit.png` | 317,371 B | notes textarea + `✓`/`✕` + "Ctrl+Enter to save" |
| `03-title-edit.png` | 318,990 B | title input + `✓`/`✕`, heading hidden |
| `04-materials-1280x900.png` | 308,316 B | shopping list, default "Still needed", totals `8 items · 800 / 2252 gathered · 1452 to go · 36%` |
| `05-picker-open-1280x900.png` | 215,639 B | one dialog, **no tabs**, `showing 150 of 1368 — refine your search`, footer "Upload image…", Cancel/Use icon |
| `06-add-material-dialog-1280x900.png` | 226,445 B | pick-item mode: "Choose an item", no None tile, no upload block, Cancel only |
| `07-dropdown-open-1280x900.png` | 215,111 B | **relabelled**: builds view scrolled below the topbar; neither an open popup nor the closed control is in frame (≈ `11`, 112/1,152,000 px differ). Chrome's select popup is an OS-level window that `Page.captureScreenshot` cannot capture |
| `08-builds-390x844.png` / `09-picker-390x844.png` | 47,741 / 38,605 B | 390×844 reflow; 4-column picker grid |
| `10-backdrop-before.png` | 171,475 B | **relabelled**: statistically identical to `11` (left strip mean 29.97 vs 29.94, edge-variance 1,379.9 vs 1,379.8) — it shows the current build, not the old blur. The genuine pre-change capture is `reports/qa/evidence/edict-0012/01-builds-view-corrected.png` (same strip: mean 29.35, edge-variance **1,132.6**) |
| `11-backdrop-after.png` | 215,088 B | AC10 after capture, 1,280×900 |
| `10b-backdrop-generator-preview.png` | 538,567 B | decisive AC10 visual: generator preview 8 px (top) vs 2.5 px (bottom); branches, leaves, flowers legible |
| `12-font-sample.png` | 361,503 B | 200 % masthead zoom — Minecraft face legible (lowercase as small capitals) |
| `05-material-steps.png` | 14,963 B | CDP clip of `#material-body` (740×264): all six stepper buttons per row, `+stack` label |
| `47-themed-select.png` / `48-backdrop-narrow-blur.png` | 76,414 / 88,851 B | `CSS.supports`/computed `appearance` capture; 390-wide backdrop layer |
| `font-probe.txt`, `blur-probe.txt`, `spinner-probe.txt` | 2,106 / 2,371 / 2,113 B | static probe sheets (see Analysis) |

SHA-256 of every PNG was re-checked after the final regeneration: **22 distinct hashes over 22
PNGs — no duplicate group**. `01-empty-state`, `03-demo-seed` (Worlds view), `24-mobile-390`,
`25-visual-contract`, `27-icon-fallback-probe`, `05-material-steps`, `06-picker-search`,
`47-themed-select`, `48-backdrop-narrow-blur` are written by the 49-case suite itself.

## Analysis notes (measured on the artefacts)

- **AC9 — themed native dropdown.** The `select` popup is an OS-level window; CDP screenshots
  capture the page only (Lead's controlled finding, 2026-10-25). AC9's evidence is therefore the
  headed probe + the closed control: `picker-probe.json` records `CSS.supports('appearance',
  'base-select')` true, Chrome 155, panel `rgb(111, 111, 111)`, top border `2px solid rgb(0, 0, 0)`
  and the Minecraft family on `::picker(select)`; `01` shows the closed control in the topbar; case
  47 asserts `CSS.supports` + computed `appearance: base-select`; the audit's `picker/*` checks
  reject `"supports": false`. Unsupported browsers keep the native popup by `@supports`.
- **AC10 — backdrop.** Manifest `blur_radius` **2.5** (was 8; `max(4, …)` floor removed, `--blur`
  under a 0–3 guard); `backdrop.webp` **45,664 B**, sha256
  `249a1598a120a142aebe73d5a54c7fd612e1d11a82298a3dcfa5734063635978`, 2,560×640, faces 4 /
  crossfade 64 unchanged; CSS layer `filter: blur(1px) brightness(0.95) saturate(1)` at 1,280 and
  `blur(1.5px)` at 390 (`src/styles.css:868`, `:1043`), scrim alpha 0.2. Pillow: new bake mean 47.06
  / edge-variance **20.3** vs archived before 47.12 / **14.2** (+43 %); the screenshot strips agree
  (1,132.6 → 1,379.9). The generator preview `10b` is the decisive visual; the archived before file
  and its SHA-256 are in `.tmp/before-edict-0013/` and recorded in `blur-probe.txt`.
- **AC1 — font.** `@font-face 'Minecraft'` → `src/assets/fonts/Minecraft.ttf` (14,488 B, sha256
  `bd47314d…acc65`, fsType 0) with `--font-pixel: 'Minecraft', 'Pixelify', ui-monospace, monospace`
  (`src/styles.css:16`, `:61`); the licence record `src/assets/fonts/Minecraft-LICENCE.md` and the
  raw page `raw/sources/2026-10-25-minecraft-font-licence.md` (sha256 `2e06df49…f5eba7`, raw seal
  7 → 8) are present; 110 `maxp.numGlyphs` vs 107 `cmap` codepoints, U+20AC euro present, no
  accented letters — disclosed; missing punctuation falls back to Pixelify (no tofu in 01/02/03).
- **AC5 — steppers.** `div.mat-steps` with six `button.mat-step[data-mat][data-step][data-stack]`
  buttons (`src/app.js:1191-1213`); stack from `MC_ICON_STACKS` (stone 64, egg 16, bucket 16,
  `water_bucket` 1, `diamond_sword` 1, `potion` 1, `honey_bottle` 16, `armor_stand` 16); clamp ≥ 1
  in the model (`M.stepNeeded`); the field stays `type="number"` with the three spinner-hiding CSS
  rules (audit `spinners-hidden`; the computed pseudo check is not assertable — Chromium 155 reports
  `textfield`, case 43 records why).

## Findings

| Id | Severity | Finding | Resolution |
|----|----------|---------|------------|
| `C1`–`C6` | Process (case-side) | Six frozen cases were mis-specified (14 build-wide pct, 17 default `remaining` filter, 27 None tile, 42/45 substring "egg", 43 unassertable pseudo-element, 29 `activeBuildId` not a model key) | corrected in `tests/qa/ui.e2e.test.mjs` **only**, recorded in §3.5a before judgment; no AC weakened; re-verified in headed Chrome |
| `A1` | App — was blocking | Case 11: deleting the last build left the detail panel non-empty | fixed by 兵部 (selection cleared before commit); green in the final run |
| `A2` | App — minor | Cases 32/33: focus chain after Escape / cancel did not land on `#build-rename` | fixed (rAF/timeout focus restore); green |
| `A3` | App — was blocking | Case 29: image-icon upload commit refused by the state schema | fixed; green |
| `E1` | Evidence — note | First crate had byte-identical PNGs (`05/11/12` = `01`) | crate regenerated; 22/22 distinct hashes now |
| `E2` | Evidence — note | The app-level `10`/`11` pair carries no visual contrast (both current build) | relabelled in the evidence README; genuine before = `reports/qa/evidence/edict-0012/01-builds-view-corrected.png`; decisive visual = `10b` |
| `E3` | Evidence — note | `07` shows neither an open popup nor the closed control (page scrolled below the topbar) | relabelled; AC9's closed-control screenshot is `01`; popup styling proven by `picker-probe.json` |

## Acceptance traceability

| AC | Requirement | Verified by | Result |
|----|-------------|-------------|--------|
| AC1 | Minecraft face primary, licence/seal, 110-vs-107, fallback for missing glyphs | `@font-face` + stack (`style:16/61`), TTF sha + fsType 0, licence file + raw seal 8, 110/107 + euro, case 25 computed + `document.fonts.check`, evidence 01/02/03/12 | **PASS** |
| AC2 | Inline title rename: pencil left of Delete, Save/Cancel, Enter/Escape | `src/index.html`/`src/app.js` contract ids, cases 09/33/34, evidence 01/03 | **PASS** |
| AC3 | Coords copy button + toast, disabled when empty | case 38 (stub + toast literal `Coordinates copied`), disabled state on empty coords, evidence 01 | **PASS** |
| AC4 | Notes as text in view mode; editor only while editing; Ctrl+Enter; trim; escaped; empty placeholder | cases 35–37, `notes__text`/`notes-editor` toggles, evidence 01/02 | **PASS** |
| AC5 | Six steppers/row, per-item `+stack`, clamp ≥ 1, stays `type=number` with hidden spinners | cases 39–43, audit `steppers/*` + `spinners-hidden` + `step-clamp`, `M.stepNeeded`, evidence 01/05-material-steps | **PASS** |
| AC6 | Catalog ≥ 1363 (measured 1,368), 1,609 renders / 241 collapsed, `MC_ICON_NAMES` object, manifest name/stack/sha256/lighting, curated 53 first, hopper `flat` | audit `icons/*` (contrast 11 pairs etc.), `tracker-icons` 8/8, `tracker-icon-resolution` 7/7, assets AC-A1–A9, case 31 | **PASS** |
| AC7 | Tabs gone; one dialog; footer upload still works | audit `a11y/picker-tabs-retired`, `identity/css-no-picker-tab`, `identity/app-no-icon-mode`, cases 28–30, evidence 05 | **PASS** |
| AC8 | Material chooser opens pick-item mode; chip set; row with icon; submit without selection errors | cases 44–46, audit `material/choose`, evidence 06 | **PASS** |
| AC9 | `base-select` path active; `::picker(select)` themed; fallback native | `picker-probe.json` (supports/Chrome 155/panel/border/font), case 47, audit `picker/probe-*` + `picker-panel-theme`, evidence 01 (closed control) | **PASS** |
| AC10 | Bake blur 2.5 (was 8), CSS ≤ 1 px (≤ 1.5 px mobile), 2,560×640, 45,664 B, sha `249a…5978`, provenance, before preserved | manifest + `backdrop.webp` hash/size, `blur-probe.txt` (1,132.6 → 1,379.9 strip sharpness), assets AC-A2/A3/A4, evidence 11/48/10b + edict-0012 before | **PASS** |
| AC11 | No regressions: all suites green, audit green, stamped, no console errors | unit 60/60, acceptance 71/71, browser 49/49 (exit 0), audit 138/138, stamp `10:02:35.160Z` (49 cases) verified against the sources, `lint` clean, `sync` 5/5, `index --check` clean | **PASS** |

## Numbers (measured)

- Browser: **49/49** cases, exit 0, 40.9 s (Lead seat, disclosed); stamp
  `app-qa: verified — 2026-10-25T10:02:35.160Z (49 UI cases)`.
- Audit: **138/138** checks in five groups.
- Unit: **60/60**; Acceptance: **71/71**.
- Catalog: **1,368 icons** / 1,609 renders (241 collapsed → 5 representatives), curated 53 first,
  `icons.js` 81 KB, `manifest.json` 434 KB; lighting block 407 / flat 620 / 3d-other 341
  (`hopper` flat, jar-verified; five `flat_pixel_mismatches` disclosed).
- Stacks: stone 64, egg 16, bucket 16, `water_bucket` 1, `diamond_sword` 1, `potion` 1,
  `slime_ball` 64.
- Font: `Minecraft.ttf` 14,488 B sha256 `bd47314d…acc65`; raw licence sha256 `2e06df49…f5eba7`;
  seal 7 → 8; 110 `maxp.numGlyphs` / 107 `cmap`; euro present.
- Backdrop: blur 8 → **2.5**; bytes 15,280 → **45,664**; sha256 `249a1598…5978`; 2,560×640;
  Pillow edge-variance 14.2 → 20.3; screenshot strip 1,132.6 → 1,379.9.
- Evidence: 27 files, 22 PNG, **22 distinct hashes**.

## Post-`S5` obligations (not QA findings)

- 礼部 `task-6`: design-system `MASTER.md`/`pages/tracker.md` sync, wiki pages listed in §5,
  `wiki/log.md` entry citing EDICT-0013, `raw/manifest.json` seal already contains the font
  licence (太子), ledger `S6`.
- Evidence index `07`/`10` relabelled in `reports/qa/evidence/edict-0013/README.md`; if the Lead
  wants a true "closed control" and a true "before/after pair" in one place, `01` and
  `reports/qa/evidence/edict-0012/01-builds-view-corrected.png` are the honest candidates.
