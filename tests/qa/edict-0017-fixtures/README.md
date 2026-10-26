# EDICT-0017 fixtures (測試部 — frozen at S2 audit)

These files are inputs for the EDICT-0017 model/browser cases. They are frozen: an
implementation that does not satisfy the expectation below is a defect in the build, never a
reason to edit the fixture.

| File | Schema | Load path | Frozen expectation |
|---|---|---|---|
| `v1-migration-state.json` | 1 | stored under `mc-build-tracker:v1` (browser) / `M.migrateV1` (unit) | world-a inventory: `stone_bricks = 250` (200 + 50, case-folded), `glass = 96` (96 + 0; `"garbage"` clamps to 0), `iron_ingot = 0`; world-b `stone_bricks = 100`. `collected` absent afterwards; build order preserved; `active` defaults to true; second load is a no-op; `:v1` is never rewritten. The migration notice (`#migrated-from`) shows on the first render after migration and is gone after the first v2 save + reload (the build must drop `migratedFrom` on save). The shipped `M.importJSON` rejects this file (`collected` must be a number), which is why migration must clamp **before** validation. |
| `duplicate-allocation-state.json` | 2 | `injectState` / `M.importJSON` | Stone Bricks: b1 covered 300 / remaining 0, b2 covered 50 / remaining 150, total needed 500, covered 350. Glass (duplicate inside b1): needed 128, covered 100, remaining 28. b3 is inactive and done, so it is excluded from the rollup. No surplus for either slug. |
| `surplus-state.json` | 2 | `injectState` | Stone Bricks needed 97, owned 482 → `[data-mat-surplus]` visible `+385`. Adding a second build that needs ≥386 hides the surplus. |
| `inactive-state.json` | 2 | `injectState` | b2 is inactive, b3 is done (excluded from allocation in every mode). `#inactive-mode=priority` renders b2 dimmed in place; `end` moves it last; `hide` removes it from the list and the totals and it never contributes. Totals come from the contract: with b2 excluded, need 40 / covered 40 / remaining 0; with b2 participating only under `priority`/`end`, need 140 / covered 60 / remaining 80. There is no `all` mode. |
| `invalid-delta-inputs.json` | n/a | case 111 oracle | `abc`, `2s+`, `+1e9`, `--1` are errors that keep the dialog open; `2s+10` with stack 64 = **+138** (2 × 64 + 10). The parser oracle is `M.parseRelative(text, stack)`. |

Notes.

- The v1 fixture deliberately contains a malformed `collected` (`"garbage"`) and a
  case-variant item (`"stone bricks"` next to `"Stone Bricks"`); migration is specified to
  clamp and case-fold, so this file must migrate without throwing.
- v2 fixtures are literal states (browser cases inject them through
  `localStorage['mc-build-tracker:v2']`), not imports, so they do not depend on the import
  dialog.
- No fixture asserts a number the Lead has not measured or the contract has not fixed; the
  arithmetic above is the contract's allocation rule applied to the literal state.
- v2 fixtures carry `inventory` **inside the world object** (`world.inventory`, contract §1
  lines 20–24); a top-level inventory is not a v2 shape and must be refused.
