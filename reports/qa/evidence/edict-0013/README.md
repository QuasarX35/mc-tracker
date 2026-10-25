# EDICT-0013 evidence index

Owner: 测试部. This directory holds the `S5Q` evidence for EDICT-0013. Nothing here is
authored by 兵部 or 工部; browser artefacts are captured by the Lead seat (which can launch
Chrome) and judged by 测试部 against the frozen cases in `docs/governance/EDICT-0013.md` §3.3a.

27 files: 22 PNG, `picker-probe.json`, the three probe sheets (`font-probe.txt`,
`blur-probe.txt`, `spinner-probe.txt`) and `README.md`.

## Required artefacts

| File | Produced by | Covers | Note |
|------|-------------|--------|------|
| `picker-probe.json` | Lead, headed Chrome probe | AC9 — `CSS.supports('appearance','base-select')`, Chrome build, computed `::picker(select)` background / border / font | 424 B; carries `base-select:"true"`, `supports:true`, `chrome:"155"`, panel `rgb(111, 111, 111)`, border `2px solid rgb(0, 0, 0)`, Minecraft face, `cssSyntaxPicker:"true"`. It also records `pickerOpenInHeaded:"false"` — the final probe did not hold the popup open; see the AC9 note below. |
| `01-builds-1280x900.png` | Lead | AC2/AC3/AC4/AC5 — builds view with the second build selected, title + pencil, coords copy, notes as text, six steppers per row; the closed `#world-select` is visible in the topbar (the AC9 closed-control screenshot) | 1,280×900 |
| `02-builds-notes-edit.png` | Lead | AC4 — notes editor open with Save/Cancel and the Ctrl+Enter hint | 1,280×900 |
| `03-title-edit.png` | Lead | AC2 — rename editor open (input + ✓/✕, heading hidden) | 1,280×900 |
| `04-materials-1280x900.png` | Lead | shopping list, default "Still needed" filter, totals | 1,280×900 |
| `05-picker-open-1280x900.png` | Lead | AC6/AC7 — one dialog, no tabs, `showing 150 of 1368 — refine your search`, footer "Upload image…", Cancel/Use icon | 1,280×900 |
| `06-add-material-dialog-1280x900.png` | Lead | AC8 — pick-item mode: "Choose an item", no None tile, no upload block, Cancel only (no Use) | 1,280×900 |
| `07-dropdown-open-1280x900.png` | Lead (headed) | headed capture attempt for AC9 | **It does not show a popup, and it does not show the closed control either**: the page is scrolled below the topbar, so the world select is out of frame (it is near-identical to `11` — 112 of 1,152,000 pixels differ, all in the Add-button row). Chrome renders the `select` popup as an OS-level window that `Page.captureScreenshot` cannot capture (Lead's finding, 2026-10-25). AC9's closed-control screenshot is `01`; the popup styling is proven by `picker-probe.json`. |
| `08-builds-390x844.png` | Lead | responsive reflow (case 24) | 390×844 |
| `09-picker-390x844.png` | Lead | responsive picker (4-column grid) | 390×844 |
| `10-backdrop-before.png` | Lead | labelled "before" for AC10 | **Not a pre-change capture**: the left backdrop strip is statistically identical to `11` (mean 29.97 vs 29.94, edge-variance 1,379.9 vs 1,379.8) because it shows the current build. The genuine pre-change capture is `reports/qa/evidence/edict-0012/01-builds-view-corrected.png` (same strip: mean 29.35, edge-variance **1,132.6**), which is the "before" AC10 names. Retained for the pair but carries no contrast on its own. |
| `11-backdrop-after.png` | Lead | AC10 — after capture at 1,280×900 (blur 2.5 bake, CSS 1 px) | shares framing with `10`; the sharper genuine comparison is `10b` |
| `10b-backdrop-generator-preview.png` | 工部 generator | AC10 — the generator's own 8 px → 2.5 px side-by-side | 1,280×650; unambiguous: top blur 8, bottom blur 2.5 (branches, leaves, flowers legible); mtime 17:14, copied in by the Lead |
| `12-font-sample.png` | Lead | AC1 — 200 % masthead zoom so the Minecraft face is legible (lowercase as small capitals) | 1,280×900; distinct capture since the regeneration |

`picker-probe.json` must contain, in tolerant text form (the audit greps it):
`"base-select"`, the Chrome version (e.g. `155`), and either `111, 111, 111` or `#6f6f6f`
for the picker background, `0, 0, 0` or `#000000` for its border, and `Minecraft` in the
font family. A `"supports": false` value fails the audit by design.

## Duplicates and suite captures

SHA-256 of every PNG was re-checked on 2026-10-25 after the final regeneration: **no two files
share a hash** (22 distinct hashes over 22 PNGs). `05-material-steps.png` is a CDP-clipped
capture of the material rows (740×264, 14,963 B, all six stepper buttons per row); `12` is the
200 % masthead zoom; `03-demo-seed.png` is the Worlds view; and `11` shares framing with `10`
only (the before/after pair, whose real contrast comes from the `edict-0012` capture above).

Written by the 49-case suite itself, not part of the required set: `01-empty-state.png`,
`03-demo-seed.png`, `24-mobile-390.png`, `25-visual-contract.png`, `27-icon-fallback-probe.png`,
`05-material-steps.png`, `06-picker-search.png`, `47-themed-select.png`,
`48-backdrop-narrow-blur.png`.

## Analysis outputs (written by 测试部 at judgment)

- `font-probe.txt` — `@font-face` rules, `--font-pixel` stack, TTF/licence hashes and the
  raw-source seal (static proof; the runtime `document.fonts.check` is asserted in case 25).
- `blur-probe.txt` — computed `filter` of `.backdrop::before` at 1280 and 390 widths, the
  panorama manifest, and the Pillow decode of the new `backdrop.webp` vs the archived
  `.tmp/before-edict-0013/backdrop.webp`.
- `spinner-probe.txt` — the CSS-rule proof used instead of the unassertable pseudo-element
  computed check (case 43 records this; Chromium 155 reports `appearance: textfield` for
  `::-webkit-inner-spin-button` even when the rule hides it).
