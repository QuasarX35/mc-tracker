# EDICT-0016 fixtures (測試部, S2)

Frozen test fixtures for the round-4 edict ("type scale + stepper + timestamps + world sidebar +
compact view"). They are **inputs to the S5 case list**, not product data: they are injected into
`localStorage` or imported through the real model, exactly like the EDICT-0015 fixtures.

Regenerate with `node tests/qa/edict-0016-fixtures/make-fixtures.mjs` (never `node --test`). The
generator derives the backups from `tests/qa/edict-0015-fixtures/v1-backup.json` and verifies every
file through `src/tracker/model.js` (`validate` + `importJSON`) before writing it.

## Files and the expectations they freeze

| File | Shape | Frozen expectation (S5) |
|------|-------|--------------------------|
| `v1-no-timestamps.json` | valid schema-1 backup, 2 worlds / 3 builds, **no `createdAt`/`updatedAt` anywhere** | imports cleanly; the sidebar, build head and picker rows must render `—` for absent dates and **never** invent one; the model must not add fields on import (`SCHEMA` stays 1); after a later real mutation the entity gains `updatedAt` but keeps `createdAt` absent |
| `malformed-timestamps.json` | same backup with `createdAt:'yesterday'`, `updatedAt:12345`, `createdAt:'2026-13-45T99:99:99Z'`, `updatedAt:''` | imports cleanly today (timestamps are optional/unvalidated); the display helper must treat every non-ISO/absent value as `—` (no fabricated or partially parsed date, no crash); the raw value must not be rewritten by `importJSON`; if the edict chooses to *reject* malformed timestamps instead, the case asserts the exact error string and the fixture stays as the negative input |
| `stepper-state.json` | one world / one build; Stone Bricks 384/200 (stack 64), Egg 40/16 (16), Water Bucket 8/1 (1), Glass 96/96 (done); valid ISO timestamps on world/build/custom item | the stepper cases run on this state: plain click ±1, Shift ±64/16/1, Ctrl ±16, Shift wins over Ctrl, wheel changes without scrolling the page, Enter walks needed→needed then got→got, clamp at 1/0, single click selects all; the timestamp format cases read `Created <date> · Updated <date time>` from the same fixture |

## Notes for the S5 cases

- The model is loaded through `node:vm` (the repo is ESM, so `require()` of the classic script
  returns an empty namespace). Arrays returned by the sandbox realm are cross-realm: assert
  `.length` / `.join()` rather than `deepStrictEqual`.
- Stack sizes come from `window.MC_ICON_STACKS` / `M.stackSizeFor`; the fixture's three items are
  the contract's own examples (64 / 16 / 1).
- The malformed fixture is deliberately **accepted** by today's `validate()`; the edict must say
  whether that stays true. If the draft only defines display fallback, the case asserts `—` and the
  audit records that rejection is not required.
