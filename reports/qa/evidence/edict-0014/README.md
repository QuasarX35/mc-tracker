# EDICT-0014 — evidence crate

What `docs/governance/EDICT-0014.md §4` (row: Evidence) and §1 AC1–AC12 require. The Lead seat
runs Chrome and writes this crate; 测试部 labels every file, checks the pixels and refuses
placeholders. If a capture's premise is impossible (e.g. a headless screenshot of a native
popup), it is relabelled honestly — never faked.

## The 16 capture groups (Lead script output, fixed names)

Screenshots are full-viewport PNG unless the name says `clip`. Desktop 1280×900, mobile 390×844.

| # | Group | Files |
|---|-------|-------|
| 01 | builds view | `01-builds-1280x900.png` — title pencil left of Delete, copy-coords button, notes shown as text, six steppers in the first row |
| 02 | stack labels | `02-stack-labels-clip.png` — `+1 +10 +64 -1 -10 -64` on stone bricks, and a stack-1 row (water bucket) with four buttons only |
| 03 | paging first batch | `03-picker-paging-first-1280x900.png` — hint `showing 120 of 1368 — scroll for more` |
| 04 | paging end | `04-picker-paging-end-1280x900.png` — catalog end, hint count, last tile focusable |
| 05 | full names | `05-names-1280x900.png` (a 692×115 tile clip despite the name; kept so citations stay valid) + `05-names-390x844.png` — longest names wrap, no ellipsis |
| 06 | tooltip in dialog | `06-tooltip-in-dialog.png` — `#mc-tooltip` inside the open picker, clamped |
| 07 | recents | `07-picker-recents.png` — `data-icon-recent` tiles first in the unfiltered picker |
| 08 | suggestion | `08-suggestion.png` — `#detail-avatar[data-icon-auto]` + `#icon-suggest-note` |
| 09 | bulk paste | `09-bulk-paste.png` — matched/unknown review rows before `#bulk-add` |
| 10 | undo | `10-undo-toast.png` — toast carrying `Undo` after a delete |
| 11 | backdrop motion | `11-backdrop-t0.png`, `11-backdrop-t1.png`, `11-backdrop-t2.png` — three captures ~1 s apart; t1/t2 differ from t0 |
| 12 | reduced motion | `12-backdrop-reduced-motion.png` — animation `none` |
| 13 | empty builds/worlds | `13-empty-builds-and-worlds-1280x900.png` — `#build-empty` + `#world-empty` with their controls |
| 14 | empty detail/material | `14-empty-detail-and-material-1280x900.png` — `#detail-empty` + `#material-empty` controls |
| 15 | empty world materials | `15-empty-world-material-1280x900.png` — filtered-to-zero list + `#btn-empty-reset-filter` |
| 16 | mobile | `16-mobile-390x844.png` — builds view at 390, no horizontal overflow |
| — | paging proof | `probe.json` — batches 120→…, 1,368 distinct slugs, last tile clickable, `scrollWidth` values |

## Supplied artefacts (not Lead-captured)

| File | From | Proves |
|------|------|--------|
| `panorama-tile-proof.png` | 工部 generator | six inputs / four stitched sides / seamless 2,560×640 strip |
| `panorama-before-after.png` | Lead, from both bakes | top row = EDICT-0013 strip (blur 2.5, four faces, visible crossfade seam), bottom row = EDICT-0014 strip (blur 2.0, six inputs, seamless wrap); 2560×1284 |

## Logs attached separately (not screenshots)

`browser-run.log` (`# tests 66 / # pass 66`, exit 0), `app-qa.stamp.json` (the
`docs/governance/app-qa.json` content as written), `audit-output.txt` (147/147),
`len-check.txt` (hash/length listing so duplicate shots are visible by hash).

The stamp itself lives at `docs/governance/app-qa.json` and is written only after the assets
above are final (R10 ordering). Anything missing from the 16 groups is a finding, not a
footnote.
