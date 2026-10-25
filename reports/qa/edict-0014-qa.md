# EDICT-0014 — S5 independent verification (测试部)

**Verdict: QA_PASS, cycle 1.** Browser suite 66/66 (Lead-run seat, disclosed), audit 147/147,
every AC1–AC12 proven; the only reds during S5 were case- and rule-side and are disclosed in
`EDICT-0014.md §3.3b/§3.3c`. Nothing softened.

- Edict: `docs/governance/EDICT-0014.md` (amendment + §3.5 delta re-audit).
- Artifact pinned: git HEAD `9d899ec` + 兵部/工部's uncommitted run-2 build. Stamp
  `docs/governance/app-qa.json`: `verified — 2026-10-25T12:27:45.271Z (66 UI cases)`, hashing
  exactly the eight `APP_SOURCE_FILES`. Chrome 155.0.8059.86, Node v22.14.0, Python 3.12.14 /
  Pillow 12.3.0, Windows, app opened over `file://`.
- Independence (Q1/Q2): cases + static rules authored by 测试部; Chrome runs and captures by the
  Lead seat because this seat cannot launch Chrome (sandbox) — disclosed. No `src/**` or
  `scripts/**` write by 测试部 in this edict.

## Numbers

| Gate | Result |
|------|--------|
| Browser suite `node scripts/app-qa.mjs run` | **66/66**, exit 0 (Lead seat); stamp written |
| Audit `python tests/qa/mc_ui_audit.py` | **147/147**, exit 0 |
| `edict-0014.acceptance.test.mjs` | 14/14 |
| `edict-0013-assets.acceptance.test.mjs` | 11/11 |
| `app-qa.acceptance.test.mjs` | 7/7 |
| `tracker.acceptance.test.mjs` / `tracker-icons` / `tracker-icon-resolution` | 17/17, 8/8, 7/7 |
| `wiki-sync.acceptance` / `wiki.acceptance` | 8/8, 13/13 |
| Units (app-qa 9, tracker-icons 9, tracker-model 22, wiki-core 10, wiki-sync 10, tracker-suggest 38) | 98/98 |
| `node src/wiki/cli.mjs index --check` / `lint` / `app-qa` | up to date / clean 22 pages / verified 66 cases |
| Evidence crate | 20 PNGs, **all hashes distinct**, + `probe.json` + README |

## AC verdicts

| AC | Verdict | Measured evidence |
|----|---------|-------------------|
| AC1 rotating scenery | **PASS** | manifest: `faces:6` with six input sha256s, `sides:4`, `seamless:true`, `loop_seconds:180`, 2560×640, `width===4*height`, `blur_radius:2.0`; CSS: two `.backdrop__layer` copies, `backdrop-translate 180s`, `::before` filter `none`, per-layer `blur(1px) brightness(0.95) saturate(1)`; probe t0/t1/t2 transforms advance `−1277.63 → −1266.61 → −1255.59`; reduced motion both layers `animationName: none`; case 48; shots `11-backdrop-t0/t1/t2`, `12-backdrop-reduced-motion`, generator `panorama-tile-proof.png` |
| AC2 paging to all 1,368 | **PASS** | first batch 121 tiles (120 slugs + None), hint `showing 120 of 1368 — scroll for more`; scrolled to end: last slug `zombified_piglin_spawn_egg`, 1,369 tiles (1,368 + None), hint `showing 1368 of 1368`; query `enchanted` → `showing 2 of 2 for "enchanted"`, search resets the batch; cases 50/51 |
| AC3 full names | **PASS** | probe: 3 name samples at 1280 with heights 30/38/45 and **0 overflowing**; mobile (390) 0 overflowing; case 52; shots `05-names-1280x900`, `05-names-390x844` |
| AC4 tooltip in top layer | **PASS** | `#mc-tooltip` present inside the open picker, rect `(367, 312, 123×30)`, `topmost:true`, `insideViewport:true`, text `Enchanted Book`, hidden after pointer-out; cases 53/54; shot `06-tooltip-in-dialog` |
| AC5 zero states | **PASS** | fresh: `#detail-empty` shown with `#detail-empty-action` "Plan a build"; `#build-empty` with `#btn-first-build` "Plan your first build"; materials view `#world-material-empty` + "Clear filter"; five controls present; case 55; shots `13`/`14`/`15` |
| AC6 resolved stack labels | **PASS** | stone bricks labels `+1 +10 +64 -1 -10 -64` (data-step keeps `+stack`, aria "Add a full stack (64) …"); oak sign `+16`; case 39/64; shot `02-stack-labels-clip` |
| AC7 stack-1 omission | **PASS** | water bucket row: labels `+1 +10 -1 -10`, `count:4`, `stackButtons:0`, `data-stack:1`, no "full stack" aria emitted; probe table 6 rows = 5 six-button + 1 four-button; cases 42/64 |
| AC8 deterministic suggestion | **PASS** | model `{slug: stone_bricks, reason: matched "tower" in the name}`; avatar `data-icon-auto=true` + title; picker `Suggested from "tower"` + `data-icon-suggested`; manual pick never replaced (case 57); unit `tracker-suggest` 38/38 on the 23 frozen fixtures + purity + 2-arg → null; cases 56/57/65; shot `08-suggestion` |
| AC9 bulk paste | **PASS** | 7 review rows: 4 matched with qtys 64/32/1/20 and 3 unknown; commit adds exactly `Stone Bricks=64, Glass=32, Oak Log=1, Oak Planks=20`, one commit; case 58; shot `09-bulk-paste` |
| AC10 undo | **PASS** | toast carries `Undo`; delete leaves 3 of 4 rows and undo restores 4 with a deep-equal snapshot (`rowsAfterDelete:3 → after.count:4`, rows Stone Bricks/Glass/Oak Log/Oak Planks); six-second expiry; build and world deletes also restore (cases 60/61); case 59; shot `10-undo-toast` |
| AC11 recents | **PASS** | unfiltered picker first tiles: None, `red_wool` marked `data-icon-recent`, `stone`; storage `["red_wool"]`, cap 8, not exported; cases 62–63; shot `07-picker-recents` |
| AC12 non-regression + stamp | **PASS** | 66/66 browser with no case deleted (case 49 console check preserved; case 66 is the run check), audit 147 (7 rule-side corrections disclosed §3.3c), stamp verified with 66 cases over the eight app sources, lint clean, index up to date |

## S5 findings (all closed; none app-side)

- **S5-1..S5-7** — rule-side defects in my audit: it asserted static HTML for lazily created nodes
  (`#mc-tooltip`, `#icon-sentinel`, `#toast-action`) and EDICT-0010-era panorama selectors. Corrected
  in `tests/qa/mc_ui_audit.py` (rules now read the app/CSS source tokens and the shipped layering);
  the app was not changed for any of them. Disclosed in §3.3c.
- **S5-8/S5-9** — five run-2 case mis-specifications (48, 50, 52, 55, 59), amended against the
  Lead's verbatim headed-Chrome ground truth; no AC weakened, no case deleted. Disclosed in §3.3b.
- **Evidence notes** — `02-stack-labels-clip` shows the six-label row; the four-button stack-1 row is
  measured in `probe.json` (bucket `count:4`, `stackButtons:0`) rather than captured in the clip;
  `15-empty-world-material` shows the empty-world materials state with "Clear filter". 20/20 PNGs
  have distinct hashes.
- **Record discrepancy** — the Lead's hand-off said "undo restores 6 rows"; `probe.json` measures 4
  (`rowsAfterDelete:3` → restored 4, rows listed above). This report uses `probe.json`.

## Verdict

**QA_PASS, cycle 1.** AC1–AC12 PASS, evidence crate complete, stamp verified, no open blocker.
