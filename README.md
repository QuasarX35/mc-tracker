# Minecraft Build Tracker

Plan your builds, list the blocks they need, and tick off the grind — across every world you
play. Styled as closely as possible to Minecraft's in-game GUI: GUI-grey panels, 2px bevels,
square corners, pixel font, item slots and XP-style progress bars.

**Open it:** double-click `src/index.html`. No build step, no server, no install, works
offline from `file://`. Data is saved in your browser (`localStorage`); use **Export** to keep
a backup and **Import** to restore it.

## What it does

- **Worlds** — one tracker per world, with edition + version. Select the active world in the
  top bar; edit or delete from the Worlds tab.
- **Builds** — plan a build with status (Planned / Building / Done), coordinates and notes.
- **Materials** — give each build the blocks it needs (`needed` / `got`), edit quantities
  inline; the build's XP bar fills as you gather.
- **Shopping list** — every item summed across all builds in the world, sorted so outstanding
  items come first, filterable, copyable as text (`Stone Bricks x640 (440 left)`).
- **Sample data** — `src/index.html?demo=1` seeds two example worlds if storage is empty.
  Deep links: `?tab=builds|materials|worlds`.


## Icons (run once)

The repository ships **no Minecraft artwork** — Mojang's assets are not redistributable. Icons
are generated locally from your own installed Java Edition client:

```powershell
<python with Pillow> scripts/mc-icons.py          # default: %APPDATA%\.minecraft, 1.21.4
<python with Pillow> scripts/mc-icons.py --version 1.21.5
```

That writes `src/assets/icons/*.png` (git-ignored), plus the committed artefacts
`manifest.json` (source textures + SHA-256), `icons.js` (slugs/names for `file://` loading) and
`PROVENANCE.md` (licensing). Flat items are copied; cube blocks are composited as the game's
2:1 isometric icon (top 100 %, left 80 %, right 60 %); animated textures use frame 1; grass is
plains-tinted. **Without this step the app still works** — every slot falls back to a letter.

Licensing: personal, non-commercial use of textures from your own purchase; not affiliated with
Mojang or Microsoft; do not publish a clone containing the generated PNGs.
## Layout

| Path | What it is |
|------|------------|
| `src/index.html` | The app shell (tabs, panel, dialogs) |
| `src/styles.css` | Minecraft GUI design system — tokens first, no rounded corners |
| `src/app.js` | Rendering and event binding; all state goes through the model |
| `src/tracker/model.js` | Pure domain model: worlds → builds → materials, aggregation, validation, storage |
| `src/assets/` | 9 tiling textures, favicon, Pixelify Sans (OFL); **item icons are generated locally, not committed** |
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
node tests/unit/tracker-model.test.mjs          # 15 model cases
node tests/qa/tracker.acceptance.test.mjs       # 16 acceptance + static contract cases
python tests/qa/mc_ui_audit.py                  # 41 contrast/structure/pixel/icon cases
# wiki + governance (the wiki is a required output of every edict)
node src/wiki/cli.mjs lint                      # incl. the edict-sync rule
node src/wiki/cli.mjs sync                      # which completed edicts have been ingested
node src/wiki/cli.mjs index --check             # catalogue freshness

# UI acceptance (real Chrome, driven over the DevTools Protocol — no packages)
node tests/qa/ui.e2e.test.mjs                   # 27 user-flow cases
node scripts/app-qa.mjs run                     # run them AND stamp the app sources
node scripts/app-qa.mjs status                  # verified / STALE

```

Current status: **15/15**, **16/16**, **30/30**, and screenshots verified at 1280 px and
390 px.

## Scope and honesty

- Local-only: no accounts, no sync, no server. One browser = one dataset.
- Icons are **Minecraft's own textures** (53 of them), extracted from your installed game at 16×16 with isometric block composition; items without a standalone vanilla texture (chest, doors, fences) get a lettered slot rather than a wrong icon.
- Text notes only — no screenshots or blueprint uploads on builds (yet).
- Import replaces the current data set, and only after validation; a bad file changes nothing.


