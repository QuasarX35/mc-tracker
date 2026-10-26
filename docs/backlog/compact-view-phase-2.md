# Compact Mode — phase 2 (deferred from EDICT-0016)

Status: backlog, not scheduled (candidate EDICT-0017). EDICT-0016 ships **Compact Mode phase 1**
only — view switcher, build cards, material matrix, quick-update dialog and hover Edit/Delete —
computed from each build's own `needed` / `collected`. The founder answered item 14 with "the FRD
as written, including phases and crafting"; the Lead honoured that answer across two edicts rather
than one oversized edict. This file records exactly what is deferred and why.

Sources: `D:\compact view reqs.md` (FRD, 225 lines); `.tmp/s10/brief-0016.md`;
`.tmp/s10/contract-0016.md` §9 (deferred list) and §10 (model additions shipped in phase 1).

## Deferred parts

| Part | FRD reference | What it needs | Why it is not in EDICT-0016 |
|---|---|---|---|
| Global user inventory, shared across builds and worlds | FRD 4.1 `UserInventory`, 4.2 deficit formula | A user-scoped store (`slug -> owned count`) outside `worlds[]`/`builds[]`; the deficit formula (`required − owned`, clamped, with a stated precedence against per-build `collected`); validation, export/import shape, and a UI to edit it | Phase 1 reads only per-build `needed` / `collected` through `M.materialProgress`; the model has no cross-build inventory, so adding the formula today would require a schema addition and a source of truth the backup does not carry |
| Phases with current/target milestones | FRD phases section | Per-build `phases: [{name, targets}]`, a current-phase pointer, per-phase progress derivation, UI on the card and detail, and edit/enter rules | The shipped build has one flat material list and no milestone data; a phase view would have nothing honest to render |
| "Ascend" milestone dialog | FRD Ascend flow | Milestone-completion detection, a confirmation dialog, phase history, and a rule for what happens to gathered amounts on ascend | Depends on phases and the global inventory; phase 1 has no milestone concept to ascend from |
| Sub-tier crafting / smelting engine | FRD crafting section | A recipe table (inputs, outputs, quantities, station), sub-tier items (e.g. ingots to blocks), conversion yield/timing, and storage for crafted intermediates | New data plus a pure model reducer; EDICT-0016 deliberately keeps `SCHEMA = 1` and adds only timestamps |
| Crafting procs / extra yield | FRD procs | A deterministic or seeded RNG policy, proc fractions, expected-yield maths, and a visible "estimate, not a promise" disclosure | Depends on the crafting engine and on an RNG policy the tracker does not have |
| Power / activate toggle | FRD Power switch | A persisted toggle per build or world, a defined effect on what the card computes, accessible state, and export/import | Its meaning depends on phases and crafting; a toggle that changes nothing would be a lie in the UI |

## Sketch only — not a frozen contract

- `state.userInventory: { [slug]: number }` (optional, absent = unknown/zero).
- `build.phases: [{ name, targets: { [materialId or slug]: number } }]`, `build.phaseIndex`.
- A recipe fixture for the smelting/crafting tests; no recipe data in `src/**` until an edict
  freezes its shape and licensing.
- Display precedence would need a founder decision: user inventory vs build `collected` vs
  world-level fallback, and whether ascension resets gathered amounts. Do not guess it here.

## Exit criteria before scheduling

- Its own S0 brief, frozen contract and measured baseline (the phase-1 contract §12 budgets must
  be re-measured, not reused).
- Founder rulings on inventory precedence, phase reset on ascend, and RNG disclosure.
- 測試部's frozen case list; no silent change to any EDICT-0016 surface.
