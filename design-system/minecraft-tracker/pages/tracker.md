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
- `AC-8` Pixel contract: square corners, 2px bevels, `image-rendering: pixelated`, bundled
  bitmap font, no CDN.
- `AC-9` Identity: every world and build can carry an item icon or an uploaded image; it appears
  in the topbar, world cards, build rows and the detail header; clearing it restores the letter;
  uploads are 128×128 data URLs and survive reload/export/import.
- `AC-10` Backdrop: with the generated panorama present, the menu scene is blurred, slowly
  panning and behind a scrim; blocked/absent files fall back to dirt without console errors;
  `prefers-reduced-motion` stops the pan.

## 5. Verification record (2026-10-25)

| Check | Command | Result |
|-------|---------|--------|
| Unit (model) | `node tests/unit/tracker-model.test.mjs` + `tracker-icons.test.mjs` | 15/15 + 9/9 |
| Acceptance | `tracker.acceptance.test.mjs` + `tracker-icons.acceptance.test.mjs` | 16/16 + 8/8 |
| Browser UI suite | `node tests/qa/ui.e2e.test.mjs` | 36/36 (identity + backdrop added) |
| UI audit | `python tests/qa/mc_ui_audit.py` | 65/65 (contrast, structure, pixel, identity/backdrop contract) |
| Desktop render | headless Chrome, 1280×1100 | avatars, panorama, picker verified visually |
| Mobile 390px | CDP viewport override | no horizontal overflow, panorama covers |
| Evidence | `reports/qa/evidence/edict-0010/` | 5 screenshots (identity, picker, image upload, mobile) |

## 6. Known gaps (deliberate)

- Item icons are Minecraft's own textures (53 materials), generated locally by `scripts/mc-icons.py` and git-ignored. Model-only items (chest, doors, fences) have no standalone texture and fall back to a lettered slot.
- Storage is per-browser only: the footer says so and Export exists for backups; there is no
  server sync.
- No image/screenshot attachments on builds; no sharing links; no multi-user.
- Avatar uploads are capped at 128×128 WebP/PNG data URLs (≤120 000 chars) inside the saved
  state; many uploads grow backups and count against browser storage.
- The menu backdrop is generated locally from the owner's client; without extraction the dirt
  texture remains. Pan speed/blur are taste, tuned against screenshots.

