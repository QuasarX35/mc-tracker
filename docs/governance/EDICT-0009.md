# EDICT-0009 — Comprehensive UI QA, enforced on every app change

- **Issued by:** 皇帝 — *"make the QA testing ministry test the UI comprehensively … then let it test the app always when there's an update"*
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (browser driver + suite + stamp tooling), 礼部 (governance text + wiki), 测试部 (`S5Q`)
- **Recorded:** 2026-10-25 (Asia/Singapore) · **Status:** `ENACTED` — `S6`
- **Amends:** [EDICT-0005](EDICT-0005.md) (verification depth), [EDICT-0006](EDICT-0006.md) (mechanisation pattern)

## 1. What was asked

Two things, and the second is the harder one:

1. **Test the whole UI** — every flow, control, state, failure path; miss nothing.
2. **Test it automatically whenever the app changes** — not when someone remembers.

## 2. The obstacle, and the answer

The repository takes no npm dependencies and the machine is offline; there is no
Playwright/Puppeteer. Asserting on strings is not UI testing.

**Answer:** drive **real Chrome over the DevTools Protocol** using Node's built-in
`WebSocket`. No packages, no install, and the tests touch the same DOM a player does.
Chrome launches with `stdio: 'ignore'` (the sandbox denies piped child stdio), a throwaway
profile, `--headless=new`, and a debugging port. The harness handles navigation, evaluate,
click, fill, upload, keyboard, viewport override, screenshots and console-error capture.

## 3. Coverage — 27 cases, by area

| Area | Cases |
|------|-------|
| Empty state and guidance (incl. "New Build" without a world) | 2 |
| Sample worlds, dashboard numbers, build detail | 1 |
| Tabs: click, ARIA, roving focus with arrow keys | 1 |
| Worlds: create (validation), edit, delete (cancel + confirm, active repoint) | 3 |
| Builds: create (validation), inline edit + persistence, status buttons, delete | 4 |
| Materials: add (validation + duplicate merge), lettered fallback icon, inline quantities with over-farm clamp, remove + empty state | 4 |
| Shopping list: cross-build sums + "Used by", all four filters + search + no-match | 2 |
| Copy list, export (filename + JSON body), import valid, import refused (bad JSON + foreign schema) | 4 |
| Persistence across reload, deep links | 1 |
| Accessibility: labelled controls, skip link, dialog semantics + ESC, live regions, progressbars, visible focus ring | 2 |
| Responsive: 390 px, no horizontal overflow, collapsed columns | 1 |
| Visual contract: `#c6c6c6`, square corners, pixel font, pixelated 16×16 icons | 1 |
| Hygiene: zero console errors / uncaught exceptions | 1 |

Every case runs against the real app via `file://`, with `localStorage` reset per case and
evidence screenshots written under `reports/qa/evidence/edict-0009/`.

## 4. The "always" half — a stamp

`scripts/app-qa.mjs run`:
1. runs the suite; **if it fails, it writes nothing**;
2. if it passes, writes `docs/governance/app-qa.json` containing a SHA-256 per app source
   file (`src/index.html`, `src/styles.css`, `src/app.js`, `src/tracker/model.js`,
   `src/assets/icons/icons.js`) plus a combined hash, timestamp and case count.

`lint` gained rule **`app-qa-stamp`**: if the app sources exist, their hashes must match the
stamp. Any edit to app code therefore turns `lint` red until the suite is re-run and passes —
and `S5Q` cannot claim a clean pass with a failing lint. `node src/wiki/cli.mjs app-qa`
prints `verified` / `STALE` with the drifted files.

Demonstrated on the live repository before the stamp existed:

```
ERROR [app-qa-stamp] docs/governance/app-qa.json: app sources exist but no UI QA stamp:
      src/index.html, src/styles.css, src/app.js, src/tracker/model.js, src/assets/icons/icons.js
      — run node scripts/app-qa.mjs run                                   (lint exit 1)
# after `node scripts/app-qa.mjs run` (27/27):
lint: clean — 20 pages, 0 errors, 0 warnings
app-qa: verified — 2026-10-25T05:19:34.303Z (27 UI cases)
```

## 5. Review record

**Round 1 — 🚫 Reject.** "Extend the existing checks with a few DOM assertions and eyeball the rest."

| # | Finding | Fix |
|---|---------|-----|
| R3 | "Few assertions + eyeballing" is not comprehensive and cannot be repeated. | Enumerated every flow and failure path as a named case. |
| R2 | One test file with shared mutable state flaked as soon as cases reordered. | Per-case reset to a known state; `waitFor` on conditions instead of sleeps. |
| R7 | Failure paths (invalid input, refused import, cancel-out-of-dialogs) were untested. | Explicit cases for each. |
| R6 | Chrome must not be assumed: if missing or blocked, the suite must say so loudly and must not stamp. | `app-qa run` exits 2 with a message when Chrome is absent; stamp only on real pass. |
| R8 | No enforcement — "always" would be a promise. | Hash stamp + `app-qa-stamp` lint rule. |
| R5 | Tests must never touch the user's real browser data. | Throwaway profile per run; `localStorage.clear()` between cases. |

**Round 2 — ✅ Pass**, conditional on: independent evidence (screenshots), failure-path cases,
no dependence on user data, the stamp written only after a green run, and the gate proven on
the live repo (red before stamping, green after).

## 6. Findings while building the suite (all fixed)

| Id | Severity | Finding |
|----|----------|---------|
| `U1` | Major (test) | `element.click()` via CDP does not move focus, so the keyboard tab case failed — the test had to focus the tab explicitly, exactly as a real click does. |
| `U2` | Major (test) | `appState()` reached for `state`, which lives inside the app's IIFE; the suite now reads the persisted `localStorage` snapshot. |
| `U3` | Minor (test) | A `waitFor` expression embedded `[data-mat-field="collected"]` and broke its own quoting; attribute values are now unquoted in selectors. |
| `U4` | Informational | Over-farming one material moves the *build* percentage, not one row's — the original assertion encoded a wrong mental model and was replaced with a computed expectation. |

## 7. Verification

| Check | Result |
|-------|--------|
| UI suite | **27/27** (real Chrome, zero console errors) |
| Gate unit tests (`tests/unit/app-qa.test.mjs`) | 9/9 |
| Gate acceptance (`tests/qa/app-qa.acceptance.test.mjs`) | 7/7 (drift, missing, corrupt, skipped, live) |
| Existing suites | wiki 10/10 + 13/13, sync 10/10 + 8/8, app 15/15 + 16/16, UI audit 41/41 |
| Live gate | `app-qa: verified — 27 UI cases`; lint clean |
| Evidence | 5 screenshots under `reports/qa/evidence/edict-0009/` |

## 8. Limits

- **Headless Chrome only.** Real-device rendering, touch and OS-level file dialogs are out of
  scope; the suite emulates a 390 px viewport rather than testing a phone.
- **Suite is one process.** 27 cases run sequentially in a single browser; a hang in one case
  fails the file rather than isolating.
- **The stamp trusts the suite, not the reviewer.** A green run stamps automatically. That is
  the point, but it means test *quality* is the thing to review in code review, not the stamp.
- **Chrome is a prerequisite.** No Chrome → `run` exits 2, no stamp, and lint stays red. Fail
  closed, by design.
- **No CI.** The gate runs inside `lint`/`S5Q`; there is no server-side hook.
