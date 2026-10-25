# Minecraft Build Tracker

Plan your builds, list the blocks they need, and tick off the grind — across every world you
play. Styled after Minecraft's in-game GUI: GUI-grey panels, 2px bevels, square corners, the
game's own Minecraft bitmap face with a bundled fallback, item slots and XP-style progress bars.

**Open it:** double-click `src/index.html`. No build step, no server, no install, works
offline from `file://`. Data is saved in your browser (`localStorage`); use **Export** to keep
a backup and **Import** to restore it.

## What it does

- **Worlds** — one tracker per world, with edition + version and an **identity icon**: pick any
  Minecraft item from your extracted set or upload a picture. Select the active world in the top
  bar; edit or delete from the Worlds tab.
- **Builds** — plan a build with status (Planned / Building / Done), coordinates, notes and its
  own icon/avatar, visible in the list and the detail header. Rename with the pencil beside the
  title, copy coordinates from the field, and view/edit notes in place.
- **Materials** — choose each block from the full item catalog, give it `needed` / `got`, and use
  the `+1 / +10 / +stack` and `-1 / -10 / -stack` steppers; the build's XP bar fills as you
  gather.
- **Shopping list** — every item summed across all builds in the world, sorted so outstanding
  items come first, filterable, copyable as text (`Stone Bricks x640 (440 left)`).
- **Sample data** — `src/index.html?demo=1` seeds two example worlds if storage is empty.
  Deep links: `?tab=builds|materials|worlds`.


## Icons (run once)

The repository ships **no Minecraft artwork** — Mojang's assets are not redistributable. Icons
are generated locally from your own installed Java Edition client. Two local sources are
supported; the high-resolution one is preferred:

1. **Inventory renders (high resolution).** Export the items once with **IconExporter**
   (CyclopsMC) from your own 1.21.4 profile; it writes a 256×256 PNG render of every item to
   `%APPDATA%\.minecraft\icon-exports-x256\`. That is the game's exact inventory appearance at
   16× the GUI pixel.
2. **Client jar (fallback, lower resolution).** Without the export, the script extracts the
   jar's 16×16 block/item textures and composites cube blocks isometrically, so a machine with
   only the game still gets icons.

```powershell
<python with Pillow> scripts/mc-icons.py                   # auto: export if present, else jar
<python with Pillow> scripts/mc-icons.py --exports <path>  # explicit IconExporter export folder
<python with Pillow> scripts/mc-icons.py --jar             # force the 16×16 fallback
```

That writes `src/assets/icons/*.png` (git-ignored), plus the committed artefacts
`manifest.json` (source mode, render provenance, SHA-256 per icon), `icons.js` (slugs/names for
`file://` loading; names are an object keyed by slug) and `PROVENANCE.md` (licensing). The app
shows the 256 px renders smoothly downscaled (`image-rendering: auto`) at 22 px in material slots
and 28–48 px in avatars, while the tiled dirt/panorama textures stay pixelated and
integer-scaled. **Without this step the app still works** — every slot falls back to a letter.

The catalog covers the whole export at base-item granularity: **1,368 addressable items** from
1,609 item renders (1,363 plain + 246 component variants; the 246 variants collapse to 5
representatives, 241 `collapsed_variants`), curated common items first. Stack sizes are curated
product data (default 64; 16 for eggs, snowballs, ender pearls, honey bottles, armour stands,
empty buckets, signs and banners; 1 for filled buckets, tools, armour, elytra, potions, boats,
minecarts, shulker boxes, beds, cakes/stews, books, maps, banner patterns and discs). The
EDICT-0012 lighting classification (`block` / `flat` / `3d-other`, 407 / 620 / 341) is preserved,
and five flat sprites that cannot be re-lit are copied byte-for-byte and disclosed.

IconExporter 1.3.1 renders **3D (block-model) icons about a third too dark** — a non-uniform
pose scale flattens Minecraft's GUI diffuse lighting (fixed upstream in IconExporter PR #41,
unreleased for 1.21.4 at export time). The extractor therefore restores the vanilla inventory
face brightness on the exported render (top/left/right = 0.99/0.65/0.40 of the block texture)
and records the exact gains in `manifest.json`; flat 2D item sprites are unaffected and copied
unchanged.

Licensing: personal, non-commercial use of assets from your own purchase; not affiliated with
Mojang or Microsoft; do not publish a clone containing the generated PNGs.

**Font.** The interface face is **Minecraft** (Craftron Gaming, via DaFont, "100% Free"),
bundled at `src/assets/fonts/Minecraft.ttf` with its licence in
`src/assets/fonts/Minecraft-LICENCE.md` and the sealed evidence in
[`raw/sources/2026-10-25-minecraft-font-licence.md`](raw/sources/2026-10-25-minecraft-font-licence.md).
It maps 107 codepoints (ASCII complete, euro U+20AC, a few Latin-1 punctuation); **Pixelify Sans**
(SIL OFL) stays bundled as the fallback for the glyphs it lacks — arrows, dashes, ellipsis, `×`,
`·`, `≥`, `≤`. No CDN.

## Backdrop (run once)

The tiled dirt background is the fallback. For the in-game title-screen look, extract the
**real Minecraft menu panorama** from your own installation and bake it into a blurred strip:

```powershell
<python with Pillow> scripts/mc-backdrop.py
# alt: use your own screenshots instead of the client panorama
<python with Pillow> scripts/mc-backdrop.py --source screenshots --count 4
```

It writes `src/assets/panorama/backdrop.webp` (git-ignored), plus the committed
`manifest.json` and `PROVENANCE.md`. The current strip is 2,560×640, baked at Gaussian radius
**2.5** (`--blur`, 0–3 guard), brightness 0.95 / saturation 0.92, 45,664 B; the app displays it
with CSS `blur(1px)` (1.5 px at ≤640 px) behind a **0.2** scrim and a 120 s pan. It
feature-detects the file: if it exists the scene shows; if not, the dirt texture stays and
nothing errors. `prefers-reduced-motion` disables the pan.

> Modern clients ship **1×1 placeholder** panorama files in the version jar; the real
> 1024×1024 faces live in the content-addressed asset store reached through
> `assets/indexes/<id>.json`. The extractor resolves that index and refuses anything smaller
> than 512 px, so you get the genuine scene or a clear error.

Licensing is the same as the icons: personal use of assets from your own purchase, never
redistributed. Do not publish a clone containing `backdrop.webp`.

## Layout

| Path | What it is |
|------|------------|
| `src/index.html` | The app shell (tabs, panel, dialogs) |
| `src/styles.css` | Minecraft GUI design system — tokens first, no rounded corners |
| `src/app.js` | Rendering and event binding; all state goes through the model |
| `src/tracker/model.js` | Pure domain model: worlds → builds → materials, aggregation, validation, storage |
| `src/assets/` | 9 tiling textures, favicon, `Minecraft.ttf` + Pixelify Sans (OFL) fallback; **item icons are generated locally, not committed** |
| `src/assets/panorama/` | menu backdrop generated by `scripts/mc-backdrop.py` (git-ignored) + committed `manifest.json` / `PROVENANCE.md` |
| `scripts/mc-icons.py` | builds the 1,368-item catalog: 256×256 IconExporter renders when present, else the 16×16 jar textures |
| `scripts/mc-backdrop.py` | resolves the client asset index, composites/blurs the panorama, refuses 1×1 placeholders |
| `scripts/gen-assets.py` | Deterministic generator for every pixel asset |
| `design-system/minecraft-tracker/` | `MASTER.md` (v2 in-game GUI) + `pages/tracker.md` (page rules & ACs) |
| `tests/unit/`, `tests/qa/` | Model unit tests, independent acceptance tests, UI audit |
| `legacy/superseded-dashboard/` | The retired EDICT-0004 dashboard (neon/violet design), archived |
| `wiki/`, `AGENTS.md`, `docs/governance/` | The other resident of this repo: an LLM Wiki and the 三省六部 governance record |

**Standing rule (EDICT-0006):** every change also updates the wiki — pages, index, log, raw
seal, lint — before it is reported. See [`AGENTS.md`](AGENTS.md) §6.5.

## Checks

```bash
node --check src/app.js && node --check src/tracker/model.js
node tests/unit/tracker-model.test.mjs                # 22 model cases
node tests/unit/tracker-icons.test.mjs                # 9 identity cases
node tests/qa/tracker.acceptance.test.mjs             # 17 acceptance + static contract cases
node tests/qa/tracker-icons.acceptance.test.mjs       # 8 identity/backdrop acceptance cases
node tests/qa/tracker-icon-resolution.acceptance.test.mjs  # 7 high-resolution icon cases
node tests/qa/edict-0013-assets.acceptance.test.mjs   # 11 catalog/font/dropdown/stack/backdrop cases
python tests/qa/mc_ui_audit.py                        # 138 contrast/structure/pixel/identity/interaction cases
# wiki + governance (the wiki is a required output of every edict)
node src/wiki/cli.mjs lint                      # incl. the edict-sync rule
node src/wiki/cli.mjs sync                      # which completed edicts have been ingested
node src/wiki/cli.mjs index --check             # catalogue freshness

# UI acceptance (real Chrome, driven over the DevTools Protocol — no packages)
node tests/qa/ui.e2e.test.mjs                   # 49 user-flow cases (identity + interaction + backdrop)
node scripts/app-qa.mjs run                     # run them AND stamp the app sources
node scripts/app-qa.mjs status                  # verified / STALE

```

Current status: **60/60** unit cases (model, identity, app-qa, wiki), **71/71** acceptance
cases, **138/138** UI-audit cases, **49/49** browser flows — screenshots verified at 1280 px and
390 px.

## Scope and honesty

- Local-only: no accounts, no sync, no server. One browser = one dataset.
- Icons are **Minecraft's own item renders** (1,368 base items): 256×256 inventory renders
  exported from your installed game with IconExporter, or the 16×16 client-jar textures as a
  lower-resolution fallback — generated locally, never committed. 3D icons carry a documented
  brightness correction for an IconExporter 1.3.1 lighting bug (flat sprites are untouched).
  The export's 246 potion/painting/etc. component renders collapse to 5 base representatives, so
  a specific variant cannot be picked; items the export lacks (including anything added later)
  get a lettered slot rather than a wrong icon.
- The interface face is the Minecraft bitmap font (Craftron Gaming, DaFont "100% Free") with
  Pixelify Sans as the fallback for the glyphs it lacks; licence and sealed raw evidence ship
  with it. Dropdowns are themed only where Chromium supports `appearance: base-select`; other
  browsers keep the native OS popup.
- Entity avatars are either a Minecraft item or an uploaded picture. Uploads are centre-cropped
  to 128×128, encoded as WebP/PNG data URLs inside the saved state, and therefore travel with
  backups (and count against browser storage).
- The menu backdrop comes from your own game files, is generated locally and git-ignored;
  without it the dirt texture remains. No Mojang pixels are redistributed.
- Text notes only — no screenshots or blueprint uploads on builds (yet).
- Import replaces the current data set, and only after validation; a bad file changes nothing.


