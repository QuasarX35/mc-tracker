# Page Override — `tracker` (the app)

> Overrides `../MASTER.md` for the single-page build tracker (`src/index.html`), per the
> Master + Overrides pattern. Rules not listed here come from the Master unchanged.
> **Authored in EDICT-0005.** Supersedes `dashboard.md` (the EDICT-0004 server dashboard),
> which is retained only as an archived record. **Updated by EDICT-0013** — Minecraft face,
> inline title/notes editing, coords copy, needed steppers, one full-catalog icon picker,
> material chooser, themed native dropdowns and the sharper backdrop.

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
| Detail | Title with a rename pencil (`#build-rename`) left of Delete, status segmented control, coords with a copy micro-button (`#copy-coords`), notes view/edit (`#notes-text`/`#build-notes`), XP progress, material table with `button.mat-step` clusters, add-material chooser (`#mat-choice`) | Title and notes commit explicitly (Save/Enter; Escape restores); quantities still commit on `change`, so typing never re-renders |
| Materials view | Aggregated shopping list with per-item XP bars, search, filter, copy-list | "Used by" column collapses at ≤900px; got-column at ≤640px |
| Worlds view | World cards with a 40px avatar beside the name plus per-world roll-up and select/edit/delete | Auto-fill grid, min 280px |
| Icon picker | One dialog, no tabs: searchable `.icon-tile` grid with a count hint, footer **Upload image…**, shared by the world dialog, build dialog, detail avatar and the material chooser | Pick-item mode hides upload and Use, and one click selects and closes; Escape clears the search, then closes |
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
7. Title and notes are explicit editors: `#build-rename` → `#build-name` + `#build-name-save`/
   `#build-name-cancel`; `#notes-edit` → `#build-notes` + `#notes-save`/`#notes-cancel`.
   Enter (notes: `Ctrl/Cmd+Enter`) saves, Escape cancels and restores, blank titles are refused,
   notes are trimmed, and focus returns to the invoking button. Material quantities keep
   committing on `change`.
8. Each material row carries six `button.mat-step` buttons (`+1 +10 +stack` above,
   `-1 -10 -stack` below) with `data-mat` and `data-stack` (`64|16|1`); `+stack` defaults to 64
   for unknown items and `needed` clamps at 1.
9. `#copy-coords` copies the coords field and toasts; it is disabled when the field is empty or
   whitespace. Required fields are validated in the form handler even though `#mat-item` is a
   hidden input.
10. Dropdowns stay native `<select>`s. `@supports (appearance: base-select)` themes
    `::picker(select)` in Chromium; elsewhere the OS popup is unchanged — no JavaScript listbox
    emulation.

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
  `image-rendering: pixelated`, bundled **Minecraft** bitmap face (Craftron Gaming; licence in
  `src/assets/fonts/Minecraft-LICENCE.md`, raw evidence
  `raw/sources/2026-10-25-minecraft-font-licence.md`) with **Pixelify Sans** as the fallback for
  the glyphs it lacks (arrows, dashes, ellipsis, `×`, `·`, `≥`, `≤`), and no CDN. Lowercase
  renders as small capitals — the vanilla look, accepted.
- `AC-9` Identity: every world and build can carry an item icon or an uploaded image; it appears
  in the topbar, world cards, build rows and the detail header; clearing it restores the letter;
  uploads are 128×128 data URLs and survive reload/export/import.
- `AC-10` Backdrop: the panorama is baked at blur radius **2.5** (0–3 guard, `max(4, …)` floor
  removed) from four faces with a 64 px crossfade into a 2,560×640 WebP (45,664 B, sha256
  `249a…5978`), displayed with CSS `blur(1px)` desktop / `blur(1.5px)` at ≤640 px over a **0.2**
  scrim, panning for 120 s and stopping under `prefers-reduced-motion`; blocked or absent files
  fall back to dirt without console errors.
- `AC-11` Icon resolution and catalog: every material/avatar icon comes from the game's own
  **256×256 inventory renders** (IconExporter export; `manifest.json` → `mode: hires-exports`,
  `pixels: 256`), shown smoothly downscaled (22 px slot, 28–48 px avatars) and never
  nearest-neighbour-scaled; the PNGs stay git-ignored and a missing render falls back to a
  letter. The catalog is **1,368 addressable base items** (1,609 item renders: 1,363 plain + 5
  representatives of 246 variant renders; 241 collapsed variants), curated 53 first,
  `MC_ICON_NAMES` emitted as an object keyed by slug, stacks from the exception table (default
  64). Lighting is classified from the jar model chain as exactly `block` / `flat` /
  `3d-other` (407 / 620 / 341; `hopper` is flat, jar-verified), and the five
  `flat_pixel_mismatches` are copied byte-for-byte and disclosed. Because IconExporter 1.3.1
  exports 3D icons too dark (it flattens Minecraft's GUI diffuse lighting; upstream fix PR #41
  unreleased), the extractor applies and records a documented per-face brightness correction
  restoring the vanilla inventory ratios (top 0.99, left 0.65, right 0.40 of the block texture);
  flat 2D sprites are copied unchanged.
- `AC-12` Detail interaction: `#build-rename` sits left of `#build-delete` and swaps the heading
  for `#build-name` + `#build-name-save`/`#build-name-cancel`; Enter saves, Escape restores,
  blank titles are refused, focus returns. Notes show `#notes-text` in view mode and
  `#build-notes` + `#notes-edit`/`#notes-save`/`#notes-cancel` in edit mode; `Ctrl/Cmd+Enter`
  saves, an empty note shows a muted placeholder. `#copy-coords` copies and toasts, disabled when
  empty. Every material row shows exactly six `button.mat-step` buttons with
  `data-mat`/`data-step`/`data-stack`, `needed` clamps at 1, and the add-material `#mat-choice`
  opens the picker in pick-item mode.

## 5. Verification record (2026-10-25)

| Check | Command | Result |
|-------|---------|--------|
| Unit | `tracker-model.test.mjs` + `tracker-icons.test.mjs` | 22/22 + 9/9 (60/60 across all unit files) |
| Acceptance | `tracker.acceptance` + `tracker-icons` + `tracker-icon-resolution` + `edict-0013-assets` | 17/17 + 8/8 + 7/7 + 11/11 (71/71 across all acceptance files) |
| Browser UI suite | `node scripts/app-qa.mjs run` | 49/49, exit 0; stamp `app-qa: verified — 2026-10-25T10:02:35.160Z (49 UI cases)` covering the app sources + font TTF, backdrop WebP and panorama manifest |
| UI audit | `python tests/qa/mc_ui_audit.py` | **138/138** (contrast, structure, pixel, identity/backdrop, icon catalog/lighting, edict-0013 interaction/dropdown/backdrop) |
| Font | `font-probe.txt` + sealed raw source | `document.fonts.check('16px Minecraft')` true; 110 glyphs / 107 `cmap`; licence file and raw evidence present |
| Icon set | `scripts/mc-icons.py` + `manifest.json` | 1,368 addressable icons from 1,609 renders; 241 collapsed variants; 407 block / 620 flat / 341 3d-other; five `flat_pixel_mismatches` disclosed; zero game pixels tracked |
| Dropdowns | `picker-probe.json` + headed probe | `base-select` supported; `::picker(select)` background `rgb(111,111,111)`, border `2px solid rgb(0,0,0)`, Minecraft family |
| Backdrop | `blur-probe.txt` + generator preview + captures | bake 2.5 (was 8), CSS 1 px / 1.5 px, scrim 0.2, 45,664 B WebP, edge-variance 1,132.6 → 1,379.9 |
| Desktop render | headless Chrome, 1280×900 | rename/copy/notes/steppers/picker/themed select verified visually |
| Mobile 390px | CDP viewport override | no horizontal overflow, six steppers fit, 4-column picker |
| Evidence | `reports/qa/evidence/edict-0013/` + `edict-0012/01-builds-view-corrected.png` | 27 files (22 PNG), 22 distinct hashes; `picker-probe.json`, `font-probe.txt`, `blur-probe.txt`, `spinner-probe.txt` |

## 6. Known gaps (deliberate)

- Item icons are the game's own **256×256 inventory renders**, 1,368 addressable base items
  generated locally with `scripts/mc-icons.py` and git-ignored; without the export the script
  falls back to the 16×16 client-jar textures and labels the manifest. The export holds 1,609
  item renders (1,363 plain + 246 component variants), and the 246 variants collapse to 5
  representatives (`collapsed_variants` 241) — a specific potion or painting variant cannot be
  picked. Items the export lacks, including anything added to the game after the export, keep the
  lettered fallback.
- Stack sizes are curated product data, not derivable from the PNG export: default 64 except
  egg/snowball/`ender_pearl`/`honey_bottle`/`armor_stand`/empty buckets/signs/banners (16) and
  filled buckets/tools/armour/elytra/potions/boats/minecarts/shulker boxes/beds/cakes & stews/
  books/maps/banner patterns/discs (1); `slime_ball` is 64. The exception table's completeness is
  the risk — a wrong default is a plausibility bug, not a crash.
- Lighting is the jar model chain classified into `block` / `flat` / `3d-other` (407 / 620 / 341
  of 1,368); `hopper` is `flat` (jar-verified), `anvil` and `chest` are `3d-other`. The 341-name
  `3d-other` list is disclosed rather than assumed correct, and five flat sprites
  (`enchanted_book`, `enchanted_golden_apple`, `end_crystal`, `experience_bottle`,
  `nether_star`) are byte-for-byte copies disclosed as `flat_pixel_mismatches`.
- **IconExporter 1.3.1 exports 3D icons too dark** (non-uniform pose scale flattens the GUI
  diffuse lighting). The extractor restores vanilla face brightness on the exported render and
  records the measured factors/gains in `manifest.json`; this is a compensation, not a
  re-render. The upstream fix exists (IconExporter PR #41) but is unreleased for 1.21.4 — when
  it ships, re-export and drop the correction.
- Themed dropdowns exist only where `appearance: base-select` is supported (pinned Chrome
  155.0.8059.86); every other browser keeps the native OS popup. That is the price of not
  rewriting selects in JavaScript.
- The face maps 107 codepoints: arrows, dashes, ellipsis, `×`, `·`, `≥`, `≤` come from the
  Pixelify fallback. `Minecraft.ttf` stays untracked until its licence file and the sealed raw
  source are both present.
- Storage is per-browser only: the footer says so and Export exists for backups; there is no
  server sync.
- No image/screenshot attachments on builds; no sharing links; no multi-user.
- Avatar uploads are capped at 128×128 WebP/PNG data URLs (≤120 000 chars) inside the saved
  state; many uploads grow backups and count against browser storage.
- The menu backdrop is generated locally from the owner's client; without extraction the dirt
  texture remains. Blur/scrim were re-tuned in EDICT-0013 to the emperor's direction, but the
  side-by-side comparison with the real title screen on a physical display is still untested.

