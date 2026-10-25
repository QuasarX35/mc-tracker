# EDICT-0015 fixtures (frozen by 測試部 at S2)

These files are the inputs the S5 browser/unit cases load. They are **not** app data and no
test may edit them in place. All JSON is UTF-8, two-space indented, newline-terminated.
Regenerate only with `.tmp/s8/qa-fixtures.cjs` (測試部 only, at S2 freeze) — the expected
order files are the oracle, not the generator.

| File | Purpose | Expected |
|------|---------|----------|
| `v1-backup.json` | a shipped-schema (version 1) backup exported from `M.seedState()`; has **no** `customItems` anywhere | imports; all three registries default to `[]` |
| `import-paste.json` | byte-identical copy of `v1-backup.json` for the chooser-free paste path | pasting it into `#import-text` + `#import-restore` restores the same state |
| `route-shuffle.v1.json` | one world, six builds, statuses deliberately shuffled: registry order `Weekend Cottage (planned)`, `Iron Factory (done)`, `Wizard Tower (building)`, `Barn (planned)`, `Nether Road (done)`, `Greenhouse (building)`; every material carries its required `id` | DOM order = `route-shuffle.expected-order.json` |
| `route-shuffle.expected-order.json` | oracle for the file above: `Wizard Tower, Greenhouse, Weekend Cottage, Barn, Iron Factory, Nether Road` | building in registry order, then planned, then done |
| `route-status-change.expected-order.json` | oracle after clicking Done on `Weekend Cottage` | `Wizard Tower, Greenhouse, Barn, Weekend Cottage, Iron Factory, Nether Road`; the selection stays on the same build id |
| `budget-state.json` | injected `localStorage` state for contract §7's height budget (Lead ruling R5/F9): world `Budget SMP`, 4 builds (`building`, `planned`, `planned`, `done`), the building build carries 6 materials (incl. `Egg` stack 16 and `Water Bucket` stack 1) | at 1280×900 `documentElement.scrollHeight ≤ 900`; at 390×844 `≤ 920`; `scrollWidth === clientWidth` at both. `?demo=1` (3 builds / 4 materials) is secondary and does not bind |
| `custom-items.v1.json` | three scopes with deliberate shadowing: build `Deepslate Bricks` (stack 1, catalogue `deepslate_bricks` icon = `deepslate_bricks`) shadows world `Deepslate Bricks` (64, item icon) which shadows account `Deepslate Bricks` (999, null icon); plus build `Pillar Stone` (16, uploaded-image icon, 1×1 PNG data URL) and account `Roof Tile` (64, `deepslate_tiles`) | resolver: `Deepslate Bricks` → build entry (stack 1, custom, scope build); `Pillar Stone` → 16 + image icon; `Roof Tile` → 64 + item icon; `stone` → catalogue (custom false, scope null) |
| `invalid-no-name.json` | `name: "   "` in account registry | whole import rejected with `Custom material needs a name.` |
| `invalid-stack-zero.json` | `stack: 0` | `Stack size must be between 1 and 999.` |
| `invalid-stack-1000.json` | `stack: 1000` | `Stack size must be between 1 and 999.` |
| `invalid-duplicate-name.json` | `Same Thing` + `same thing` in one registry | `Name already used by another material.` |
| `invalid-bad-icon.json` | `icon: { kind: 'image', dataUrl: 'javascript:alert(1)' }` | `Icon must be a catalogue item or an uploaded image.` |
| `invalid-registry-shape.json` | `customItems: { not: 'an array' }` | rejected by `validate`/`importJSON`; the state stays unchanged |

Notes frozen with the fixtures:

- The icon shape written in these files is the **shipped** `{ kind: 'image', dataUrl }` — audit
  finding F1 was accepted and contract §4 is amended to `dataUrl` (amendment record §2.5, F1).
- The model API the unit cases use is the **positional** form (F2 supersedes R3):
  `M.customItem(state, world, build, name)` and
  `M.createCustomItem(state, world, build, target, spec) → { state, entry } | { error }`.
- `Pillar Stone`'s image icon is a 1×1 PNG; the UI upload path re-encodes to 128×128 WebP, but
  the fixture only needs to pass `validateIcon` and render `assets/`-independent pixels.
- Import rejection must be atomic: after each `invalid-*.json` attempt the `localStorage`
  state is byte-identical to the pre-attempt snapshot.
- `route-*` fixtures are schema version 1 and contain no `customItems`; they exist to prove
  ordering, not the custom-item model.
- **Run-1 correction (S5):** `route-shuffle.v1.json` originally omitted `materials[].id`, which
  the model requires, so the app correctly refused the backup and case 67 read the empty state.
  The file now carries ids (`mat-b1-1` …) and acceptance **A11** guards every valid fixture
  through `M.importJSON` (and the ordering fixture through `M.sortBuilds`) so this class of
  authoring error fails in the static gate, not in Chrome.
