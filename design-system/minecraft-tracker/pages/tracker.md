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
| Builds view | Build list (left) + build detail (right) | Stacks to one column at ≤900px |
| Detail | Name, status segmented control, coords, notes, XP progress, material table, add-material form | Inline editing commits on `change`, so typing never re-renders |
| Materials view | Aggregated shopping list with per-item XP bars, search, filter, copy-list | "Used by" column collapses at ≤900px; got-column at ≤640px |
| Worlds view | World cards with per-world roll-up and select/edit/delete | Auto-fill grid, min 280px |
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

## 5. Verification record (2026-10-25)

| Check | Command | Result |
|-------|---------|--------|
| Unit (model) | `node tests/unit/tracker-model.test.mjs` | 15/15 |
| Acceptance | `node tests/qa/tracker.acceptance.test.mjs` | 16/16 |
| UI audit | `python tests/qa/mc_ui_audit.py` | 41/41 (incl. icon provenance + git-ignore contract) |
| Desktop render | headless Chrome, 1280×1250 | `?tab=builds` verified visually |
| Materials view | headless Chrome, 1280×1000 | progress bars, icons, filters verified |
| Worlds view | headless Chrome, 1280×1000 | active chip, card actions verified |
| Mobile 390px | iframe harness (`Chrome` min window width ≥500px) | no horizontal overflow |

## 6. Known gaps (deliberate)

- Item icons are Minecraft's own textures (53 materials), generated locally by `scripts/mc-icons.py` and git-ignored. Model-only items (chest, doors, fences) have no standalone texture and fall back to a lettered slot.
- Storage is per-browser only: the footer says so and Export exists for backups; there is no
  server sync.
- No image/screenshot attachments on builds; no sharing links; no multi-user.

