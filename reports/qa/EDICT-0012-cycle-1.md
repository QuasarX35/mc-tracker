# QA Evidence — EDICT-0012 · Cycle 1 · **QA_PASS** (no fix cycle required)

| Field | Value |
|-------|-------|
| Edict | EDICT-0012 — fix the IconExporter dark-lighting bug for 3D item icons |
| Cycle | 1 of 2 (passed on first verification; no code/UI defects found) |
| Artifact under test | `scripts/mc-icons.py` (offline per-face brightness correction), regenerated git-ignored `src/assets/icons/*.png`, `src/assets/icons/manifest.json` (`source.lighting_correction`, per-icon `lighting`), `PROVENANCE.md`, README/design-system/`docs/governance/EDICT-0012.md`, `raw/sources/2026-10-25-iconexporter-dark-light-bug.md`, wiki; tests `mc_ui_audit.py` + `tracker.acceptance.test.mjs` |
| Submitted by | 工部 (extractor correction), 兵部 (contract checks), 礼部 (docs/wiki) |
| Verifier | 测试部 — independent face-brightness measurement against the client jar, SHA-256 provenance audit, real Chrome via the EDICT-0009 harness (`.tmp/` scripts) |
| Environment | Windows, Node 22.14.0, bundled Python 3.12.14 + Pillow 12.3.0 + numpy, Chrome 155.0.8059.86 headless, Minecraft Java 1.21.4 (NeoForge 21.4.135) + IconExporter 1.3.1, `file://` |
| Entry criteria `G1` | ✓ deliverable frozen at 尚书省 "ARTIFACTS READY"; `app-qa` stamp was already valid and remains so — `src/{app.js,index.html,styles.css}`, `src/tracker/model.js` and `src/assets/icons/icons.js` are byte-identical to the stamped hashes, so the 36-case UI suite was **not** re-run (no source changed, no stamp drift) |

## Findings

| Id | Severity | Finding | Action |
|----|----------|---------|--------|
| `N1` | Note (no action) | Per-icon top-face tail: 3/29 opaque cube textures read above the 0.99 target by more than the ±0.02 tolerance (diamond_block 1.0101, emerald_block 1.0161, sea_lantern 1.0379) and 4/9 special-model tops likewise (crafting_table 1.0487, oak_log 1.0362, furnace 1.0305, spruce_log 1.0216). These are the brightest textures: before correction their export top factor is 0.636–0.663 vs the median 0.6227, so one global sRGB-space gain calibrated on the median over-brightens them slightly. Robust spread is small (MAD ≤0.0023, IQR ≤0.0055, consistent with the documented "spread ≤0.009"); medians match the targets exactly. | No fix requested: ≤5 % deviation on the brightest top faces, invisible at 22 px; the EDICT verification row could state the statistic and the bright-texture tail if desired. |
| `N2` | Note (no action) | A pure brightness gain saturates already-bright pixels: newly clipped pixels are torch 20.0 %, lantern 32.1 % of their opaque area (emissive cores), all 3D blocks ≤0.36 % (median 0.00 %). | Inherent to offline 8-bit compensation; the evidence sheet and browser captures show both props still read correctly. Covered conceptually by the edict's "compensation, not a re-render" limit. |
| `T1` | Note (QA tooling) | The independent measurement harness needed two fixes before use: namespaced model-id resolution for the jar's block models, and face-texture variables (`#up -> #all -> block/x`). No product impact — the final audit is 292/292 checks. | Fixed in `.tmp/qa-0012-verify.py`; documented here for reproducibility. |

No blocking, major or minor artifact defects were found and no source/test changes were requested. No tracked screenshot refresh occurred this cycle (the UI suite was not run). 测试部 wrote only `reports/qa/EDICT-0012-cycle-1.md`, `reports/qa/evidence/edict-0012/**` and `.tmp/` scripts.

## Acceptance traceability

| AC / requirement | Verified by |
|------------------|-------------|
| 3D face brightness restored to the vanilla inventory ratios (0.99 / 0.65 / 0.40 of the block texture, ±0.02) | Independent measurement (not the extractor's masks): face regions rebuilt from each PNG's alpha silhouette, texture reference resolved from the jar's own block models. **Median 0.9901 top / 0.6509 left / 0.4010 right** (Δ +0.0001/+0.0009/+0.0010 vs targets); left 29/29, right 29/29 and top 26/29 within ±0.02; full range 0.981–1.038 (top), 0.645–0.664 (left), 0.398–0.407 (right) |
| The dark bug is real and the "before" numbers are honest | Raw export measured through the same masks/textures: **0.6228 / 0.4745 / 0.4571**, matching the documented 0.6227 / 0.4738 / 0.4569 (Δ ≤0.0007) and the ~⅓ darkening claim |
| Flat 2D sprites untouched | **11/11** item icons byte-identical (SHA-256) to `%APPDATA%\.minecraft\icon-exports-x256\minecraft__<slug>.png`; browser evidence: the iron-ingot slot has 0.0 % changed pixels between the old and new screenshots |
| 3D icons actually corrected | **42/42** (39 block + 3 prop) differ from the raw export; alpha channel identical 42/42 (geometry untouched); per-face corrected/export gain medians **1.5892 / 1.3719 / 0.8763** vs recorded 1.5898 / 1.372 / 0.8755; props' unclipped gain 1.2559 (ladder), 1.2563 (lantern), 1.2574 (torch) vs recorded 1.2565 |
| Manifest correction record is present and honest | `source.lighting_correction` has `applied:true`, a reason naming IconExporter 1.3.1 + PR #41 + "flat 2D sprites unaffected", `method`, targets `{0.99,0.65,0.40}`, measured factors, gains (top/left >1, right <1, props >1), `calibrated_from`; gain math verified (`measured×gain = target` within 0.0004); `source.mode/version/renderer/exported` unchanged |
| Per-icon lighting modes / kinds | 39 `block`→`faces`, 3 `prop`→`uniform`, 11 `item`→`none`; 53 icons, `pixels: 256`; all 53 PNGs are 256×256 with SHA-256 matching the manifest; zero game pixels tracked (`git ls-files`) |
| App rendering unchanged by the fix | The 5 app-qa-stamped files are byte-identical to the stamp; `node scripts/app-qa.mjs status` → verified before and after; browser: 10/10 visible slots + 7/7 avatars load **natural 256×256**, computed `image-rendering: auto`, 22 px slot display, 53/53 picker images 256 px, `body` still `pixelated`, **0 console errors** |
| The icons now look like the vanilla inventory | Submitter sheets (`icons-lighting-before-after.png`, `slot-before-after.png`) plus QA browser captures; old-vs-new app screenshots: 3D block slots +11.0–14.4 % mean brightness (background-diluted crop), flat-sprite slot 0.0 %, whole-screen change confined to 0.17 % (the icons) |
| Provenance/licensing honesty after modifying pixels | `PROVENANCE.md` states the correction and no longer claims byte-identity for 3D renders; Mojang ownership, no-redistribution and `NOT AN OFFICIAL MINECRAFT PRODUCT` retained; raw source sealed (7 sources); zero pixels committed |
| Regression: EDICT-0011 high-resolution contract | `tests/qa/tracker-icon-resolution.acceptance.test.mjs` **7/7**; audit `icons/high-resolution`, `render-mode`, `smooth-rendering`, `textures-pixelated` |
| Gates green | UI audit **72/72** (new `icons/lighting-correction`, `icons/lighting-modes`); acceptance **16/16**; identity acceptance **8/8**; unit **15/15 + 9/9**; `lint` clean (22 pages); `sync` **4/4** completed edicts (EDICT-0012 ledger appended by 尚书省 after this verdict); `app-qa` verified (unchanged) |

## Numbers

- Independent verification: **292/292 checks passed** (`.tmp/qa-0012-verify.py`, exit 0) — 53 PNG dims/hashes, 42 corrected icons, 11 flat sprites, alpha identity, manifest record/math, app-source-vs-stamp hashes, zero tracked pixels
- Face brightness vs jar textures (29 opaque cube_all blocks, full-face mean): **median 0.9901 / 0.6509 / 0.4010**; raw export **0.6228 / 0.4745 / 0.4571**; spread MAD 0.0017/0.0023/0.0015, IQR 0.0055/0.0054/0.0025
- Suites executed this cycle: **127/127** = 24 unit (15+9) + 31 acceptance (16+8+7) + **72/72** audit. Browser UI suite **not re-run by design** — the app sources + `icons.js` are hash-identical to the EDICT-0011 stamp, so its **36/36** cases remain verified (`app-qa: verified — 2026-10-25T07:24:49.034Z`)
- Browser: Chrome 155.0.8059.86, viewport 1280×900, 0 console errors; slots/avatars/picker natural width 256, `image-rendering: auto`, slots 22 px, avatar content 24/28/36 px in 28/32/40 px boxes
- Weight: 53 PNGs 256×256 RGBA (untracked); manifest 16.9 KB (incl. correction record); evidence `reports/qa/evidence/edict-0012/` = submitter's 2 sheets + 6 browser captures + `measurements.json`

## Verdict

```
VERDICT: QA_PASS
cases: total=127 pass=127 fail=0   (24 unit + 31 acceptance + 72 audit; UI 36/36 not re-run — app sources hash-identical to the valid stamp)
independent: 292 checks — face medians 0.9901/0.6509/0.4010 vs targets 0.99/0.65/0.40; raw export 0.6228/0.4745/0.4571 (dark bug reproduced)
pixels: 42/42 3D icons corrected (alpha preserved, gain 1.5892/1.3719/0.8763), 11/11 flat sprites byte-identical, 53/53 PNG 256x256 + sha256, 0 tracked pixels
browser: naturalWidth 256, image-rendering auto, 22px slots, 0 console errors; 3D slots +11-14% vs old screenshots, flat-sprite slot unchanged
gates: lint clean (22 pages) / sync 4-4 / app-qa verified unchanged (36 cases) / raw sealed (7 sources)
defects: blocking=0 major=0 minor=0; notes: N1 bright-top tail (<=+0.048 on 3 emissive/bright cubes, median on target), N2 emissive highlight clipping (torch 20%, lantern 32%), T1 QA tooling fixes
evidence: reports/qa/evidence/edict-0012/
release: S5Q complete -> 尚书省 appends EDICT-0012 ledger entries, completes task-4/task-5 and commits (do not re-run app-qa)
```
