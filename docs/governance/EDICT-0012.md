# EDICT-0012 — Icon brightness: fix the IconExporter dark-lighting bug

- **Issued by:** 皇帝 — *"why is there a darkening filter over the icons/why do the icons look
  dark"*
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 工部 (extractor correction), 兵部 (contract checks), 礼部 (docs/wiki),
  测试部 (`S5Q`, delegated verifier)
- **Recorded:** 2026-10-25 (Asia/Singapore) · **Status:** `ENACTED` — `S6`
- **Amends:** [EDICT-0011](EDICT-0011.md) — the 256 px renders are no longer byte-for-byte
  copies for 3D models; they carry a documented brightness correction

## 1. The report

After EDICT-0011 the item icons looked dark. Nothing in the app filters them: there is no
`filter` or `opacity` on slots/avatars, and flat sprites (diamond, ingots, bucket…) are visibly
correct. The darkening is **baked into the exported PNGs for 3D models only**.

## 2. Root cause (upstream)

IconExporter 1.3.1 scales the icon pose by `(f, f, 1)` before rendering the GUI item. A
non-uniform `PoseStack#scale` makes Minecraft squash the vertex normals, which flattens the GUI
**diffuse** lighting (the 0.4 ambient survives, the directional part is mostly lost). Flat 2D
sprites face the camera and are unaffected; full-cube blocks lose most of their shading and
come out roughly a third darker. This is documented upstream as
[CyclopsMC/IconExporter PR #41](https://github.com/CyclopsMC/IconExporter/pull/41), with the
same measurements used here, and fixed by scaling uniformly. The fix exists only on a
development branch (`claude/fix-dark-block-icons`, commit `8402f0d1`, mod version 1.4.1) — no
1.21.4 release contains it, and the newer 1.21/1.21.8/1.21.10 branches use a different GUI
pipeline and are not affected.

Re-exporting with the fixed exporter needs the game to run, which this repository's tooling
does not do, so the fix is applied offline to the exported renders.

## 3. The correction

- `scripts/mc-icons.py` detects the three visible faces of the isometric cube render from its
  silhouette (hexagon → top diamond + left/right quads; the exporter projection is identical
  for every full-cube icon) and applies **one brightness gain per face**.
- Gains are calibrated per generation against the client jar's block textures: the median
  rendered/texture face ratio is the exporter's current factor, and
  `gain = vanilla target / measured factor`. Vanilla inventory renders sit at **0.99 / 0.65 /
  0.40** of the block texture brightness (upstream measurement). On this machine the measured
  factors were 0.6227 / 0.4738 / 0.4569 → gains ×1.5898 / ×1.3720 / ×0.8755.
- 3D props whose normals are not the cube axes (torch, ladder, lantern) get the face-area
  weighted gain (×1.2565); **flat 2D sprites are copied byte-for-byte**.
- Everything is recorded: `manifest.source.lighting_correction`
  (`reason`, `target_vanilla_face_factors`, `measured_export_face_factors`, `gains`,
  `calibrated_from`) and a per-icon `lighting: faces | uniform | none` field.
  `PROVENANCE.md` explains the compensation and its limits.
- The 16×16 jar fallback compositor now shades cubes with the same vanilla ratios instead of
  the previous 100/80/60 approximation.

## 4. Review record

| Id | Risk | Resolution |
|----|------|------------|
| R1 | "Compensate" could silently fabricate detail. | It only scales brightness to a measured, documented target ratio; the pixels' geometry/UVs stay the exporter's, and the exact gains are in the manifest. |
| R2 | The compensation hides an upstream bug rather than fixing it. | Recorded as such in the raw source, the manifest and the docs; when a fixed IconExporter for 1.21.4 ships, re-export and drop the correction (open question filed). |
| R3 | Flat sprites could be brightened incorrectly. | They are detectable (2D item models) and copied byte-for-byte; the acceptance test checks the manifest's `lighting` modes. |
| R4 | A future export/version could invalidate fixed gains. | Gains are recalibrated from the jar at generation time, with the 1.21.4/1.3.1 constants only as a no-jar fallback. |
| R5 | Licensing/provenance could be obscured by modified pixels. | `PROVENANCE.md` and the manifest state "renders with a documented brightness correction", not "byte-for-byte copies", and keep the no-redistribution policy. |
| R6 | Tests could keep asserting byte-identity with the exporter. | EDICT-0011's acceptance cases do not assert byte-identity; AC-10 and the audit now assert the correction record and the per-icon lighting modes. |
| R7 | App QA stamp could be missed. | `app-qa` hashes only `css/app/index/icons.js`; all of those are byte-identical to EDICT-0011 (verified), so the fresh stamp stays valid — re-checked below. |
| R8 | Wiki upkeep (EDICT-0006). | Raw source for the upstream bug record, entity/concept/open-questions/log updates, index, seal, lint. |

## 5. Verification

| Check | Result |
|-------|--------|
| Corrected face brightness vs vanilla targets (independent measurement: face masks rebuilt from each PNG's alpha silhouette, textures resolved from the jar's block models) | **0.9901 / 0.6509 / 0.4010** vs targets 0.99 / 0.65 / 0.40 (Δ +0.0001 / +0.0009 / +0.0010); the raw export measures 0.6228 / 0.4745 / 0.4571, reproducing the dark bug |
| Face-factor spread | MAD ≤ 0.0023 / IQR ≤ 0.0055 across the opaque cube textures; the brightest top faces overshoot up to +0.048 (≤5 %, invisible at 22 px) — recorded as `N1`, not fixed |
| Flat sprites byte-identical to the raw IconExporter export | 11/11 |
| 3D icons actually corrected | 42/42 (39 cubes + 3 props); alpha channel identical, so only brightness changed |
| Model unit / acceptance / audit | 24/24 / 31/31 / **72/72** |
| Browser suite | 36/36 remains valid: every app-qa-stamped file is hash-identical, so the suite was intentionally not re-run (no stamp drift) |
| `app-qa` stamp | verified, unchanged |
| `lint` / `sync` | clean / all completed edicts ingested |
| QA verdict (测试部, delegated) | **`QA_PASS`, cycle 1** — 292/292 independent checks; 127/127 suites; notes only: `N1` bright-top tail, `N2` emissive highlight clipping (torch 20 %, lantern 32 % of their opaque pixels; 3D blocks ≤0.36 %), `T1` verifier tooling |
| Evidence | `reports/qa/evidence/edict-0012/` — before/after contact sheet, slot close-up and six QA browser captures |

## 6. Limits

- A compensation, not a re-render: face brightness matches vanilla, but per-pixel shading may
  still differ slightly from a correctly rendered icon.
- The offline 8-bit gain clips already-bright pixels: torch 20 % and lantern 32 % of their
  opaque area (emissive cores); 3D blocks ≤0.36 %. Inherent to compensation — a fixed-exporter
  re-export removes both the gain and the clipping.
- The correction is calibrated for IconExporter's fixed GUI projection (1.3.1, this export).
- The upstream fix is still unreleased for 1.21.4; until it ships, every re-export needs the
  correction (and a recalibration if the exporter changes).
- Discovered by looking at the pixels, not by a failing test: EDICT-0011's checks could not
  tell "authentic dark" from "buggy dark" because they had no brightness reference. This edict
  adds the reference (the upstream vanilla ratios) to the audit and acceptance contracts.
