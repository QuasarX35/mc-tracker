# QA Evidence — EDICT-0011 · Cycle 1 · **QA_PASS** (no fix cycle required)

| Field | Value |
|-------|-------|
| Edict | EDICT-0011 — High-resolution item icons (256×256 IconExporter inventory renders) |
| Cycle | 1 of 2 (passed on first verification; no code/UI defects found) |
| Artifact under test | `scripts/mc-icons.py`, `src/assets/icons/{manifest.json,icons.js,PROVENANCE.md}`, generated `src/assets/icons/*.png`, `src/styles.css`, `src/index.html`, `src/app.js` (comment), `package.json`, README/design-system/`docs/governance/EDICT-0011.md`, `raw/sources/2026-10-25-minecraft-icon-render-provenance.md`, wiki updates |
| Submitted by | 兵部 (app + rendering contract, tests), 工部 (extractor), 礼部 (docs/wiki) |
| Verifier | 测试部 — independent acceptance suite, real Chrome via the EDICT-0009 CDP harness, Pillow/SHA-256 provenance audit (`.tmp/`) |
| Environment | Windows, Node 22.14.0, bundled Python 3.12.14 + Pillow 12.3.0, Chrome 155.0.8059.86 headless, Minecraft Java 1.21.4 (NeoForge 21.4.135) + IconExporter 1.3.1, `file://` |
| Entry criteria `G1` | ✓ deliverable frozen at 尚书省 "ARTIFACTS READY"; the previous `app-qa` stamp was stale by design (app sources changed) and is re-stamped only at exit, after 36/36 UI |

## Findings

| Id | Severity | Finding | Fix / resolution |
|----|----------|---------|------------------|
| `T1` | Minor (QA tooling) | First evidence capture used the unscoped `.mat-row .slot img`; the *hidden* builds-view copy matched first (0×0 box) and produced a black 80×80 "zoom". This was a verifier-script bug, not a product bug. | Scoped the capture to `#view-materials` and added a fail-loud layout-box assertion in `.tmp/qa-b-shots.mjs`; all evidence re-captured (screenshots show the correct slots). |
| `E1` | Minor (repo hygiene, accepted) | A green UI-suite run rewrites tracked `reports/qa/evidence/edict-0009/*.png` because the harness hardcodes `EVIDENCE = edict-0009`. Four tracked files (02/03/04/05) were refreshed. | Accepted by 尚书省 for this edict (the icons legitimately changed the pixels; do not revert). Future edict: parameterise the evidence directory so a suite run targets the current edict. |
| `D1` | Minor (docs precision) | `PROVENANCE.md` says renders are shown "at 22 px in material slots and 28–48 px in avatars/picker tiles". Measured: picker-grid tiles use the 22 px slot; avatar *image* content is 24/28/36/44 px inside 28/32/40/48 px boxes. | Non-blocking; suggested wording: "22 px slots (incl. picker grid), 28–48 px avatar boxes". |
| `D2` | Minor (docs precision) | EDICT-0011 §3 R7 weight figures: 53 PNGs are 491,675 B (~480 KiB, RGBA) not "~400 KB"; committed `manifest.json` blob grows by **180 B** (15,939 vs 15,759 LF bytes), not "~10 KB". | Non-blocking; suggested correction of the R7 row. No artifact/behaviour impact (point of the row — small committed weight — still holds). |
| `P1` | Minor (process) | Shared task board refused `task-3` claim: `task-1` was still `in_progress`, so the `blocked_by` gate was unmet. Verification proceeded on the 尚书省' explicit authority. | 尚书省 to complete `task-1` and append the EDICT-0011 ledger entries before/with the commit. Not an artifact defect. |

No blocking or major defects were found; no source/test changes were therefore requested. 测试部 wrote only `tests/qa/tracker-icon-resolution.acceptance.test.mjs` (QA-A), this report, `reports/qa/evidence/edict-0011/**`, the `app-qa` stamp and `.tmp/` scripts.

## Acceptance traceability

| AC | Verified by |
|----|-------------|
| `AC-11` icon resolution: 53 × 256×256 game inventory renders, smooth downscale, tiled textures still pixelated, fallback labelled | `AC-R1..R7` 7/7; audit `icons/high-resolution`, `render-mode`, `renderer`, `export-source`, `smooth-rendering`, `textures-pixelated`; UI 26; browser measurements (natural 256×256, computed `auto`, 22 px slots, avatar `auto`); screenshots in `reports/qa/evidence/edict-0011/` |
| `AC-R1` manifest declares the hires pipeline (`mode`, `pixels`, 1.21.4, IconExporter, local `.minecraft` jar + exports) | independent runner + 383-check Pillow/hash audit; `manifest.source.{mode,version,renderer,exported,exports,jar}` inspected |
| `AC-R2` per-icon `{name,slug,kind,image,pixels:256,source,sha256}` | 53/53 icons validated; no duplicate slug/image/source |
| `AC-R3` `icons.js` slugs/names agree with manifest | 53 `MC_ICON_SET` / 53 `MC_ICON_NAMES`, section tab count from browser = 53 |
| `AC-R4` on-disk PNGs: one per slug, no stale, PNG signature, 256×256, sha256 matches | 53 files / 53 declared; Pillow dimensions `{256×256}`; 53/53 hashes recomputed; 53/53 byte-identical to `/minecraft__<slug>.png` in the owner's export |
| `AC-R5` smooth item icons, pixelated tiled textures | CSS rule parser (grouped selectors + `@media` aware) + computed style: slots/avatars/picker `auto`, `body` pixelated, global `img` pixelated |
| `AC-R6` provenance/licensing + `.gitignore` | PROVENANCE names IconExporter, 256, owner's own installation, Mojang, no-redistribution, `NOT AN OFFICIAL MINECRAFT PRODUCT`; git-ignore keeps `src/assets/icons/*.png`; zero tracked icon/panorama pixels |
| `AC-R7` old 16×16 app-side contract retired | slot/avatar rules name no pixelated/crisp-edges rendering; manifest declares no 16 px raster; grep of app docs confirms only labelled-fallback/historical 16 px mentions |
| `AC-10` icons from the local client, git-ignored, graceful fallback (mode-aware) | `tracker.acceptance.test.mjs` 16/16; audit `icons/fallback`; UI 13/35 fallback flows |
| Provenance honesty (`R2`): the export really is the owner's 1.21.4 IconExporter output | independent: `mods/icon export/iconexporter-1.21.4-neoforge-1.3.1-135.jar` installed; 2025-05-04 NeoForge log names the 1.21.4 jar and `Current: 1.3.1`; launcher profile `neoforge-21.4.135` `lastUsed 2025-05-06 13:04:02` vs export mtime `13:05:13`; 1.21.4-only items (`pale_oak_planks`, `resin_brick`, `creaking_spawn_egg`) present; export counts 1,609 item + 5 fluid = 1,614 |
| Fallback mode (`R5`): jar 16×16 path kept and labelled | static audit of `--jar` branch, `mode: jar-fallback`, `pixels: 16`, PROVENANCE/README labelling; not executed destructively against the working icon set (mode-aware acceptance covers either mode) |
| `AC-5`/`AC-I6` no game pixels committed | `git ls-files` for `src/assets/icons/*.png` and `src/assets/panorama/*.{png,webp,jpg}` → 0; tracked asset files are only manifests/provenance/`icons.js` |
| `AC-6` gates green | `npm test` chain (11 files, incl. the new 7-case suite) exit 0; `app-qa` verified; wiki `lint` clean; `sync` 3/3 completed edicts |
| EDICT-0010 regressions (`AC-I1..I8` identity/backdrop) | `tracker-icons.acceptance.test.mjs` 8/8; UI 27–35 |
| Evidence sheet (submitter) | `reports/qa/evidence/edict-0011/icons-before-after.png` — same 53 items before (EDICT-0007 16 px composites) vs after (EDICT-0011 256 px game renders) |

## Numbers

- QA-A independent acceptance: **7/7** (`tests/qa/tracker-icon-resolution.acceptance.test.mjs`)
- Unit: **15/15** model + **9/9** icons = **24/24** · Acceptance: **16/16** + **8/8** + **7/7** = **31/31**
- UI audit: **70/70** · Browser UI: **36/36** (run twice: direct + inside the app-qa gate)
- Declared `npm test` gate chain: **11/11 files, exit 0**
- Gates: `app-qa: verified — 2026-10-25T07:24:49.034Z (36 UI cases)`, artifact hash `2857fe67…`; `lint` clean (22 pages); `sync` 3/3 (EDICT-0011 not yet in the ledger at verification time — 尚书省 appends after the verdict)
- Independent pixels/provenance: **383 checks passed, 0 failures** — 53/53 PNGs `256×256` RGBA, 53/53 sha256 match, 53/53 byte-identical copies of the owner's exports, 0 tracked game pixels
- Browser: 10/10 visible slots and 7/7 avatars load natural **256×256** with computed `image-rendering: auto` at 22 px / 24–36 px display; 53/53 picker tile images 256 px `auto`; `body` computed `pixelated`; **0 console errors**; Chrome 155.0.8059.86
- Weight: 53 PNGs = 491,675 B (~480 KiB, untracked); `manifest.json` working 16,433 B (LF blob 15,939 B)
- Evidence: `reports/qa/evidence/edict-0011/` — 7 screenshots (builds avatars, materials view, 2 slot zooms ×8, icon-picker grid, picker-tile zoom ×8, avatar zoom ×8), `measurements.json`, plus the submitter's before/after sheet

## Verdict

```
VERDICT: QA_PASS
cases: total=161 pass=161 fail=0   (24 unit + 31 acceptance + 36 UI + 70 audit)
independent: 383 pixel/provenance checks; 53/53 PNG 256x256 + sha256; 53/53 export byte-identity; 0 tracked game pixels
browser: 256x256 natural, image-rendering auto, 22px slots, 0 console errors (Chrome 155)
gates: app-qa verified (36 cases, fresh stamp) / lint clean (22 pages) / sync 3-3 / npm test chain 11 files green
defects: blocking=0 major=0 minor=2 (documentation figures D1,D2; no code/UI defect)
notes: T1 QA-tooling (fixed in .tmp), E1 EDICT-0009 evidence refresh (accepted), P1 board claim gate (Lead authority)
evidence: reports/qa/evidence/edict-0011/
release: S5Q complete -> 尚书省 appends EDICT-0011 ledger entries and commits (task-1 completion + S6)
```
