# QA Evidence — EDICT-0009 · Cycle 1 · **QA_PASS**

| Field | Value |
|-------|-------|
| Edict | EDICT-0009 — comprehensive UI QA, enforced on every app change |
| Cycle | 1 of 2 |
| Artifact under test | `tests/qa/ui/harness.mjs`, `tests/qa/ui.e2e.test.mjs`, `scripts/app-qa.mjs`, `docs/governance/app-qa.json`, `src/wiki/lib.mjs` (`app-qa-stamp`), `src/wiki/cli.mjs` (`app-qa`) |
| Submitted by | 兵部 (harness, suite, stamp tooling), 礼部 (gate text) |
| Verifier | 测试部 — but see the independence caveat below |
| Environment | Windows, Node 22.14.0, Chrome 141 headless, `file://`, throwaway profile |
| Entry criteria `G1` | ✓ app sources pinned by hash in the stamp; suite and commands recorded |

## Independence caveat (stated, not hidden)

测试部 authored the suite it now runs. The gate is therefore only as independent as the cases
are derived from the acceptance criteria rather than from the implementation. Mitigations that
were actually applied: assertions target user-visible behaviour and model-derived expectations
(e.g. the XP percentage is recomputed from the DOM inputs, not copied from the app); the app's
internals are reached only through `localStorage` (a public artefact); and the gate's own
tests (9 unit + 7 acceptance) are separate from the UI suite.

## What passed

| Check | Result |
|-------|--------|
| UI flows, 27 cases, zero console errors | 27/27 |
| Evidence screenshots (empty state, sample worlds, shopping list, builds, 390 px) | 5 files |
| Gate unit tests | 9/9 |
| Gate acceptance tests | 7/7 |
| Existing suites unaffected | wiki 10/10 + 13/13, sync 10/10 + 8/8, app 15/15 + 16/16, audit 41/41 |
| Stamp reflects the tested sources | yes — `app-qa: verified` |
| Clean lint requires a fresh stamp | yes (proven: lint failed with no stamp, passed after `app-qa run`) |

## Coverage matrix (behaviour, not lines)

| User task | Verified by |
|-----------|-------------|
| Start from nothing and be guided | `01`, `02` |
| Load the sample and read the dashboard | `03` |
| Navigate sections by mouse and keyboard | `04` |
| Create / rename / delete a world, cancel a delete | `05`, `06`, `07` |
| Create / rename / annotate / delete a build | `08`, `09`, `11` |
| Move a build through Planned → Building → Done | `10` |
| List materials, get validation feedback, merge duplicates | `12` |
| See real icons and an honest fallback | `13` |
| Edit quantities inline; over-farm without negative counts | `14` |
| Remove materials and see the empty state | `15` |
| Read the cross-build shopping list and its attribution | `16` |
| Filter and search the list, see the no-match state | `17` |
| Copy the list, export a backup | `18`, `19` |
| Restore a backup; survive a bad file | `20`, `21` |
| Keep data across reloads; deep-link a view | `22` |
| Use the app with a screen reader / keyboard | `23`, `24` |
| Use it at 390 px without overflow | `25` |
| Recognise it as Minecraft | `26` |
| No runtime errors | `27` |

## The enforcement proof

```
$ node scripts/app-qa.mjs run          # before any stamp existed
app-qa: running the comprehensive UI suite
27/27 → app-qa: PASS — stamped 27 UI cases
$ node src/wiki/cli.mjs lint
lint: clean — 20 pages, 0 errors, 0 warnings

# and with the stamp deliberately absent / stale, lint refuses:
ERROR [app-qa-stamp] app sources exist but no UI QA stamp: … — run node scripts/app-qa.mjs run
```

## Environment findings

1. **Chrome must run unconfined** — its mojo IPC is blocked by the DSH sandbox. The gate treats
   "cannot launch Chrome" as a hard failure (exit 2, no stamp), never as a pass.
2. **Headless window minimum width** (~500 px) is bypassed with `Emulation.setDeviceMetricsOverride`,
   so the 390 px case is a real 390 px layout (the earlier iframe workaround is superseded).
3. **`stdio: 'ignore'`** is required for the Chrome child process in this sandbox.
4. Screenshots are captured from the suite itself, so evidence is regenerated on every run.

## Verdict

```
VERDICT: QA_PASS
cases: total=44 pass=44 fail=0   (27 UI + 9 gate unit + 7 gate acceptance + 1 live status)
defects: blocking=0 major=4 (all in the test harness itself, fixed in cycle 1)
open_questions: headless-only coverage; QA independence is structural, not organisational
```

Released to `S6`.
