# QA Evidence — EDICT-0010 · Cycle 1 · **QA_PASS** (after fixes in-cycle)

| Field | Value |
|-------|-------|
| Edict | EDICT-0010 — identity avatars + menu panorama backdrop |
| Cycle | 1 of 2 |
| Artifact under test | `src/tracker/model.js`, `src/app.js`, `src/index.html`, `src/styles.css`, `scripts/mc-backdrop.py`, `src/assets/panorama/{manifest.json,PROVENANCE.md}`, tests |
| Submitted by | 兵部 (model/UI), 工部 (extractor), 礼部 (docs) |
| Verifier | 测试部 — real Chrome via the EDICT-0009 harness |
| Environment | Windows, Node 22.14.0, Chrome 141 headless, Minecraft Java 1.21.4 client, `file://` |
| Entry criteria `G1` | ✓ app sources pinned by the fresh `app-qa` stamp (36 cases) |

## Findings (all resolved before the pass)

| Id | Severity | Finding | Fix |
|----|----------|---------|-----|
| `B1` | **Blocking (visual)** | First backdrop used `background-size: 130% auto`, leaving black letterbox bands above/below on tall viewports — it read as a broken image, not a menu. | `background-size: cover` + a narrower pan range (30 %→70 %), lighter scrim (0.12) and vignette; re-reviewed on screenshots. |
| `D1` | Major (UX) | With focus in `<input type="search">`, **Escape clears the field instead of closing** the picker — a keyboard trap. | `keydown` handler: first Escape clears the query, second closes; focus returns to the trigger. |
| `B2` | Major (environment) | Headless Chrome reports `prefers-reduced-motion: reduce` **by default**, so the pan looked permanently off. | Test emulates `no-preference` to assert the pan, then `reduce` to assert it stops. |
| `T1` | Major (test) | Post-reload assertion assumed the selected build survives a reload; the app intentionally resets selection to the first build. | Test selects the new build after reload, like a user would. |
| `T2` | Major (test) | `poll(async () => page().count(...) >= 2)` compared an **unawaited Promise** to a number — always false. | `await` the count inside the poll. |
| `T3` | Minor (test) | "All filtered names contain *stone*" failed on the always-present "None" tile. | Filter assertion to tiles with `data-icon-slug`. |
| `T4` | Major (harness) | `upload()` silently accepted a **relative** path: CDP attached nothing, no change event, no error. | Harness resolves to an absolute path and throws if the file is missing. |
| `A1` | Minor (test) | A11y/audit counts assumed exactly one tablist; the picker adds a second. | Count section tabs and picker tabs separately. |

## Acceptance traceability

| AC | Verified by |
|----|-------------|
| `AC-9` identity: item icon or uploaded image everywhere; clear → letter | UI 27, 28, 29, 35; unit 9; acceptance `AC-I*` |
| `AC-9` uploads 128×128 inline, survive reload | UI 30; model cap + MIME unit cases |
| `AC-9` invalid icons refused without corrupting state | unit cases; UI 31 |
| `AC-10` panorama blurred/panned behind scrim | UI 33; screenshot review |
| `AC-10` absent/blocked backdrop falls back to dirt cleanly | UI 34 (network-blocked reload) |
| `AC-10` reduced motion stops the pan | UI 33 (emulated media) |
| `AC-5`/`AC-I6` no game pixels committed | acceptance `AC-I6`; `git ls-files` shows zero panorama/icon PNGs |
| `AC-6` gates green | 36/36 UI, 65/65 audit, 9+8 new unit/acceptance, lint/sync/app-qa |

## Numbers

- Model unit **15/15** (+ **9/9** icon suite) · acceptance **16/16** (+ **8/8** identity/backdrop)
- Browser UI **36/36** (27 prior + 9 new) · UI audit **65/65** (41 prior + 24 identity/backdrop)
- Wiki/sync/gate suites unchanged and green · `lint` clean · `sync` all edicts · `app-qa` verified

## Verdict

```
VERDICT: QA_PASS
cases: total=149 pass=149 fail=0   (24 unit + 24 acceptance + 36 UI + 65 audit)
defects: blocking=1 major=6 minor=2 (all fixed in-cycle, each with a regression test)
open_questions: physical-device/mobile feel, panorama pan speed taste, backup size with many uploads
```

Released to `S6`.
