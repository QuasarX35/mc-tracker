# QA Evidence — EDICT-0005 · Cycle 1 · **QA_FAIL**

| Field | Value |
|-------|-------|
| Edict | EDICT-0005 — Minecraft Build Tracker |
| Cycle | 1 of 2 |
| Artifact under test | `src/index.html`, `src/styles.css`, `src/app.js`, `src/tracker/model.js`, `src/assets/**`, `design-system/minecraft-tracker/{MASTER.md,pages/tracker.md}` |
| Submitted by | 兵部 (code, model), 礼部 (design system) |
| Verifier | 测试部 — independent suites, plus visual review of headless-Chrome renders |
| Environment | Windows, Node v22.14.0, Python 3.13 + Pillow, Chrome 141 headless, DSH sandbox (initially confined) |
| Entry criteria `G1` | ✓ artifact set pinned by path, commands recorded |

## Result

`15/15` unit, `16/16` acceptance, `30/30` audit — **and still a failure**, because the
automated suites cannot see what the screen shows. The visual review found two defects the
tests missed, and the tests themselves had a defect.

| Id | Severity | Finding | Evidence |
|----|----------|---------|----------|
| `D1` | **Blocking** | The demo seed silently lost `Stone Bricks` from the Iron Farm. `seedState()` called an immutable `addMaterial()` without assigning the returned state, so the first material was discarded. The shopping list therefore under-counted by 384 bricks — a tracker that quietly loses a material is worse than no tracker. | Screenshot: Iron Farm showed 3 materials; seed code line 425 lacked `state = …`. |
| `D2` | **Blocking** | `--mc-text-muted` `#5a5a5a` on `--mc-panel` `#c6c6c6` measures **4.07:1** — below WCAG AA for the lede, world meta, notes and empty-state copy. Vanilla Minecraft is not an excuse for unreadable secondary text. | Contrast audit on the token pair. |
| `D3` | Major | The glass icon had no dark frame, so on the grey slot it was effectively invisible — users would read an empty slot. | Contact sheet of generated icons. |
| `T1` | Major (test) | Unit tests compared arrays across the `vm` realm boundary; four structural assertions failed for reference identity, not for behaviour. | `deepEqual` failures on `[]` / `builds`. |
| `E1` | Major (environment) | Headless Chrome cannot start inside the sandbox (`platform_channel.cc: Access is denied`); and once escalated, its ~500px minimum window width invalidated a 390px viewport screenshot. Mobile must be verified in an iframe harness. | Chrome stderr; mobile screenshot showed desktop-width layout cut at 390px. |

## Assessment

- `D1` is the important one: every unit test passed while the demo data was wrong, because the
  tests asserted on hand-built states rather than on the seed. The fix therefore ships a
  **regression test** (`AC-16`) that asserts the seed itself.
- `D2` was invisible to the Node suite by construction — contrast is not a DOM-less property.
  The audit now checks the muted pair explicitly.
- No artifact was modified by 测试部 (`Q2`); this report is the only thing it wrote.

## Verdict

```
VERDICT: QA_FAIL
cases: total=61 pass=57 fail=4   (15 unit + 16 acceptance + 30 audit, + 5 visual checks)
defects: blocking=2 major=3 minor=0
open_questions: mobile verification method (E1) — resolved with an iframe harness
```

Returned to 尚书省 → 兵部: seed assignment, muted token, glass icon, cross-realm test
assertions, plus a regression test for each behavioural defect.
