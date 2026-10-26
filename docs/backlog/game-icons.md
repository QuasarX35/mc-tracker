# Game icons: covering the rest, and staying covered

Status: research note, 2026-10-26. Written after the founder asked how to "implement the rest" of
the in-game item icons, and whether that should keep working for future versions.

The short version: the catalogue is already **1,368 icons at 256 px**, and the gap to a vanilla
1.21.4 client is **12 obtainable-or-hidden items plus variant states we intentionally collapse**.
The work ahead is not "add more icons"; it is "make the extractor registry-driven, and add a gate
that fails the bake when coverage drops". Sources and effort estimates are at the end.

## 1. What exists today

| fact | value | where |
|---|---|---|
| icons in the catalogue | **1,368** | `src/assets/icons/manifest.json` |
| render files consumed | **1,609** (241 collapsed into a parent icon) | manifest `renders`, `collapsed_variants` |
| size / provenance | 256 px PNGs, one per item type | manifest `source` |
| generator | IconExporter **1.3.1** on Minecraft **1.21.4**, flat creative world | `source.renderer` |
| extraction | `scripts/mc-icons.py` → slug, name, stack, `sha256`, `bytes`, `lighting` class | `manifest.icons[]` |
| lighting classes | `block` 407 · `flat` 620 · `3d-other` 341 | manifest `lighting` |
| presentation classes | block 39 · item 620 · prop 3 · model 355 · cube 351 | `manifest.icons[].kind` |
| distribution | **git-ignored**; generated on the owner's machine, never committed | `.gitignore`, `PROVENANCE.md` |
| app fallback | lettered `.icon-tile--empty` / picker fallback letter | `src/app.js` `iconFor`, `slotHtml` |

The pipeline is: game renders (IconExporter) → local export folder → Python extractor → manifest +
`icons.js` + PNGs → app. Each icon records `source` mode, `sha256`, `bytes`, `stack`,
`lighting` (which drives the per-face brightness correction from the EDICT-0012 bug) and a
`kind` used for layout.

## 2. What "the rest" actually is

I compared the manifest against the client jar (`assets/minecraft/models/item/*.json`, 1.21.4:
**1,076** model files; 644 item textures) and against the model-variant conventions:

- Our slug set already covers more than the 1,076 item models because block items carry
  `models/block/*` models, not `models/item/*` — so "1,076 vs 1,368" is not a deficit.
- **Real missing items** (models exist, no icon in the catalogue):
  `barrier`, `light`, `structure_void`, `knowledge_book`, `debug_stick`,
  `command_block_minecart`, `written_book`, `filled_map` — i.e. hidden / non-obtainable items
  that the exporter never sees because it walks the **creative inventory tabs**, plus a couple
  of items whose model chain resolves to variants only.
- **Variant states we deliberately collapse** (241 collapsed renders): `clock_00…63`,
  `compass_00…31`, `recovery_compass_00…31`, `<colour>_bundle_open_{front,back}` (17 colours ×
  2), `bow_pulling_0…2`, `crossbow_pulling_0…2`, `crossbow_arrow/firework`, `shield_blocking`,
  `trident_throwing`, `elytra_broken`, `fishing_rod_cast`, `tooting_goat_horn`, `wolf_armor_dyed`,
  `amethyst_bud`, `template_*`, `*_trim`, `*_brushing_N`, `light_00…15`. These are not items;
  they are the same item drawn in another state, and one icon per item is the right rule for a
  build planner.
- **Future versions** are the real ongoing risk: a new release adds items, renames some, and
  changes model chains, so the catalogue silently drifts out of date.

So "the rest" = **8 hidden items + canonical states for the ~20 stateful items + whatever the
next version adds**. That is a small, bounded problem — provided the extractor stops depending on
the creative inventory.

## 3. Options, with sources

### A. Registry-driven export (recommended primary)

Extend IconExporter (or a tiny companion mod) to iterate the **item registry**
(`BuiltInRegistries.ITEM`) instead of creative tabs, rendering each entry's default stack through
the same `ItemRenderer` used today, and pick a **canonical state** for stateful items (clock at
noon, compass pointing north, bundle closed, shield un-raised). This closes the 8 hidden items
with no external data and keeps the exact visual parity we already have — the app's lighting
correction then applies unchanged.

- Effort: **S–M** (a few hours in the mod; no change to `mc-icons.py` beyond accepting the new
  export names).
- Risk: the mod lives outside this repo and must be rebuilt per game version; export must stay
  deterministic (GUI scale, shaders off — the current 1.3.1 export is reproducible).
- Licence: unchanged; renders are generated locally and git-ignored.

### B. Bake-time coverage gate (recommended, do together with A)

Compare the manifest's slug set against the **item registry** for the declared version and fail
the bake with the delta printed. Good machine-readable sources:

- [Misode/mcmeta](https://github.com/misode/mcmeta) — processed, per-version generated data:
  `summary/registries` (item registry, blocks, item components), `assets*` (textures + models),
  `atlas` (block/item/entity texture atlases), one commit per version with `<version>-<branch>` tags.
- [PrismarineJS/minecraft-assets](https://github.com/PrismarineJS/minecraft-assets) — per-version
  `models/` + `textures/` (1.21.1 through 1.21.8 today) and `legacy_texturepack_mappings.json`;
  the Node wrapper is [rom1504/node-minecraft-assets](https://github.com/rom1504/node-minecraft-assets).
- The client jar we already have is the zero-network oracle: enumerate
  `assets/minecraft/models/item/*.json`, filter templates and variants (§2), diff against slugs.

- Effort: **S** (≈100 lines in `scripts/mc-icons.py` + one unit assertion).
- Risk: registry count ≠ model count (block items/models/block); the gate must compare
  *items*, not files, and must treat the collapsed-variant policy as a declared allow-list.

### C. Jar-only fallback compositor (no game launch)

For flat 2D items, a missing icon can be composed from the jar: `models/item/<id>.json` layers →
`textures/item/*.png`, with tint indices, at 16× and upscaled to 256 with nearest-neighbour.
This is what the extractor already does for the jar-fallback mode (16 px). It does **not** solve
3D block items, which need a renderer (option D) or the game (option A).

- Effort: **S** (extend the existing jar fallback path).
- Risk: flat items only; tint handling for dyed/variant items needs the same allow-list as B.
- Useful for: `written_book`, `filled_map`, and any future flat item when the game is unavailable.

### D. Isometric rasterizer for 3D block items

A pure-software renderer over block model JSON (elements, `faces`, `uv`, `rotation`, cull-face)
with the game's GUI face shading. This is the "no game, no network" endgame: it could regenerate
the whole catalogue from `mcmeta`'s `assets` or the local jar.

- Effort: **M–L** (400–800 lines; UV/rotation/culling edge cases; no entity/special renderer
  items like chests, bells, conduits).
- Risk: visual drift versus the game; the EDICT-0011/0012 brightness work exists precisely
  because naive shading is wrong, so this path needs its own calibration suite.
- Verdict: not worth it while a local client exists; keep as the fallback plan for a web/CI bake.

### E. Third-party icon sets (reference only, never shipped)

The Minecraft Wiki publishes inventory sprites under a stable naming convention
(`Invicon_<id>.png`; see the [InvSprite template](https://fr.minecraft.wiki/w/Mod%C3%A8le:InvSprite))
and there are texture/model mirrors of every version (option B's sources). Two reasons these
stay out of the product:

- **Licence:** game art is Mojang's, and wiki content is CC BY-NC-SA — neither can be
  redistributed inside this repository. Our standing policy
  ([`wiki/synthesis/vanilla-assets-without-redistribution.md`](../wiki/synthesis/vanilla-assets-without-redistribution.md))
  is: assets are generated locally, git-ignored, with provenance recorded. Downloading a wiki
  set would also break that provenance story ("owner's own renders").
- **Maintenance:** a scraped set has no version contract; a new game release silently changes
  sprite names and counts.

Useful only as a **visual diff reference** during development (compare our render vs the wiki
sprite for the same id), never as an input to the bake.

## 4. Recommendation

1. **Now (S–M):** registry-driven IconExporter pass (A) + canonical-state table for clock,
   compass, recovery compass, bundles, bow/crossbow, shield, trident, elytra, fishing rod,
   goat horn, wolf armour, amethyst buds. Result: 100 % of 1.21.4 obtainable items,
   including the 8 hidden ones.
2. **Now (S):** coverage gate (B) in `scripts/mc-icons.py`, with a declared allow-list for
   collapsed variants, an item-count assertion in the manifest, and a hard failure when the
   registry delta is non-empty. This is what stops silent drift on the next version.
3. **Next version (S):** add a version row to the manifest (`source.registry_count`,
   `source.missing[]`, `source.version`) and update the `.tmp` suite that checks manifest
   invariants, so upgrading Minecraft is a checklist, not an archaeology project.
4. **Only if the game stops being available (M–L):** C for flat items, then D for 3D — in that
   order, each behind the coverage gate so a partial catalogue can never ship.

The app side needs no change: `iconFor`/`slotHtml` already fall back to a letter, and the picker
paging/tiles are data-driven (EDICT-0014/0015). Growing the catalogue is a bake-time concern.

## 5. Open questions

- **Do stateful items deserve multiple tiles?** (clock phases, compass bearings). Current rule:
  one canonical tile. If a user can put a clock in a build list, they still need exactly one icon.
- **Bundle variants:** 17 colour states × open/closed; our collapse keeps `bundle` and the 17
  `<colour>_bundle` — is the closed state the right representative? (Yes for a planner.)
- **Mod maintenance:** IconExporter 1.3.1 is ours to patch (the lighting bug was fixed upstream in
  PR #41, unreleased at export time). A registry pass may be better as a separate 200-line
  companion mod than as a fork.
- **Determinism:** the export currently depends on GUI scale and graphics settings; the manifest
  records version + renderer but not those settings. Record them before trusting a re-bake.
- **Non-obtainable items:** do `barrier`/`light`/`structure_void`/`command_block_minecart`/
  `debug_stick`/`knowledge_book` belong in a *build material* picker at all? They are registry
  items, but no survival builder needs them — a "special" filter may be better than shipping them.

## 6. Sources

- [Misode/mcmeta](https://github.com/misode/mcmeta) — per-version generated data, registries,
  assets, atlases; commits tagged `<version>-<branch>`.
- [PrismarineJS/minecraft-assets](https://github.com/PrismarineJS/minecraft-assets) — per-version
  models/textures (1.8.8 … 1.21.8), legacy mapping files.
- [rom1504/node-minecraft-assets](https://github.com/rom1504/node-minecraft-assets) — Node wrapper
  around the above.
- [Minecraft Wiki — InvSprite / sprite naming](https://fr.minecraft.wiki/w/Mod%C3%A8le:InvSprite)
  — `Invicon_<id>.png` convention (reference only; see §3E).
- Local oracles: client jar `assets/minecraft/models/item/*.json` (1,076 in 1.21.4) and
  `textures/item/*.png` (644); `icon-exports-x256/` (1,609 renders) from IconExporter 1.3.1.
