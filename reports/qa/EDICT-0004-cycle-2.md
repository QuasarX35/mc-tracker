# QA Evidence — EDICT-0004 · Cycle 2 · **QA_PASS**

| Field | Value |
|-------|-------|
| Edict | EDICT-0004 — apply the `ui-ux-pro-max` skill to this workspace |
| Cycle | 2 of 2 (budget exhausted; a further failure would escalate to `X1`) |
| Artifact under test | `src/index.html` · `src/styles.css` · `src/dashboard.js` · `design-system/minecraft-tracker/MASTER.md` · `design-system/minecraft-tracker/pages/dashboard.md` — **pinned by path**, hashes re-taken after the fixes |
| Submitted by | 兵部 (fixes `D1`–`D6`), 礼部 (design docs) |
| Verifier | 测试部 — independent of submitter (`Q1` ✓) |
| Environment | Windows, PowerShell 7.6.7, Python 3.13.3, Chrome 141 headless (`--headless=new`), workspace `D:\minecraft-tracker` |
| Entry criteria `G1` | ✓ artifact set pinned; three reproducible commands below |

## Defect closure

| Id | Status | Verification |
|----|--------|--------------|
| `D1` | Fixed | `html/icon-aria`: 18 icons, **0** unlabelled |
| `D2` | Fixed | `css/token-discipline`: **0** raw hex outside `:root` (derived-token block added, all 9 literals promoted) |
| `D3` | Fixed | viewBox now tracks the rendered column: measured `viewBox="0 0 787 280"` for a 787 px card, so 1 unit = 1 CSS px; x labels thinned 14→4 at narrow widths. Re-rendered at 375 px, labels legible |
| `D4` | Fixed | Right gutter widened to 88 units and labels offset above/below the point; 1440 px render shows "94" × "100" separated |
| `D5` | Fixed | Copy reads "brighter is busier" |
| `D6` | Fixed | Offline/error path added: `role="alert"` banner, `offline`/`online` listeners, retry action; probe shows `alert_after_offline=true` → `alert_after_online=true` |

## AC traceability (`G2`)

| AC | Case | Result | Evidence |
|----|------|--------|----------|
| AC-1 contrast 4.5:1 text / 3:1 boundaries | `contrast/*` (22 pairs) | Pass | min text **5.69:1** (muted-fg on muted); fg on card **13.38:1**; min non-text **3.90:1** (border-strong on card); focus ring **6.06:1** on card / **6.93:1** on page |
| AC-2 no colour-only encoding | `contrast/secondary`, status chips, chart rules | Pass | status chips carry text + distinct glyph; series differ by solid/dashed **and** direct labels; heat map has a numeric legend and a data table |
| AC-3 keyboard path | `css/focus-visible`, `html/skip-link`, `html/aria-sort`, probe `focused_element` | Pass | 3 px ring with 2 px offset on `:focus-visible`; skip link; sortable `th` are buttons with `aria-sort`; programmatic focus lands on a chip |
| AC-4 no horizontal scroll, 375 → 1440 | probe `doc_scroll_vs_client`; renders | Pass | `scrollWidth/clientWidth = 869/869`; rendered at **375, 768, 1440** |
| AC-5 reduced motion | probe under `--force-prefers-reduced-motion` | Pass | `prefers_reduced_motion=true`, `.live__dot` computed `animation-duration = 1e-06s` |
| AC-6 loading / empty / error | probe `skeleton_rows`, `empty_visible`, `alert_after_offline` | Pass | 36 skeleton cells; empty state on 0 matches; offline banner toggles both ways |

## Measured evidence

**1. Static harness** — `python tests/qa/contrast_audit.py` → `cases: total=66 pass=66 fail=0`
(exit 0). Covers 22 contrast pairs, 25 HTML invariants, 12 CSS rules, 7 JS rules.

**2. Runtime probe** — `chrome --headless=new --dump-dom` over a copy of the artifact with an
appended probe script (`--force-prefers-reduced-motion`):

```
initial_rows=12            svg_polylines=2      heap_rects=168 (=7×24)
trend_table_rows=14        heat_table_rows=24   trend_viewbox=0 0 787 280
doc_scroll_vs_client=869/869
online_rows=6              live_after_filter=Showing 6 of 12 online players.
search_rows=0              empty_visible=true    restored_rows=12
aria_sort_after_toggle=ascending
first_row_after_sort=QuartzQuinn (lowest playtime, correct ascending order)
skeleton_rows=36
alert_hidden_initially=true   alert_after_offline=true   alert_after_online=true
prefers_reduced_motion=true   live_dot_animation_duration=1e-06s
focused_element=true
```

22 observations, 22 as expected.

**3. Visual review** — rendered at `1440×1900`, `768×1500`, `375×1750`, inspected as images.
Images pinned as evidence: `reports/qa/evidence/edict-0004/desktop-1440.png`,
`tablet-768.png`, `mobile-375.png`.
Environment caveat, disclosed rather than hidden: headless Chrome on Windows clamps the
window to **500 px** minimum (`innerWidth=500` measured with `--window-size=375,1600`), so the
375 px pass was performed by rendering the page in a 375 px iframe and capturing that. The
first "375 px" screenshot was a cropped 500 px layout, which is exactly how the clamp was
discovered — the apparent overflow was an artefact, and it was checked rather than reported
as a defect.

## Limitation stated, not waived

`AC-3`'s full Tab traversal (every stop, in order) was **not** automated; the ring, the skip
link, and focusability were verified structurally and programmatically. A real keyboard walk
is still owed before this page is called production-ready.

## Verdict

```
VERDICT: QA_PASS
cases: total=88 pass=88 fail=0 skipped=0
defects: blocking=0 major=0 minor=0
open_questions: full Tab traversal owed; light theme not delivered (MASTER marks light conditional);
                stack choice is a disclosed substitution (see report) — 皇帝 decision
```
