# Page Override — `tracker` (the app)

> Overrides `../MASTER.md` for the single-page build tracker (`src/index.html`), per the
> Master + Overrides pattern. Rules not listed here come from the Master unchanged.
> **Authored in EDICT-0005.** Supersedes `dashboard.md` (the EDICT-0004 server dashboard),
> which is retained only as an archived record. **Updated by EDICT-0013** — Minecraft face,
> inline title/notes editing, coords copy, needed steppers, one full-catalog icon picker,
> material chooser, themed native dropdowns and the sharper backdrop. **Updated by EDICT-0014**
> — seamless 360° scenery, paged picker with full names, one top-layer tooltip, working empty
> states, resolved stack labels (and no stack buttons at stack 1), deterministic icon
> suggestion, bulk paste, six-second undo and recent picks.

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
| Builds view | Build list (left, each row with its 28px avatar) + build detail (right, 40px avatar button that opens the icon picker) | Stacks to one column at ≤900px; empty state `#build-empty` offers `#btn-first-build`, which opens the world dialog when there are zero worlds and the build dialog otherwise — never an error toast |
| Detail | Title with a rename pencil (`#build-rename`) left of Delete, status segmented control, coords with a copy micro-button (`#copy-coords`), notes view/edit (`#notes-text`/`#build-notes`), XP progress, material table with `button.mat-step` clusters (four buttons at stack 1, six otherwise, resolved labels), add-material chooser (`#mat-choice`) and **Paste list…** (`#bulk-paste`) | Title and notes commit explicitly (Save/Enter; Escape restores); quantities still commit on `change`, so typing never re-renders; deleting a row offers `#toast-action` **Undo** for 6 s; empty material list offers `#btn-empty-pick-material` |
| Materials view | Aggregated shopping list with per-item XP bars, search, filter, copy-list | "Used by" column collapses at ≤900px; got-column at ≤640px; zero filter matches shows `#world-material-empty` with `#btn-empty-reset-filter` (clears search + filter) |
| Worlds view | World cards with a 40px avatar beside the name plus per-world roll-up and select/edit/delete | Auto-fill grid, min 280px |
| Icon picker | One dialog, no tabs: searchable `.icon-tile` grid with incremental paging (`#icon-sentinel`) and a count hint, wrapped names, recent picks first, **Upload image…** footer, shared by the world dialog, build dialog, detail avatar and the material chooser | First batch 120 tiles, 120 more per sentinel hit, all 1,368 slugs reachable; typing resets; `#icon-count-hint` text frozen; pick-item mode hides upload and Use and one click selects and closes; on a build with a display-only suggestion the dialog shows `#icon-suggest-note` and marks `data-icon-suggested` |
| Status | `aria-live="polite"` line + toast (`#toast`, may carry `#toast-action` **Undo** after a delete for 6 s) | Announces saves, imports, errors, undo |

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
8. Each material row carries six `button.mat-step` buttons (`+1 +10 +64` above, `-1 -10 -64`
   below) with resolved labels; stack-1 items carry four, because the stack pair is absent from
   the DOM, not disabled. Every button carries `data-mat` and `data-stack` (`64|16|1`);
   `data-step` keeps the shipped literals `+1/+10/+stack/-1/-10/-stack` (no rename) and
   `data-mat-step` carries the resolved amount. `needed` clamps at 1.
9. `#copy-coords` copies the coords field and toasts; it is disabled when the field is empty or
   whitespace. Required fields are validated in the form handler even though `#mat-item` is a
   hidden input.
10. Dropdowns stay native `<select>`s. `@supports (appearance: base-select)` themes
    `::picker(select)` in Chromium; elsewhere the OS popup is unchanged — no JavaScript listbox
    emulation.
11. One shared `#mc-tooltip` (`role="tooltip"`) is the only tooltip surface: appended to the open
    `<dialog>` (else `body`), carrying the source slot's `data-tip`, fixed and clamped 8 px
    inside the viewport, flipping below the slot when under 44 px of room remains above. No
    `.slot[data-tip]::after` (or tile/row) tooltip rule survives. Delegation uses bubbling
    `pointerover`/`pointerout` with an `event.relatedTarget` containment check plus
    `focusin`/`focusout`; Escape and dialog close hide it.
12. The picker pages in 120-tile batches through `div#icon-sentinel` (aria-hidden, last child of
    `#icon-grid`); every one of the 1,368 slugs is reachable and no slice cap remains. Typing
    resets to the first batch and removes the sentinel. `#icon-count-hint` reads
    `showing N of 1368 — scroll for more` (or `showing N of M for "query"`); item names wrap
    instead of truncating.
13. The five zero states each name their next action: `#build-empty` → `#btn-first-build`
    (world dialog when there are no worlds, otherwise the build dialog), `#world-empty` →
    `#btn-empty-create-world`, `#detail-empty` → `#detail-empty-action`, `#material-empty` →
    `#btn-empty-pick-material`, `#world-material-empty` → `#btn-empty-reset-filter` (clears
    search and filter). No control may answer only with an error toast.
14. Icon suggestion is display-only and deterministic: `M.suggestIcon(build, world, catalog)`
    uses the frozen keyword table (longest whole-word keyword in the name; then notes, then the
    world name; then the largest material; then the world icon; else `null`). `#detail-avatar`
    shows `data-icon-auto` + `title` while a suggestion is displayed; the picker shows
    `#icon-suggest-note` and marks the tile; choosing stores the icon and clears the marker.
    A suggestion never replaces a stored icon.
15. **Paste list…** (`#bulk-paste`) opens `#bulk-dialog` with a review list: the matcher is
    case-insensitive exact display name → exact slug → unique prefix of at least 3 characters;
    unknown or ambiguous lines stay unmatched and are not added; duplicates merge; quantities
    clamp ≥1; **Add matched** commits once.
16. Deletion of a material, build or world offers **Undo** in the toast for 6,000 ms; one
    deep-equal snapshot restores state, view and focus, and any later commit clears it. The
    confirm copy says “You can undo for 6 seconds.”
17. Recent picks (`mc-build-tracker:recent`, at most 8 slugs) are browser-local, not exported,
    and lead the unfiltered first picker batch; choosing an item records it at the front.
18. Picker and material rows keep the catalogue surfaces unchanged: `MC_ICON_SET` is an array of
    slug strings, `MC_ICON_NAMES` and `MC_ICON_STACKS` are slug-keyed objects.

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
- `AC-10` Backdrop: the panorama is baked at blur radius **2.0** (ceiling 2) from **six resolved
  inputs** `panorama_0…5` — the four side faces stitched with a 64 px wrap crossfade so the loop
  is seamless, the top/bottom caps recorded but not stitched — into a 2,560×640 WebP (55,096 B,
  sha256 `331253bd…bf1a5`); two `.backdrop__layer` copies translate −50 % over **180 s** linear
  infinite, with per-layer CSS `blur(1px)` desktop / `blur(1.5px)` at ≤640 px over a **0.2**
  scrim. `prefers-reduced-motion` stops it; blocked or absent files fall back to dirt without
  console errors.
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
  empty. Every material row shows six `button.mat-step` buttons with resolved labels (`+1 +10 +64`)
  — four at stack 1, no stack pair — with `data-mat`/`data-step` (shipped `+stack` literal)/
  `data-stack`, `needed` clamps at 1; `#mat-choice` opens the picker in pick-item mode;
  `#bulk-paste` opens the paste dialog; a deleted material offers Undo.
- `AC-13` Tooltip: one `#mc-tooltip` is topmost at its rect (`elementFromPoint`), fully inside the
  viewport, flips below when under 44 px of space remains, and is hidden after pointer-out,
  Escape and dialog close. No pseudo-element tooltip rule remains.
- `AC-14` Paging: first batch is 121 tiles (120 slugs + the None tile); scrolling to the end
  renders all 1,368 slugs, the last (`zombified_piglin_spawn_egg`) is interactable, and the hint
  reads `showing 1368 of 1368`; typing resets to the first batch.
- `AC-15` Names: on the frozen longest-name samples, `scrollWidth <= clientWidth + 1` on every
  name node at 1280 and 390; no ellipsis, no line clamp.
- `AC-16` Empty states: all five zero states are reachable in a fresh browser, each named
  next-step control works, and no zero-state control answers only with an error toast.
- `AC-17` Suggestion: the ≥ 20-build fixture yields stable slugs and reasons (`stone_bricks`,
  `matched "tower" in the name`); no signal → `null`; a stored icon is never replaced; the picker
  shows `Suggested from "tower"` and marks the tile; `iconAuto` is accepted/exported but
  display-only.
- `AC-18` Bulk paste: 7 review rows, 4 matched (quantities 64/32/1/20) and 3 unknown; one
  **Add matched** commit adds exactly Stone Bricks 64, Glass 32, Oak Log 1, Oak Planks 20;
  duplicates merge and quantities clamp ≥1.
- `AC-19` Undo: deleting a material offers Undo for 6 s and restores the state deep-equal
  (3 → 4 rows); after the window it does nothing; a later commit clears the pending snapshot.
- `AC-20` Recents: after three picks the last (`red_wool`) leads the unfiltered first batch,
  survives reload, caps at 8 and never appears in the exported state.

## 5. Verification record (2026-10-25)

| Check | Command | Result |
|-------|---------|--------|
| Unit | `tracker-model.test.mjs` + `tracker-icons.test.mjs` + `tracker-suggest.test.mjs` + `app-qa.acceptance` units + wiki units | 22 + 9 + 38 + 9 + 20 = **98/98** |
| Acceptance | `tracker.acceptance` + `tracker-icons` + `tracker-icon-resolution` + `edict-0013-assets` + `edict-0014` + `app-qa.acceptance` + wiki + wiki-sync | 17 + 8 + 7 + 11 + 14 + 7 + 13 + 8 = **85/85** |
| Browser UI suite | `node scripts/app-qa.mjs run` | **66/66**, exit 0; stamp `app-qa: verified — 2026-10-25T12:27:45.271Z (66 UI cases)` covering the 8 hashed sources (app files + font + panorama WebP + manifest) |
| UI audit | `python tests/qa/mc_ui_audit.py` | **147/147** (contrast, structure, pixel, identity/backdrop, icon catalog/lighting, edict-0013 interaction/dropdown/backdrop, edict-0014 paging/tooltip/empty-state/stepper rules) |
| Font | `font-probe.txt` + sealed raw source | `document.fonts.check('16px Minecraft')` true; 110 glyphs / 107 `cmap`; licence file and raw evidence present |
| Icon set | `scripts/mc-icons.py` + `manifest.json` | 1,368 addressable icons from 1,609 renders; 241 collapsed variants; 407 block / 620 flat / 341 3d-other; five `flat_pixel_mismatches` disclosed; zero game pixels tracked |
| Dropdowns | `picker-probe.json` + headed probe | `base-select` supported; `::picker(select)` background `rgb(111,111,111)`, border `2px solid rgb(0,0,0)`, Minecraft family |
| Backdrop | `probe.json` + generator proof + captures | six inputs / four sides / 2,560×640 / **2.0** bake / per-layer `blur(1px)` / 0.2 scrim; two `.backdrop__layer` copies translate −1277.63 → −1266.61 → −1255.59 over a 180 s `backdrop-translate`; 55,096 B, sha256 `331253bd…bf1a5`; reduced motion `none` |
| Empty states, tooltip, suggestion, paste, undo, recents | browser cases + `probe.json` | five zero states with working controls; tooltip rect (367, 312, 123×30) topmost and clamped; `stone_bricks` `matched "tower" in the name`; bulk 4 matched + 3 unknown; undo 3 → 4 deep-equal; `red_wool` first |
| Desktop render | headless Chrome, 1280×900 | paging, tooltip, empty states, paste dialog, undo, recents verified visually |
| Mobile 390px | CDP viewport override | no horizontal overflow; four- and six-button rows fit, 4-column picker |
| Evidence | `reports/qa/evidence/edict-0014/` | 20 PNGs with distinct hashes + `probe.json` + README + `panorama-tile-proof.png` |

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
  books/maps/banner patterns/discs (1); `slime_ball` is 64. Labels resolve to the amount
  (`+64`), and stack-1 rows omit the two stack buttons rather than disabling them. The exception
  table's completeness is the risk — a wrong default is a plausibility bug, not a crash.
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
  texture remains. Blur/scrim were re-tuned in EDICT-0013 and the strip became a seamless 180 s
  loop in EDICT-0014 (six inputs, four sides, 2,560×640); the side-by-side comparison with the
  real title screen on a physical display is still untested.
- The e2e suite currently writes a few screenshots into `reports/qa/evidence/edict-0013/`; the
  Lead restored those artifacts byte-for-byte, but the suite should take an output-directory
  argument so runs never share an evidence folder.
- The catalogue shape is deliberately mixed: `MC_ICON_SET` is an array of slug strings while
  `MC_ICON_NAMES` and `MC_ICON_STACKS` are slug-keyed objects. Consumers must not assume one
  shape for all three.
- Paging is append-only scroll: 1,368 tiles in 120-row batches, no virtualisation and no
  "jump to letter"; the count hint is the only progress signal.

