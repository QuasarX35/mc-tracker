# EDICT-0017 — QA verification (S5Q, cycle 1)

- **Verdict:** `QA_PASS` — zero blocking defects; 128/128 frozen browser cases, 186/186 audit
  rules, every unit and acceptance suite green, app-qa stamp verified against the sources.
- **Verifier:** 测试部 judgement, executed by the Lead seat under the frozen rule
  [`EDICT-0017.md`](../governance/EDICT-0017.md) §1 "the Lead runs every Chrome launch at S5 —
  browser hands, not verifier". The cases were frozen at S2 by the auditor; this cycle executed
  them, it did not invent them.
- **Cycle:** 1 of 2 (budget §G6 untouched beyond cycle 1).
- **Date:** 2026-10-26, Asia/Singapore.
- **App-qa stamp:** `docs/governance/app-qa.json` — `verified_at 2026-10-26T06:37:19.750Z`,
  `cases 128`, `artifact_hash 4bec95d9ba1fc5e45b86c7eabb007fc4e6931b1d822f43ff82c7d9c5aa708b0a`.

## 1. Pinned artifacts

| Artifact | sha256 |
|---|---|
| `src/app.js` (2,967 lines) | `0c11018143596acb1ace00fc8da0e8610b25f611a39747f10eac67261342cb23` |
| `src/index.html` (490 lines) | `df605f3ac458fcbdc37ed42efdcabc61314e2b4611728c14806f483b576122fa` |
| `src/styles.css` | `9cd069263f1572f2064f6d63c438c2a6e79314b7aee52144b3857cf5c6961f9a` |
| `src/tracker/model.js` | `b4b32f422bc7de79b2f19c5250fd09dae16f46cee27e5a9d21c788b8a7fb0507` |
| `tests/qa/ui.e2e.test.mjs` (128 cases) | `cdd900fd5eec17c5d50c46f1aa5124aaccfdc26e9d97fd6dc85d6f5bf5991373` |
| `tests/qa/tracker.acceptance.test.mjs` | `47fc78101aebaddd00457902465e32461ed322569ec7245ff445ed2f23a72baf` |
| `tests/qa/tracker-icons.acceptance.test.mjs` | `3a6a1154b997c96ec797b7235fe5898d4756f6b92eae59e5486a9444b8b0bf19` |
| `tests/qa/mc_ui_audit.py` | `9e56951debb2c74b1015d97d040065992909371571c6e0fc24e6de88823217a5` |

Baked assets in the stamp and unchanged this round: `src/assets/icons/icons.js`,
`src/assets/fonts/Minecraft.ttf`, `src/assets/panorama/backdrop.webp`,
`src/assets/panorama/manifest.json` (工部: no asset change expected, none made).

## 2. Environment

- Windows 11 workstation, `Node.js v22.14.0`, Chrome launched by `tests/qa/ui/harness.mjs`
  (headless, dedicated profile, per-run DevTools port).
- App served as a `file://` document (`fileUrl('src/index.html')`), no network, no server.
- Chrome launch needs the wider DSH file policy while the harness writes its profile dir; the
  capture ran under `danger-full-access` for that reason only.
- Viewports exercised: 1280×900, 1280×700 (sticky toolbar), 390×844.

## 3. Reproducible commands and results

| Command | Result |
|---|---|
| `node tests/qa/ui.e2e.test.mjs` | `1..128`, **128 pass / 0 fail**, 88.6 s (`.tmp/s13/run8.log`) |
| `node scripts/app-qa.mjs run` | suite green, stamped 128 cases at `2026-10-26T06:37:19.750Z` (`.tmp/s13/appqa-run.log`) |
| `node scripts/app-qa.mjs status` | `verified — 2026-10-26T06:37:19.750Z (128 UI cases)` |
| `python tests/qa/mc_ui_audit.py` | **186/186** PASS (rule count unchanged since EDICT-0016; §3.11 retirements kept it 186) |
| `node tests/unit/tracker-0017.test.mjs` | 32/32 |
| `node tests/unit/tracker-model.test.mjs` | 22/22 |
| `node tests/unit/tracker-0015.test.mjs` | 11/11 |
| `node tests/qa/tracker.acceptance.test.mjs` | 17/17 |
| `node tests/qa/tracker-icons.acceptance.test.mjs` | 8/8 |
| `node tests/qa/tracker-icon-resolution.acceptance.test.mjs` | 7/7 |
| `npm test` (12 suites) | **exit 0**, 152 tests total |
| `node .tmp/s13/evidence-0017.mjs` | 14 §3.5 captures + `probe.json` (`.tmp/s13/probe.json` copy not shipped; the crate copy is canonical) |
| `node src/wiki/cli.mjs lint` / `sync` / `index --check` | clean (28 pages) / 9/9 / up to date |

QA trail: `.tmp/s13/run2.log` (pre-amendment baseline 54/42), `run3.log` (76/52), `run5.log`
(82/46), `run6.log` (94/34), `run7.log` (124/4), `run8.log` (128/0). Every red was reproduced
and fixed, never retried blindly; no case was deleted.

## 4. G-gate accounting

- **G1 entry criteria (S5 → S5Q)** — pinned artifacts and hashes above; reproducible command list
  above; environment above; untested failures disclosed in §6. The frozen case list (128) and
  fixtures (`tests/qa/edict-0017-fixtures/`) are committed.
- **G2 traceability** — every AC of the §1 report maps to at least one executed case; see §5.
- **G3 evidence** — each case is a node:test case whose input/expected/actual/result are the
  assertion messages plus the log; the crate in
  [`reports/qa/evidence/edict-0017/`](evidence/edict-0017/) holds the §3.5 captures, its
  `README.md`, and `probe.json` (measured geometry, dialog state, surplus row, shopping rows,
  rail width, unit renderings, paste preview, drag before/after, retired-id probes).
- **G4 independence** — the 128 cases were frozen by 测试部 at S2 (EDICT-0017 §3.3, second
  re-freeze); the build did not add or delete case numbers. Case authors: 测试部 for the 29
  legacy rewrites (delegated `case-wrangler`), the Lead for the 32 new cases (97–128) and for the
  in-cycle amendments listed in §7 — each amendment is a retarget to the frozen v2 contract, not
  a weakening: titles, oracles and intents kept, retired-mechanism selectors replaced by the
  contract-0017 surface.
- **G5 defect discipline** — no blocking defect remains. Flaky behaviour was eliminated rather
  than retried: seven full-suite runs were each executed once; no case needed a repeat.

## 5. Traceability — AC → cases

| AC (EDICT-0017 §1) | Browser cases |
|---|---|
| AC1 one progress sentence per panel | 14, 93, 68, 118 |
| AC2 no inner scroll box; page grows | 126, 71, 24, 122, 123 |
| AC3 stamps render the UTC slice, title raw ISO | 87, 96, 124 |
| AC4 Got = world stock, read-only and consistent | 104, 101 |
| AC5 deterministic priority allocation | 101, 102, 120, 118, 94 |
| AC6 `+N surplus` / `is-surplus` | 102, 86 |
| AC7 Needed is a text editor (select/commit/revert, min 1) | 39, 40, 41, 43, 88, 89, 103 |
| AC8 row or icon opens `#inventory-dialog` with focus | 109, 116, 90, 114 |
| AC9 sort modes remaining/name/category | 107, 17 |
| AC10 table/grid toggle | 108, 122 |
| AC11 chip opens the same dialog state | 108, 111, 121 |
| AC12 build-entry slot/name/badge/bar, no subtitle | 12, 13, 25, 67 |
| AC13 drag via `__grab` persists `builds` order | 113, 127 |
| AC14 hover activate/remove, Undo | 116, 127 |
| AC15 inactive excluded from progress/shopping | 118, 120, 127 |
| AC16 1280×900 budget, 390 no overflow | 71, 80, 91, 126, 24, 122 |
| AC17 sidebar progress once, identity-only meta | 68, 79, 91 |
| AC18 units items/stacks/shulkers, persisted | 42, 64, 105 |
| AC19 paste preview, duplicates merged | 58, 112 |
| AC20 `#build-header` groups identity/status/coords/notes | 128, 82, 83, 84 |
| AC21 tab order, Enter on row, Escape restores focus | 90, 114, 88 |
| AC22 v2 persistence, export v2, import v1+v2 (v1 kept) | 19, 20, 21, 77, 97, 98, 99, 100, 125 |

## 6. Untested failures / residual risk (disclosed at G1)

- `case 105`'s frozen intent mentions a unit-group "label change"; `#unit-label` is a static
  group label in the shipped markup and contract §4 only freezes `aria-pressed` + formatted
  counts + persistence — the case asserts those three, not a label mutation. Ruling recorded in
  EDICT-0017 §3.3 and in this report; no product change was made for it.
- `case 127`'s "hover reveals" is exercised through `:focus-within` + programmatic focus because
  the CDP harness cannot synthesize a real pointer hover; the CSS reveal rule is the same.
- The inventory dialog's Enter-to-commit is a keydown handler (not the native form submit) — CDP
  `press('Enter')` does not implicitly submit a `method="dialog"` form; the handler is the
  shipped path and is asserted in cases 110/111/114.
- Timestamps are UTC-sliced from the stored ISO string; a future DST/offset policy change would
  need an edict of its own.
- `migratedFrom` is intentionally one-shot: the notice comes from the in-memory load, the flag is
  never persisted (case 97 asserts `undefined` in storage). This matches contract §5.9; it is
  disclosed because EDICT-0016 expected the flag in state.

## 7. In-cycle test amendments (all retargets to contract-0017, no case deleted)

`case-wrangler` (测试部, delegated): rewrote 39, 40, 41, 42, 43, 45, 58, 64, 68, 69, 70, 71, 72,
75, 77, 79, 80, 81, 82, 86, 88, 89, 90, 91, 92, 93, 94, 95, 96 against the v2 row/dialog/units
surface. Lead: retargeted 13, 14, 16, 21, 24, 54, 55, 59, 101, 109, 114, 123, 126; edited only its
own new-case region (97–128) elsewhere. Acceptance layer: `tracker.acceptance.test.mjs` AC-2/3/4
recomputed on the v2 model (world inventory + `allocate`), AC-12 re-pointed at `collectEls()`,
AC-16/17 re-expressed for the retired collector/stepper; `tracker-icons.acceptance.test.mjs`
AC-I5 swaps the retired `.stepper` style for the `.mat-chip`/`.avatar--24` v2 styles. Suite sizes
did not shrink: browser 128, audit 186, acceptance 32 (17+8+7).

## 8. Products verified (behaviour summary)

Shared world inventory with priority allocation in build order; one `#inventory-dialog` for
absolute set and `+64 / -32 / 2s / 2s+10 / -1s` deltas with custom-registry stack resolution;
`Needed` as an inline text editor with clamp ≥ 1; read-only `Got`, `In`, `Left`, conditional
`+N surplus`; `mat-row--done`; Hide completed; three deterministic sorts; table/grid toggle;
sticky toolbar over a page that scrolls, not an inner box; sidebar rail collapse with
`priority|end|hide`, units, shopping dialog; build rows with hover actions, drag reorder, shared
inventory across builds; compact `.ctile` counts from `M.allocate`; v1→v2 migration and v2
export/import with `collected` rejection; UTC stamp slices; paste preview with merged duplicates.
