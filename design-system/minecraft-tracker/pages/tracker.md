# Page Override — `tracker` (the app)

> Overrides `../MASTER.md` for the single-page build tracker (`src/index.html`), per the
> Master + Overrides pattern. Rules not listed here come from the Master unchanged.
> **Authored in EDICT-0005.** Supersedes `dashboard.md` (the EDICT-0004 server dashboard),
> which is retained only as an archived record.

## 1. Page pattern

**Data-entry application, not a landing page.** One screen with three tabs
(Builds / Materials / Worlds), a world selector in the panel top bar, and modal dialogs for
create/edit/confirm. No hero, no marketing sections, no charts: this is a working tool that
is opened repeatedly while playing.

## 2. Screen anatomy

| Region | Contents | Notes |
|--------|----------|-------|
| Masthead | "Minecraft" eyebrow (aqua), "Build Tracker" title, tagline | Title uses the vanilla 4px hard shadow; sits directly on the dirt backdrop |
| Tab strip | 3 tabs, `role="tablist"`, arrow-key navigation | Selected tab merges into the panel |
| Panel top bar | World `<select>`, world meta (edition/version/builds/percent), New World / Import / Export | Wraps at ≤640px |
| Builds view | Build list (left, each row with its 28px avatar) + build detail (right, 40px avatar button that opens the icon picker) | Stacks to one column at ≤900px |
| Detail | Name, status segmented control, coords, notes, XP progress, material table, add-material form | Inline editing commits on `change`, so typing never re-renders |
| Materials view | Aggregated shopping list with per-item XP bars, search, filter, copy-list | "Used by" column collapses at ≤900px; got-column at ≤640px |
| Worlds view | World cards with a 40px avatar beside the name plus per-world roll-up and select/edit/delete | Auto-fill grid, min 280px |
| Icon picker | Dialog: item grid (searchable) or image upload; shared by world dialog, build dialog and the detail avatar | Keyboard reachable, Escape clears search then closes |
| Status | `aria-live="polite"` line + toast | Announces saves, imports, errors |

## 3. Interaction rules

1. Every mutation goes through `TrackerModel`; the UI never writes state directly.
2. State persists to `localStorage` after each mutation; a failed write surfaces a toast and
   never throws.
3. Destructive actions (world, build) require the confirm dialog with the object named in it.
4. Import **replaces** the whole state only after `TrackerModel.importJSON` validates it; a
   malformed or foreign file is refused with the reason, and existing data is untouched.
5. `?demo=1` seeds the sample worlds only when nothing is stored; `?tab=builds|materials|worlds`
   deep-links a view (used by the screenshot QA).
6. Tabs are reachable by keyboard (←/→), `aria-selected` always matches the visible panel.

## 4. Acceptance criteria

- `AC-1` Aggregated shopping list equals the sum of every build's materials, computed
  independently of the implementation.
- `AC-2` `remaining` is never negative when the player over-farms; totals stay consistent.
- `AC-3` Duplicate item names (case-insensitive) merge into one row with summed quantities.
- `AC-4` Deleting a world removes its builds and never leaves a dangling active world.
- `AC-5` Backup round-trips byte-for-byte in meaning; bad files are refused without data loss.
- `AC-6` Offline: no remote fonts/scripts/images; all assets resolve locally; works from
  `file://` (classic scripts, no ES modules).
- `AC-7` Every control is labelled; no inline handlers; visible focus; reduced-motion honoured.
- `AC-8` Pixel contract: square corners, 2px bevels, tiled block textures stay
  `image-rendering: pixelated`, bundled bitmap font, no CDN.
- `AC-9` Identity: every world and build can carry an item icon or an uploaded image; it appears
  in the topbar, world cards, build rows and the detail header; clearing it restores the letter;
  uploads are 128×128 data URLs and survive reload/export/import.
- `AC-10` Backdrop: with the generated panorama present, the menu scene is blurred, slowly
  panning and behind a scrim; blocked/absent files fall back to dirt without console errors;
  `prefers-reduced-motion` stops the pan.
- `AC-11` Icon resolution: every material/avatar item icon comes from the game's own **256×256
  inventory renders** (IconExporter export, `manifest.json` → `mode: hires-exports`, `pixels:
  256`); the app displays them smoothly downscaled (22 px slot, 28–48 px avatars) and never
  nearest-neighbour-scales them; the PNGs stay git-ignored and a missing render falls back to a
  letter. The lower-resolution 16×16 client-jar extraction remains a labelled fallback mode.
  Because IconExporter 1.3.1 exports 3D icons too dark (it flattens Minecraft's GUI diffuse
  lighting; upstream fix PR #41 unreleased), the extractor applies and records a documented
  per-face brightness correction restoring the vanilla inventory ratios (top 0.99, left 0.65,
  right 0.40 of the block texture); flat 2D sprites are copied unchanged.

## 5. Verification record (2026-10-25)

| Check | Command | Result |
|-------|---------|--------|
| Unit (model) | `node tests/unit/tracker-model.test.mjs` + `tracker-icons.test.mjs` | 15/15 + 9/9 |
| Acceptance | `tracker.acceptance.test.mjs` + `tracker-icons.acceptance.test.mjs` + `tracker-icon-resolution.acceptance.test.mjs` | 16/16 + 8/8 + 7/7 |
| Browser UI suite | `node tests/qa/ui.e2e.test.mjs` | 36/36 (identity + backdrop) |
| UI audit | `python tests/qa/mc_ui_audit.py` | 72/72 (contrast, structure, pixel, identity/backdrop, 256 px icon + lighting-correction contract) |
| Icon set | `scripts/mc-icons.py` + `manifest.json` | 53 icons, 256×256 RGBA renders, sha256 per icon; 3D renders brightness-corrected (vanilla face ratios 0.99/0.65/0.40), flat sprites untouched; zero game pixels tracked |
| Desktop render | headless Chrome, 1280×1100 | avatars, panorama, picker, high-res slots verified visually |
| Mobile 390px | CDP viewport override | no horizontal overflow, panorama covers |
| Evidence | `reports/qa/evidence/edict-0010/`, `reports/qa/evidence/edict-0011/` | identity/backdrop screenshots + high-res icon evidence |

## 6. Known gaps (deliberate)

- Item icons are Minecraft's own **256×256 inventory renders** (53 materials), exported locally
  with IconExporter via `scripts/mc-icons.py` and git-ignored; without the export the script
  falls back to the 16×16 client-jar textures and labels the manifest accordingly. The set is
  still the curated 53 materials: chests, doors, fences and unknown item names keep the lettered
  fallback — adding a rendered item is one row in `scripts/mc-icons.py` plus a regenerate.
- **IconExporter 1.3.1 exports 3D icons too dark** (non-uniform pose scale flattens the GUI
  diffuse lighting). The extractor restores vanilla face brightness on the exported render and
  records the measured factors/gains in `manifest.json`; this is a compensation, not a
  re-render. The upstream fix exists (IconExporter PR #41) but is unreleased for 1.21.4 — when
  it ships, re-export and drop the correction.
- Storage is per-browser only: the footer says so and Export exists for backups; there is no
  server sync.
- No image/screenshot attachments on builds; no sharing links; no multi-user.
- Avatar uploads are capped at 128×128 WebP/PNG data URLs (≤120 000 chars) inside the saved
  state; many uploads grow backups and count against browser storage.
- The menu backdrop is generated locally from the owner's client; without extraction the dirt
  texture remains. Pan speed/blur are taste, tuned against screenshots.

