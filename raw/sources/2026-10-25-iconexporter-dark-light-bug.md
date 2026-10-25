---
title: IconExporter dark 3D icons — upstream bug record (snapshot)
type: raw-source
captured: 2026-10-25
origin: EDICT-0012 — CyclopsMC/IconExporter PR #41, local face-brightness measurements, scripts/mc-icons.py lighting correction
capture_method: distilled from the upstream pull request text/measurements and measured against the owner's 256×256 export
---

# IconExporter dark 3D icons — upstream bug record

Why exported Minecraft block icons look darker than the inventory, and what the tracker does
about it.

## The defect

`ItemRenderUtil#renderGuiItem` in IconExporter 1.3.1 scales the pose to the requested icon
size with

```java
p_275246_.scale(scale / 16, scale / 16, 1);   // non-uniform: Z stays 1
```

`PoseStack#scale` reacts to a non-uniform scale by scaling the normal matrix by the inverse and
marking normals as untrusted, so every vertex normal's X/Y components are squashed. That
flattens Minecraft's GUI **diffuse** lighting (the 0.4 ambient part survives), which costs 3D
block models most of their directional shading. Flat item sprites face the camera, so they are
unaffected — which is why only block icons look wrong.

The same file's `renderFluid` already scales uniformly `(s, s, s)`, and the newer GUI pipeline
used by the 1.21/1.21.8/1.21.10 branches is not affected by this defect. `master-1.21.4`
(IconExporter 1.3.1, the version installed here) has it.

## Upstream measurements (PR #41)

Measured on the three visible faces of full-cube vanilla blocks, as a fraction of the block
texture's brightness. Vanilla's own inventory renders sit at **0.99 top / 0.65 left / 0.40
right**. The buggy exporter at scaling factor `f = (iconSize / guiScale) / 16`:

| f | top | left | right |
|---|---|---|---|
| 1 | 0.975 | 0.634 | 0.396 |
| 2 | 0.687 | 0.466 | 0.391 |
| 4 | 0.566 | 0.418 | 0.397 |
| vanilla | 0.990 | 0.650 | 0.400 |

At `f = 1` the export matches vanilla; for any larger icon it darkens as the pose scale grows.

## The upstream fix (unreleased at export time)

Commit `8402f0d1` on branch `claude/fix-dark-block-icons` — *"Scale the icon pose uniformly so
block icons keep their shading"* (2026-08-30) — changes the Z scale from `1` to `scale / 16`.
The pose is then identical to vanilla's for any icon size, so icons shade like the inventory
without changing what is visible. The pull request is PR #41; it was **not merged into a
released 1.21.4 build** when the export used here was made (the branch reports itself as mod
version 1.4.1), so a correct re-export needs a development build plus a game session.

## What the tracker does instead

`scripts/mc-icons.py` cannot re-render (that needs the running game), so it restores the
vanilla face brightness on the exported render itself:

- The exporter's projection is identical for every full-cube icon, so the extractor derives the
  three visible-face masks once from the set's silhouette (hexagon → top diamond, left and
  right quads) and applies one gain per face.
- Gains are calibrated against the client jar's own block textures: the median ratio between a
  rendered face and its source texture (measured on the solid full-cube blocks) is the buggy
  factor; `gain = vanilla target / measured factor`. On the owner's 1.21.4 export the measured
  factors were 0.6227 (top), 0.4738 (left), 0.4569 (right), giving gains ×1.5898, ×1.3720 and
  ×0.8755.
- After correction the median face fractions are 0.991 / 0.651 / 0.403 — within 1 % of the
  vanilla ratios. Flat 2D sprites are copied byte-for-byte; the three 3D props
  (torch/ladder/lantern) get the face-area-weighted gain (×1.2565) because their surface
  normals are not the three cube axes.
- The calibration, measured factors, targets and gains are recorded in
  `src/assets/icons/manifest.json` under `source.lighting_correction`, one per icon under
  `lighting` (`faces` / `uniform` / `none`).

## Limits

- This is a **compensation, not a re-render**: it restores the face brightness ratios, not the
  exact per-pixel vanilla render. A re-export with the fixed exporter removes the need for it.
- The correction assumes IconExporter's fixed GUI projection; if the exporter or the block
  icon rendering changes, recalibrate (the script does so automatically from the jar when it
  can, with the 1.21.4/1.3.1 constants as fallback).
- The fixed exporter must still be built/released for 1.21.4: the upstream fix lives on an
  unreleased branch, and PR #41 notes it was verified against PoseStack dumps and in-game
  measurements rather than a built export.

## Sources

- CyclopsMC/IconExporter PR #41 — *Scale the icon pose uniformly so block icons keep their
  shading* (closed; includes the cause analysis, PoseStack dumps and the measurement table).
- Commit `8402f0d1`, branch `claude/fix-dark-block-icons`; code paths
  `loader-common/src/main/java/org/cyclops/iconexporter/client/gui/ItemRenderUtil.java`
  (1.21.4) and the newer-pipeline branches listed in the PR.
- Local measurements: 256×256 export at `%APPDATA%\.minecraft\icon-exports-x256` (2025-05-06,
  IconExporter 1.3.1, Java 1.21.4) against `versions/1.21.4/1.21.4.jar` block textures.
