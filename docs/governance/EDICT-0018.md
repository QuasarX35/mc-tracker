# EDICT-0018 — The 33-item polish round: priority order, compact tiles, dialog preview

- **Issued by:** 皇帝 — 2026-10-26, round 6. The wording in §1 is the sanitised transcription of
  the founder's message (m01730); this round has no raw source of its own, so the EDICT-0013
  sanitisation precedent applies and the wording lives here, in the edict body.
- **Recorded by:** 礼部 · **Executed by:** 兵部 (`src/app.js`, `src/index.html`,
  `src/styles.css`, `src/tracker/model.js` where the priority order is concerned), 礼部
  (design system, README, wiki), 测试部 (the 128-case suite re-verified in place).
- **Browser execution:** the Lead runs every Chrome launch at `S5` — "browser hands, not
  verifier". This round had no independent verifier available; the disclosure is repeated in the
  ledger note rather than hidden.
- **Recorded:** 2026-10-26 (Asia/Singapore) · **Status:** `S5Q QA_VERIFY` — QA_PASS cycle 1
- **S5 outcome:** browser 128/128, audit 186/186, npm test 152/152, app-qa stamped 128 cases;
  evidence crate in [`reports/qa/evidence/edict-0018/`](../../reports/qa/evidence/edict-0018/)
- **Amends:** [EDICT-0017](EDICT-0017.md) — the row cells, the inventory dialog, the compact
  view and the build list are refined but keep contract-0017's ids and meanings; where this edict
  disagrees it wins (the build list order, the got/allocation column titles, the surplus dash,
  the relative "Updated" stamp and the dialog structure).
- **Relates:** [EDICT-0016](EDICT-0016.md) — the Compact view and its `.ccard`/`.ctile` markup
  are reused. [EDICT-0015](EDICT-0015.md) — the hide-done filter, sort control and section-head
  alignment are reused. [EDICT-0014](EDICT-0014.md) — tooltips keep the `#mc-tooltip` surface.

## 1. The report

The founder filed 33 defects and requests after using the EDICT-0017 build. They are grouped
here exactly as reported:

**Drag and priority.** (1) dragging a build must reorder it, show a drop indicator and survive
a reload, with a keyboard equivalent (`Alt+↑/↓`). (5) allocation priority must follow the same
order the list shows.

**Compact view.** (2) compact icons must render (they were blank squares) and edit/delete must
reveal on hover. (3) finished chips must dim, carry the total need above the icon, and sort to
the end.

**View controls.** (4) the Table|Grid toggle must actually swap views. (25) "Hide completed"
must be a real checkbox, and it must work in both views.

**Columns and progress.** (6) the material columns must read `Needed | In world | Allocated |
Left | Surplus`. (7) one progress function must feed the list, the header and the sidebar.
(8) surplus shows only when stock exceeds total need, otherwise a dash. (10) the columns need a
minimum width, right-aligned numbers, a row-click entry point and an icon Update button.
(26) finished rows must dim and carry a check. (24) the Needed cell reads as plain text and
becomes an input on click.

**Layout.** (9) the detail pane must never overflow. (11) the collapsed sidebar must lose its
stray bar and gain an expand button. (12) the world select must span the panel. (13) the shell
must cap around 1600 px, leave no empty regions and stack the sidebar actions. (14) the compact
grid must be responsive and even. (32) the footer must be one line. (31) contrast must pass.

**Build list and header.** (15) the build fill bar must be drawn. (16) a priority badge and a
rank-1 accent. (17) hover reveals Edit / Activate / Delete. (18) names ellipsise (the material
table may wrap). (19) icon buttons need labels/tooltips — including the "II" top-right control.
(20) delete needs a confirm and a less prominent button. (21) coordinates read
`X 120  Y 64  Z -40`. (22) "Updated 5 min ago" with the exact timestamp in a tooltip; no Created.

**Dialog.** (27) icon, item name, the builds using it. (28) a live preview (`200 -> 264`) and a
short placeholder with the rule in the hint. (29) absolute-then-relative semantics.
(30) Enter confirms, Escape cancels.

**Verification.** (23) chips show the item plus stack notation in the tooltip.
(33) Units, Shopping list and the inactive-build modes keep working.

## 2. What changed

- `src/tracker/model.js` untouched except where the list order demanded it; `buildsForList()`
  now returns `world.builds` in registry order, which is also the allocation order, so the drag
  handle and `Alt+↑/↓` are the priority.
- `src/app.js`: `pctOf`, `relativeTime`, `parseCoords`/`formatCoords`/`machineCoords`, the rank
  badge and edit button in `renderBuilds`, compact tiles with `.ctile__need` and done dimming,
  the eight-cell row (needed editor, in-world, allocated, left, always-present surplus dash,
  icon update, menu), the row check icon, the stack tooltip in `chipHtml`, the checkbox
  hide-done, the keyboard reorder and drop indicators, the inventory dialog body (icon, item,
  per-build list, live preview, absolute-then-relative commit, Undo) and the relative
  "Updated" stamp with the exact timestamp in `title`.
- `src/index.html`: the renamed headings, the checkbox hide-done, the icon delete button, the
  widened dialog markup and the merged footer.
- `src/styles.css`: `[hidden]` honoured, the 8-column table, the 1600 px shell, the rail, the
  compact grid, the build-entry two-row layout, contrast and the phone/table ladder.
- `tests/qa/ui.e2e.test.mjs`: 128 cases re-verified against the new DOM (the legacy 00–96 cases
  amended in place, 97–128 kept); `tests/qa/mc_ui_audit.py`: the ordering rule restated for the
  registry order, still 186 rules.

## 3. Verification

- `node tests/qa/ui.e2e.test.mjs` → `1..128`, `# pass 128`, `# fail 0` (`.tmp/s14/run14.log`).
- `python tests/qa/mc_ui_audit.py` → 186/186.
- `npm test` → exit 0, 152 tests across 12 suites.
- `node scripts/app-qa.mjs run` → stamped 128 cases (stamp timestamp recorded in
  `docs/governance/app-qa.json`).
- Evidence: `reports/qa/evidence/edict-0018/` (builds table, compact view, inventory dialog,
  allocation view, surplus row, shopping dialog, collapsed rail, mobile table/grid, probe.json).

## 4. Known limits

- The keyboard reorder cannot be driven through the CDP `press` helper (it carries no modifier
  flag); the suite exercises the drag path and a scripted `KeyboardEvent` with `altKey` is
  documented in the probe log.
- This round ran without an independent verifier; the Lead performed the S5Q pass in place and
  the ledger note records that disclosure.
