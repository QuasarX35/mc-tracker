# EDICT-0011 — High-resolution item icons

- **Issued by:** 皇帝 — *"make all item icons higher resolution"*
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 工部 (icon extractor), 兵部 (rendering contract + app copy), 礼部 (design
  system, README, wiki), 测试部 (`S5Q`, delegated teammate — independent cases and verdict)
- **Recorded:** 2026-10-25 (Asia/Singapore) · **Status:** `ENACTED` — `S6`
- **Amends:** [EDICT-0007](EDICT-0007.md) (icon source and rendering method),
  [EDICT-0010](EDICT-0010.md) (the identity icon set now uses the same renders),
  [EDICT-0009](EDICT-0009.md) (UI audit grows from 65 to 70 cases; the visual-contract case now
  asserts the high-resolution contract)
- **Amended by:** [EDICT-0012](EDICT-0012.md) — 3D renders are no longer byte-for-byte copies;
  they carry a documented brightness correction for an IconExporter 1.3.1 lighting bug

## 1. The change

All **53 item icons** are now the game's own **256×256 inventory renders** instead of the
16×16 textures the EDICT-0007 extractor composited by hand:

- `scripts/mc-icons.py` consumes the owner's local **IconExporter** export at
  `%APPDATA%\.minecraft\icon-exports-x256\minecraft__<slug>.png`, validates every render
  (square, ≥128 px, one resolution), copies it **byte-for-byte** to
  `src/assets/icons/<slug>.png` (still git-ignored) and records the source render, pixel size
  and SHA-256 in `manifest.json`.
- The app displays the renders **smoothly downscaled**: `image-rendering: auto` on
  `.slot img` / `.avatar img` (22 px slots, 28–48 px avatars, picker tiles), while the tiled
  dirt/panorama textures and the rest of the pixel-art chrome keep
  `image-rendering: pixelated`. The old "integer scale only" rule applied to 16×16 textures; it
  is retired for item icons and preserved for tiled textures (design system updated).
- The 16×16 client-jar extraction is kept as a clearly labelled **fallback mode**
  (`manifest.source.mode = jar-fallback`, `pixels: 16`) for a machine with the game but no
  export. The committed manifest records `mode: hires-exports`, `pixels: 256` on this
  repository.
- No model/API change: icon references are still `{kind:'item', slug}`; only the pixels behind
  a slug changed.

## 2. The discovery that shaped it

The high-resolution source was already on the machine and had been overlooked in EDICT-0007.
The `.minecraft` folder contains `icon-exports-x256/` — **1614 PNG renders** written by
**IconExporter 1.3.1** (NeoForge 1.21.4) on 2025-05-06, the minute the NeoForge 21.4.135
(`1.21.4`) profile was last used. They are the game's actual inventory-renderer output at 16×
the GUI pixel, not upscaled textures: correct isometric projection for blocks, real 3D models
for torch/ladder/lantern, and the game's own relative sizing. The exported item set contains
1.21.4-only items (`pale_oak_planks`, `resin_brick`), which pins the version. All 53 curated
slugs exist in the set.

The old 16×16 composites were visibly approximate next to them: skewed cube geometry on logs,
furnaces and crafting tables, and flat sprites standing in for 3D items. Copying the renders
also deletes several failure modes from the compositor (face order, shading, animated-frame
cropping, biome tint for grass) while keeping the provenance/licensing architecture unchanged.

## 3. Review record (the real risks)

| Id | Risk | Resolution |
|----|------|------------|
| R1 | Scope creep: the export set has 1609 items, the product has 53. | The curated 53-item set is unchanged; expanding it stays a separate decision recorded in the wiki open questions. |
| R2 | Unverifiable provenance ("some export on disk"). | Exporter version, export date, game version and per-icon source path are recorded in `manifest.json`; version pinned by 1.21.4-only items and the launcher profile timestamp. |
| R3 | Committing game pixels is redistribution. | PNGs stay git-ignored; only extractor, manifest, `icons.js` and provenance are committed — same policy as EDICT-0007, asserted by acceptance tests. |
| R4 | Smooth downscaling contradicts the "pixel art is nearest-neighbour" contract. | Scoped exception, documented in MASTER: **tiled textures stay pixelated**, item renders are smooth because nearest-scaling a 256 px render into 22 px aliases; both halves are tested. |
| R5 | A machine without the export silently regresses. | The extractor labels `jar-fallback`/`pixels: 16` in the manifest instead of pretending; the high-resolution acceptance suite fails on that mode, so the regression is visible. |
| R6 | Renders are copied but not integrity-checked. | Every render is validated (square, one resolution, ≥128 px) and SHA-256'd into the manifest; acceptance recomputes the hashes. |
| R7 | Repository weight. | 53 PNGs total 491,675 B (~480 KiB) and remain untracked; the committed manifest blob grows by ~180 B (15,939 vs 15,759 B). |
| R8 | Stale icons from a previous run. | The extractor removes PNGs that are no longer in the manifest; acceptance asserts one PNG per slug and no stale files. |
| R9 | Wiki upkeep (EDICT-0006). | Named in the plan: raw snapshot of the render provenance, entity/concept/synthesis/open-questions updates, index, log, raw seal, lint. |
| R10 | App QA freshness (EDICT-0009). | `styles.css`, `index.html`, `app.js` and `icons.js` changed → the UI suite is re-run and `docs/governance/app-qa.json` restamped; 测试部 (a separate teammate) owns the stamp. |

## 4. Verification

| Check | Result |
|-------|--------|
| Model unit (core + identity) | 15/15 + 9/9 |
| Acceptance (core + identity/backdrop + **high-resolution icons**) | 16/16 + 8/8 + **7/7** |
| UI audit (contrast/structure/pixel/identity/icon-resolution) | **70/70** |
| Browser UI suite | 36/36 (visual-contract case now asserts 256 px renders + smooth downscale) |
| Icon set | 53 × 256×256 RGBA PNGs, sha256 per icon, zero game pixels tracked; 53/53 byte-identical to the owner's export |
| Wiki suite + sync + app-qa gate tests | unchanged, green |
| `lint` / `sync` / `app-qa` | clean / all edicts ingested / verified, fresh stamp |
| Evidence | `reports/qa/evidence/edict-0011/` — before/after icon sheet + app screenshots |
| **QA verdict (测试部, delegated teammate)** | **`QA_PASS`, cycle 1** — 161/161 cases (24 unit, 31 acceptance, 36 browser, 70 audit); independent Pillow/SHA-256 audit of 53 renders; no blocking/major defects |

QA findings: `T1` minor QA-tooling (verifier's zoom capture scoped to the hidden view; fixed
in-cycle, re-captured), `E1` minor accepted (a UI-suite run refreshes the tracked
`reports/qa/evidence/edict-0009/*.png` because the harness hardcodes that path — accepted, the
icons legitimately changed those pixels; parameterising the evidence dir is a future fix),
`P1` minor process (shared-task gate; resolved by 尚书省 authority and completing the tasks),
`D1`/`D2` minor documentation imprecisions (display sizes in `PROVENANCE.md`, repository-weight
figures in this record) — both corrected after the verdict; docs-only, the app-qa stamp stays
valid.

## 5. Limits

- The export is a point-in-time artifact of the owner's installation; it is not reproducible
  from the repository, and a game update changes item models until re-exported.
- The high-resolution path needs a third-party mod (IconExporter). Without the export the
  fallback is the 16×16 jar path, labelled in the manifest.
- Icon *coverage* is unchanged: 53 curated materials; chests/doors/fences and unknown names
  still fall back to a letter even though the renderer could now supply them.
- 22 px slots still cap the effective displayed resolution; the gain is fidelity and HiDPI
  sharpness, not a larger layout.
- The 16×16 fallback branch has code and mode-aware test coverage but was not destructively
  exercised this cycle (regenerating it would have replaced the high-resolution working set);
  its wiring was audited statically instead.
